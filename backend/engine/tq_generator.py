from typing import List, Dict, Any
from models import ValidationIssueModel, AssignmentModel, SignalRecord

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
        Avoids duplicates by generating deterministic TQ codes.
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

                generated_tqs.append({
                    "tq_code": tq_code,
                    "project_id": project_id,
                    "revision_id": revision_id,
                    "category": category,
                    "description": issue.message,
                    "root_cause": f"Validation rule '{issue.rule_name}' failed for signal(s): {', '.join(issue.affected_tags)}.",
                    "specific_clarification": f"Please clarify whether engineering exception is granted or provide corrected tag attributes/hardware configuration for {', '.join(issue.affected_tags)}.",
                    "suggested_action": issue.suggested_action,
                    "affected_tags": issue.affected_tags
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

            generated_tqs.append({
                "tq_code": tq_code,
                "project_id": project_id,
                "revision_id": revision_id,
                "category": "Unresolved Allocation",
                "description": f"Signal '{ua.tag}' ({ua.signal_type}) could not be assigned to control system hardware.",
                "root_cause": ua.reason or "Hardware capacity limit reached or constraint conflict prevented automated allocation.",
                "specific_clarification": f"Confirm if additional CHARM baseplate hardware should be added or if signal '{ua.tag}' can be assigned to another cabinet.",
                "suggested_action": "Review hardware layout in Rules & Hardware page or verify IO list.",
                "affected_tags": [ua.tag]
            })

        return generated_tqs
