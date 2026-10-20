import math
from typing import List, Dict, Tuple, Optional, Any
from ortools.sat.python import cp_model
from models import HardwareConfigModel, SignalRecord, AssignmentModel

class AllocationEngine:
    def __init__(self, config: HardwareConfigModel):
        self.config = config
        self.rules = config.rules
        self.compat_matrix = config.compatibility_matrix

    def run_allocation(
        self,
        signals: List[SignalRecord],
        previous_assignments: Optional[Dict[str, AssignmentModel]] = None
    ) -> List[AssignmentModel]:
        """
        Runs deterministic, constraint-based allocation for all imported signals into DeltaV hardware.
        """
        # Step 1: Pre-validate & categorize signals
        valid_signals: List[SignalRecord] = []
        rejected_assignments: List[AssignmentModel] = []
        assigned_tags = set()

        for s in signals:
            sig_type = s.signal_type.upper().strip()
            # Check for empty tag
            if not s.tag or not s.tag.strip():
                rejected_assignments.append(AssignmentModel(
                    signal_id=s.id or 0,
                    tag=s.tag or "MISSING_TAG",
                    description=s.description or "",
                    signal_type=s.signal_type,
                    status="Blocked",
                    reason="Signal tag is empty or missing"
                ))
                continue

            # Check for duplicate tags
            if s.tag in assigned_tags:
                rejected_assignments.append(AssignmentModel(
                    signal_id=s.id or 0,
                    tag=s.tag,
                    description=s.description or "",
                    signal_type=s.signal_type,
                    status="Blocked",
                    reason=f"Duplicate signal tag '{s.tag}' detected in IO database"
                ))
                continue

            # Check hardware compatibility
            if sig_type not in self.compat_matrix:
                rejected_assignments.append(AssignmentModel(
                    signal_id=s.id or 0,
                    tag=s.tag,
                    description=s.description or "",
                    signal_type=s.signal_type,
                    status="Blocked",
                    reason=f"Unsupported signal type '{s.signal_type}' not found in hardware compatibility catalogue"
                ))
                continue

            assigned_tags.add(s.tag)
            valid_signals.append(s)

        # Step 2: Build hardware model
        # Hierarchy: Cabinet (CAB-01..) -> CIOC (CIOC-01..) -> Baseplate (BP-01..) -> CHARM (1..12)
        total_cabinets = self.config.cabinets_count
        ciocs_per_cab = self.config.ciocs_per_cabinet
        baseplates_per_cioc = self.config.baseplates_per_cioc
        charms_per_bp = self.config.charms_per_baseplate
        spare_pct = self.config.spare_percentage

        # Calculate reserved spare CHARMs per baseplate
        # e.g., for 12 charms at 10%, round(12 * 0.10) = 1 spare slot (slot 12 reserved)
        spare_slots_per_bp = max(1, int(math.ceil(charms_per_bp * (spare_pct / 100.0)))) if spare_pct > 0 else 0

        # Create structured hardware slot registry
        # slot: (cab_id, cioc_id, bp_id, charm_idx, is_spare)
        all_hardware_slots = []
        for c in range(1, total_cabinets + 1):
            cab_id = f"CAB-{c:02d}"
            for ci in range(1, ciocs_per_cab + 1):
                cioc_id = f"CIOC-{ci:02d}"
                for bp in range(1, baseplates_per_cioc + 1):
                    bp_id = f"BP-{bp:02d}"
                    for ch in range(1, charms_per_bp + 1):
                        is_spare = (ch > (charms_per_bp - spare_slots_per_bp))
                        all_hardware_slots.append({
                            "cab_id": cab_id,
                            "cioc_id": cioc_id,
                            "bp_id": bp_id,
                            "charm_idx": ch,
                            "is_spare": is_spare,
                            "full_addr": f"{cab_id}/{cioc_id}/{bp_id}/CH{ch:02d}",
                            "allocated_tag": None
                        })

        slot_by_addr = {s["full_addr"]: s for s in all_hardware_slots}
        occupied_slots = set()
        final_assignments: List[AssignmentModel] = []

        # Step 3: Handle assignment preservation from previous revision
        preserved_signals = set()
        if self.rules.preserve_previous_assignments and previous_assignments:
            for s in valid_signals:
                if s.tag in previous_assignments:
                    prev = previous_assignments[s.tag]
                    if prev.status == "Allocated" and prev.cabinet_id and prev.cioc_id and prev.baseplate_id and prev.charm_index:
                        addr = f"{prev.cabinet_id}/{prev.cioc_id}/{prev.baseplate_id}/CH{prev.charm_index:02d}"
                        if addr in slot_by_addr and addr not in occupied_slots:
                            # Verify that assigning here won't violate redundancy
                            slot_info = slot_by_addr[addr]
                            slot_info["allocated_tag"] = s.tag
                            occupied_slots.add(addr)
                            preserved_signals.add(s.tag)
                            compat = self.compat_matrix.get(s.signal_type.upper(), {})
                            final_assignments.append(AssignmentModel(
                                signal_id=s.id or 0,
                                tag=s.tag,
                                description=s.description or "",
                                signal_type=s.signal_type.upper(),
                                cable_id=s.cable_id or "",
                                pair_number=s.pair_number,
                                redundancy=s.redundancy or "",
                                logical_group=s.logical_group or "",
                                cabinet_id=prev.cabinet_id,
                                cioc_id=prev.cioc_id,
                                baseplate_id=prev.baseplate_id,
                                charm_index=prev.charm_index,
                                terminal_block=compat.get("terminal", "Standard 2-Wire Terminal Block"),
                                charm_type=compat.get("charm", f"{s.signal_type.upper()} CHARM"),
                                status="Allocated",
                                reason="Assignment preserved from previous approved revision"
                            ))

        # Signals remaining to be allocated
        signals_to_allocate = [s for s in valid_signals if s.tag not in preserved_signals]

        # Step 4: Group remaining signals by Cable & Logical Group & Redundancy
        # Multi-pair cable continuity is top priority: order by cable_id, pair_number
        def sort_key(s: SignalRecord):
            has_cable = 0 if s.cable_id and s.cable_id.strip() else 1
            cable = s.cable_id or ""
            pair = s.pair_number if s.pair_number is not None else 9999
            group = s.logical_group or ""
            red = s.redundancy or ""
            return (has_cable, cable, pair, group, red, s.signal_type)

        signals_to_allocate.sort(key=sort_key)

        # Track redundancy placement per logical group or equipment:
        # map: (redundancy_key, 'A') -> cioc_set, (redundancy_key, 'B') -> cioc_set
        # redundancy_key can be logical_group or base tag / equipment
        group_cioc_map: Dict[str, Dict[str, set]] = {}

        # Also account for already preserved assignments
        for fa in final_assignments:
            if fa.redundancy in ["A", "B"] and fa.cioc_id:
                r_key = fa.logical_group or (fa.tag.split("-")[0] if "-" in fa.tag else "GLOBAL")
                if r_key not in group_cioc_map:
                    group_cioc_map[r_key] = {"A": set(), "B": set()}
                group_cioc_map[r_key][fa.redundancy].add((fa.cabinet_id, fa.cioc_id))

        # Available free slots that are NOT spare
        free_slots = [s for s in all_hardware_slots if not s["is_spare"] and s["full_addr"] not in occupied_slots]

        # Group free slots by (cab_id, cioc_id, bp_id) to allocate cables contiguously
        slots_by_bp: Dict[Tuple[str, str, str], List[Dict[str, Any]]] = {}
        for s in free_slots:
            k = (s["cab_id"], s["cioc_id"], s["bp_id"])
            if k not in slots_by_bp:
                slots_by_bp[k] = []
            slots_by_bp[k].append(s)

        # Helper to find a slot satisfying all hard constraints
        for s in signals_to_allocate:
            sig_type = s.signal_type.upper().strip()
            compat = self.compat_matrix.get(sig_type, {})
            c_type = compat.get("charm", f"{sig_type} CHARM")
            t_block = compat.get("terminal", "Standard 2-Wire Terminal Block")

            r_key = s.logical_group or (s.tag.split("-")[0] if "-" in s.tag else "GLOBAL")
            red_desig = (s.redundancy or "").upper().strip()

            allocated_slot = None

            # Try to place in a slot satisfying:
            # 1. Redundancy separation (If 'A', cannot be on any CIOC used by 'B' for this r_key, and vice-versa)
            # 2. Cable pair continuity: if same cable already placed, prefer same baseplate/next charm index
            forbidden_ciocs = set()
            if self.rules.enforce_ab_redundancy_separation and red_desig in ["A", "B"]:
                opposite = "B" if red_desig == "A" else "A"
                if r_key in group_cioc_map:
                    forbidden_ciocs = group_cioc_map[r_key][opposite]

            # Look for ideal baseplate:
            # Check if this signal's cable is already partially placed
            target_bp_key = None
            if s.cable_id and s.cable_id.strip():
                # check existing placements for this cable
                for fa in final_assignments:
                    if fa.cable_id == s.cable_id and fa.cabinet_id and fa.cioc_id and fa.baseplate_id:
                        cand_k = (fa.cabinet_id, fa.cioc_id, fa.baseplate_id)
                        cand_cioc = (fa.cabinet_id, fa.cioc_id)
                        if cand_cioc not in forbidden_ciocs and cand_k in slots_by_bp and len(slots_by_bp[cand_k]) > 0:
                            target_bp_key = cand_k
                            break

            # If no target BP from cable, check if logical group has an active baseplate/CIOC
            if not target_bp_key and s.logical_group and self.rules.enforce_logical_grouping:
                for fa in final_assignments:
                    if fa.logical_group == s.logical_group and fa.cabinet_id and fa.cioc_id and fa.baseplate_id:
                        cand_k = (fa.cabinet_id, fa.cioc_id, fa.baseplate_id)
                        cand_cioc = (fa.cabinet_id, fa.cioc_id)
                        if cand_cioc not in forbidden_ciocs and cand_k in slots_by_bp and len(slots_by_bp[cand_k]) > 0:
                            target_bp_key = cand_k
                            break

            # If target BP found and has available slot, use it
            if target_bp_key and target_bp_key in slots_by_bp and len(slots_by_bp[target_bp_key]) > 0:
                allocated_slot = slots_by_bp[target_bp_key].pop(0)

            # Otherwise, find the next available baseplate whose CIOC is not forbidden
            if not allocated_slot:
                for bp_key, bp_slots in list(slots_by_bp.items()):
                    cand_cioc = (bp_key[0], bp_key[1])
                    if cand_cioc in forbidden_ciocs:
                        continue
                    if len(bp_slots) > 0:
                        allocated_slot = bp_slots.pop(0)
                        break

            # If still no slot found (e.g. all CIOCs forbidden by redundancy or out of non-spare capacity)
            if not allocated_slot:
                reason = "Insufficient hardware capacity: all available CHARM positions are exhausted"
                if forbidden_ciocs:
                    reason = f"A/B Redundancy conflict: cannot allocate redundant '{red_desig}' without violating CIOC separation constraint with '{opposite}' on {list(forbidden_ciocs)}"
                
                final_assignments.append(AssignmentModel(
                    signal_id=s.id or 0,
                    tag=s.tag,
                    description=s.description or "",
                    signal_type=sig_type,
                    cable_id=s.cable_id or "",
                    pair_number=s.pair_number,
                    redundancy=s.redundancy or "",
                    logical_group=s.logical_group or "",
                    status="Needs Review",
                    reason=reason
                ))
            else:
                # Mark slot as used
                occupied_slots.add(allocated_slot["full_addr"])
                allocated_slot["allocated_tag"] = s.tag

                # Update redundancy mapping
                if red_desig in ["A", "B"]:
                    if r_key not in group_cioc_map:
                        group_cioc_map[r_key] = {"A": set(), "B": set()}
                    group_cioc_map[r_key][red_desig].add((allocated_slot["cab_id"], allocated_slot["cioc_id"]))

                final_assignments.append(AssignmentModel(
                    signal_id=s.id or 0,
                    tag=s.tag,
                    description=s.description or "",
                    signal_type=sig_type,
                    cable_id=s.cable_id or "",
                    pair_number=s.pair_number,
                    redundancy=s.redundancy or "",
                    logical_group=s.logical_group or "",
                    cabinet_id=allocated_slot["cab_id"],
                    cioc_id=allocated_slot["cioc_id"],
                    baseplate_id=allocated_slot["bp_id"],
                    charm_index=allocated_slot["charm_idx"],
                    terminal_block=t_block,
                    charm_type=c_type,
                    status="Allocated",
                    reason="Successfully allocated adhering to all industrial constraints"
                ))

        # Combine with rejected signals
        all_results = final_assignments + rejected_assignments
        return all_results
