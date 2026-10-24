from typing import List, Dict, Any
from models import ValidationIssueModel, AssignmentModel, SignalRecord
from engine.priority_classifier import PriorityClassifier

class TQGenerator:
    @staticmethod
    def generate_tqs_from_validation(
        project_id: int,
        revision_id: int,
        issues: List[ValidationIssueModel],
        assignments: List[AssignmentModel]
    ) -> List[Dict[str, Any]]:
        """
        Transforms blocking validation errors and unresolved allocation assignments into formal Technical Queries (TQs).
        Avoids duplicates by generating deterministic TQ codes and assigns 3-tier industrial priorities.
        """
        generated_tqs = []
        seen_keys = set()
        tq_idx = 1

        # Process blocking validation errors
        for issue in issues:
            if issue.severity == "ERROR":
                # Create a deterministic key
                tag_key = "_".join(sorted(issue.affected_tags))
                dedup_key = f"{issue.rule_name}_{tag_key}"
                if dedup_key in seen_keys:
                    continue
                seen_keys.add(dedup_key)

                category = "General Engineering"
                if "Redundancy" in issue.rule_name:
                    category = "Redundancy Segregation"
                elif "Capacity" in issue.rule_name or "Occupancy" in issue.rule_name:
                    category = "Hardware Capacity"
                elif "Compatibility" in issue.rule_name:
                    category = "Signal Compatibility"
                elif "Mandatory" in issue.rule_name or "Tagging" in issue.rule_name:
                    category = "Missing Information"
                elif "Cable" in issue.rule_name:
                    category = "Cable Continuity"

                tq_code = f"TQ-{project_id:02d}-{tq_idx:03d}"
                tq_idx += 1

                root_cause = f"Validation rule '{issue.rule_name}' failed for signal(s): {', '.join(issue.affected_tags)}."
                p_info = PriorityClassifier.classify_tq(
                    category=category,
                    description=issue.message,
                    root_cause=root_cause,
                    suggested_action=issue.suggested_action
                )

                generated_tqs.append({
                    "tq_code": tq_code,
                    "project_id": project_id,
                    "revision_id": revision_id,
                    "category": category,
                    "description": issue.message,
                    "root_cause": root_cause,
                    "specific_clarification": f"Please clarify whether engineering exception is granted or provide corrected tag attributes/hardware configuration for {', '.join(issue.affected_tags)}.",
                    "suggested_action": issue.suggested_action,
                    "affected_tags": issue.affected_tags,
                    "priority": p_info["priority"],
                    "priority_label": p_info["priority_label"],
                    "impact_score": p_info["impact_score"],
                    "impact_description": p_info["impact_description"],
                    "recommended_remedy": p_info["recommended_remedy"]
                })

        # Process any unallocated signals that didn't generate an error
        unallocated_assignments = [a for a in assignments if a.status in ["Blocked", "Needs Review"]]
        for ua in unallocated_assignments:
            dedup_key = f"UNALLOC_{ua.tag}"
            if dedup_key in seen_keys:
                continue
            seen_keys.add(dedup_key)

            tq_code = f"TQ-{project_id:02d}-{tq_idx:03d}"
            tq_idx += 1

            desc = f"Signal '{ua.tag}' ({ua.signal_type}) could not be assigned to control system hardware."
            rc = ua.reason or "Hardware capacity limit reached or constraint conflict prevented automated allocation."
            sugg = "Review hardware layout in Rules & Hardware page or verify IO list."

            p_info = PriorityClassifier.classify_tq(
                category="Unresolved Allocation",
                description=desc,
                root_cause=rc,
                suggested_action=sugg
            )

            generated_tqs.append({
                "tq_code": tq_code,
                "project_id": project_id,
                "revision_id": revision_id,
                "category": "Unresolved Allocation",
                "description": desc,
                "root_cause": rc,
                "specific_clarification": f"Confirm if additional CHARM baseplate hardware should be added or if signal '{ua.tag}' can be assigned to another cabinet.",
                "suggested_action": sugg,
                "affected_tags": [ua.tag],
                "priority": p_info["priority"],
                "priority_label": p_info["priority_label"],
                "impact_score": p_info["impact_score"],
                "impact_description": p_info["impact_description"],
                "recommended_remedy": p_info["recommended_remedy"]
            })

        # Sort TQs by impact_score descending (most critical blockers first)
        generated_tqs.sort(key=lambda t: t.get("impact_score", 0), reverse=True)
        return generated_tqs
