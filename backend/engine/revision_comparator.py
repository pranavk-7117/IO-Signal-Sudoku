from typing import List, Dict, Any, Optional
from models import (
    SignalRecord, AssignmentModel, RevisionComparisonResponse, RevisionDiffItem
)

class RevisionComparator:
    @staticmethod
    def compare_revisions(
        base_rev_name: str,
        target_rev_name: str,
        base_signals: List[SignalRecord],
        target_signals: List[SignalRecord],
        base_assignments: List[AssignmentModel],
        target_assignments: List[AssignmentModel]
    ) -> RevisionComparisonResponse:
        """
        Performs deep revision diff between base (e.g. Rev A) and target (e.g. Rev B).
        Tracks: ADDED, DELETED, MODIFIED, UNCHANGED signals, plus PRESERVED vs MOVED hardware assignments.
        """
        base_sig_map = {s.tag: s for s in base_signals if s.tag}
        target_sig_map = {s.tag: s for s in target_signals if s.tag}

        base_alloc_map = {a.tag: a for a in base_assignments if a.tag}
        target_alloc_map = {a.tag: a for a in target_assignments if a.tag}

        all_tags = sorted(list(set(base_sig_map.keys()).union(set(target_sig_map.keys()))))

        diff_records: List[RevisionDiffItem] = []
        total_added = 0
        total_deleted = 0
        total_modified = 0
        total_unchanged = 0
        total_preserved = 0
        total_moved = 0

        for tag in all_tags:
            in_base = tag in base_sig_map
            in_target = tag in target_sig_map

            base_s = base_sig_map.get(tag)
            target_s = target_sig_map.get(tag)

            base_a = base_alloc_map.get(tag)
            target_a = target_alloc_map.get(tag)

            base_hw_str = (
                f"{base_a.cabinet_id}/{base_a.cioc_id}/{base_a.baseplate_id}/CH{base_a.charm_index}"
                if (base_a and base_a.status == "Allocated" and base_a.cabinet_id)
                else (f"Unallocated ({base_a.status})" if base_a else "None")
            )
            target_hw_str = (
                f"{target_a.cabinet_id}/{target_a.cioc_id}/{target_a.baseplate_id}/CH{target_a.charm_index}"
                if (target_a and target_a.status == "Allocated" and target_a.cabinet_id)
                else (f"Unallocated ({target_a.status})" if target_a else "None")
            )

            if not in_base and in_target:
                # ADDED
                total_added += 1
                diff_records.append(RevisionDiffItem(
                    tag=tag,
                    change_type="ADDED",
                    old_values=None,
                    new_values={
                        "type": target_s.signal_type,
                        "description": target_s.description,
                        "cable": target_s.cable_id,
                        "group": target_s.logical_group,
                        "redundancy": target_s.redundancy
                    },
                    old_assignment=None,
                    new_assignment=target_hw_str,
                    movement_status="NEW",
                    movement_reason="New signal introduced in this revision"
                ))
            elif in_base and not in_target:
                # DELETED
                total_deleted += 1
                diff_records.append(RevisionDiffItem(
                    tag=tag,
                    change_type="DELETED",
                    old_values={
                        "type": base_s.signal_type,
                        "description": base_s.description,
                        "cable": base_s.cable_id,
                        "group": base_s.logical_group,
                        "redundancy": base_s.redundancy
                    },
                    new_values=None,
                    old_assignment=base_hw_str,
                    new_assignment=None,
                    movement_status="DELETED",
                    movement_reason=f"Removed from customer IO list in {target_rev_name}; vacated {base_hw_str}"
                ))
            else:
                # Signal present in both - check for modifications
                modifications = {}
                if base_s.signal_type != target_s.signal_type:
                    modifications["signal_type"] = (base_s.signal_type, target_s.signal_type)
                if base_s.description != target_s.description:
                    modifications["description"] = (base_s.description, target_s.description)
                if base_s.cable_id != target_s.cable_id:
                    modifications["cable_id"] = (base_s.cable_id, target_s.cable_id)
                if base_s.pair_number != target_s.pair_number:
                    modifications["pair_number"] = (base_s.pair_number, target_s.pair_number)
                if base_s.redundancy != target_s.redundancy:
                    modifications["redundancy"] = (base_s.redundancy, target_s.redundancy)
                if base_s.logical_group != target_s.logical_group:
                    modifications["logical_group"] = (base_s.logical_group, target_s.logical_group)

                # Check assignment movement
                movement_status = "PRESERVED"
                movement_reason = "Assignment successfully preserved from previous revision"

                if base_hw_str == target_hw_str:
                    if target_a and target_a.status == "Allocated":
                        total_preserved += 1
                    else:
                        movement_status = "UNALLOCATED"
                        movement_reason = "Signal remains unallocated across revisions"
                else:
                    total_moved += 1
                    movement_status = "MOVED"
                    if modifications:
                        movement_reason = f"Moved due to signal parameter modifications: {', '.join(modifications.keys())}"
                    else:
                        movement_reason = "Reallocated due to neighboring cable realignment or capacity optimization"

                if modifications:
                    total_modified += 1
                    change_type = "MODIFIED"
                else:
                    total_unchanged += 1
                    change_type = "UNCHANGED"

                diff_records.append(RevisionDiffItem(
                    tag=tag,
                    change_type=change_type,
                    old_values={
                        "type": base_s.signal_type,
                        "description": base_s.description,
                        "cable": base_s.cable_id,
                        "group": base_s.logical_group,
                        "redundancy": base_s.redundancy
                    },
                    new_values={
                        "type": target_s.signal_type,
                        "description": target_s.description,
                        "cable": target_s.cable_id,
                        "group": target_s.logical_group,
                        "redundancy": target_s.redundancy
                    },
                    old_assignment=base_hw_str,
                    new_assignment=target_hw_str,
                    movement_status=movement_status,
                    movement_reason=movement_reason
                ))

        return RevisionComparisonResponse(
            base_revision=base_rev_name,
            target_revision=target_rev_name,
            total_added=total_added,
            total_deleted=total_deleted,
            total_modified=total_modified,
            total_unchanged=total_unchanged,
            total_preserved_assignments=total_preserved,
            total_moved_assignments=total_moved,
            diff_records=diff_records
        )
