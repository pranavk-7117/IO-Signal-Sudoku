import math
from typing import List, Dict, Any, Optional
from models import (
    HardwareConfigModel, AssignmentModel,
    UtilisationSummaryModel, CabinetUtilisationModel, CIOCUtilisationModel,
    BaseplateUtilisationModel, CharmSlotModel
)

def extract_bp_num(bp_id: Optional[str]) -> int:
    if not bp_id:
        return 1
    if "-CBP-" in bp_id:
        try:
            return int(bp_id.split("-CBP-")[-1])
        except ValueError:
            pass
    import re
    m = re.search(r'(\d+)$', str(bp_id).strip())
    if m:
        return int(m.group(1))
    return 1

class UtilisationCalculator:
    @staticmethod
    def calculate_utilisation(
        config: HardwareConfigModel,
        assignments: List[AssignmentModel]
    ) -> UtilisationSummaryModel:
        total_cabs = max(1, config.cabinets_count)
        ciocs_per_cab = max(1, config.ciocs_per_cabinet or 4)
        bps_per_cioc = max(1, config.baseplates_per_cioc or 8)
        charms_per_bp = max(1, config.charms_per_baseplate or 12)
        spare_pct = config.spare_percentage

        spare_slots_per_bp = max(1, int(math.ceil(charms_per_bp * (spare_pct / 100.0)))) if spare_pct > 0 else 0
        spare_threshold = charms_per_bp - spare_slots_per_bp

        # 1. Discover actual cabinets present in assignments or use configured defaults
        cabs_in_assignments: List[str] = []
        for a in assignments:
            c = a.cabinet_id or a.system_cabinet
            if c and c not in cabs_in_assignments and c != "-":
                cabs_in_assignments.append(c)

        if not cabs_in_assignments:
            ordered_cabinets = [f"CAB-{c:02d}" for c in range(1, total_cabs + 1)]
        else:
            ordered_cabinets = list(cabs_in_assignments)
            if len(ordered_cabinets) < total_cabs:
                for c in range(len(ordered_cabinets) + 1, total_cabs + 1):
                    ordered_cabinets.append(f"CAB-{c:02d}")

        # 2. Build multi-key allocation map for flexible, fail-safe slot lookup
        alloc_map: Dict[str, AssignmentModel] = {}
        allocated_count = 0
        unallocated_count = 0

        for a in assignments:
            if a.status == "Allocated" and (a.baseplate_id or a.charm_index):
                bp_num = extract_bp_num(a.baseplate_id)
                ch = a.charm_index or a.channel_no or 1
                allocated_count += 1

                cab_keys = [a.cabinet_id, a.system_cabinet]
                cab_val = a.cabinet_id or a.system_cabinet
                if cab_val in ordered_cabinets:
                    c_idx = ordered_cabinets.index(cab_val) + 1
                    cab_keys.append(f"CAB-{c_idx:02d}")

                cioc_keys = [a.cioc_id]
                import re
                if a.cioc_id:
                    cioc_m = re.search(r'(\d+)$', a.cioc_id)
                    if cioc_m:
                        cioc_num = int(cioc_m.group(1))
                        cioc_keys.append(f"CIOC-{cioc_num:02d}")

                bp_keys = [a.baseplate_id, f"BP-{bp_num:02d}", str(bp_num)]

                for ck in set(cab_keys):
                    if not ck:
                        continue
                    for cik in set(cioc_keys):
                        if not cik:
                            continue
                        for bpk in set(bp_keys):
                            if not bpk:
                                continue
                            alloc_map[f"{ck}/{cik}/{bpk}/{ch}"] = a
            else:
                unallocated_count += 1

        # 3. Build hierarchical utilization structure
        cabinets_list: List[CabinetUtilisationModel] = []
        used_cabs = 0
        used_ciocs_total = 0
        used_bps_total = 0

        actual_total_cabs = len(ordered_cabinets)
        total_charm_positions = actual_total_cabs * ciocs_per_cab * bps_per_cioc * charms_per_bp
        reserved_spare_positions = actual_total_cabs * ciocs_per_cab * bps_per_cioc * spare_slots_per_bp

        for c_idx, cab_id in enumerate(ordered_cabinets, start=1):
            cab_used_slots = 0
            cab_used_ciocs = 0
            ciocs_list: List[CIOCUtilisationModel] = []

            # Discover CIOCs belonging to this cabinet
            cab_ciocs: List[str] = []
            for a in assignments:
                if (a.cabinet_id == cab_id or a.system_cabinet == cab_id) and a.cioc_id:
                    if a.cioc_id not in cab_ciocs:
                        cab_ciocs.append(a.cioc_id)

            # If DeltaV naming pattern detected or insufficient CIOCs discovered, complete to ciocs_per_cab
            if not cab_ciocs:
                cab_ciocs = [f"CIOC-{(c_idx - 1) * ciocs_per_cab + ci:02d}" for ci in range(1, ciocs_per_cab + 1)]
            elif len(cab_ciocs) < ciocs_per_cab:
                start_seq = len(cab_ciocs) + 1
                for ci in range(start_seq, ciocs_per_cab + 1):
                    cab_ciocs.append(f"CIOC-{(c_idx - 1) * ciocs_per_cab + ci:02d}")

            for ci_idx, cioc_id in enumerate(cab_ciocs, start=1):
                cioc_used_slots = 0
                cioc_used_bps = 0
                bps_list: List[BaseplateUtilisationModel] = []

                # Baseplate prefix determination (e.g. "001-CBP-" vs "BP-")
                import re
                seq_match = re.search(r'(\d+)$', cioc_id)
                cioc_seq_num = (int(seq_match.group(1)) % 1000) if seq_match else ((c_idx - 1) * ciocs_per_cab + ci_idx)
                is_official_format = ("-DCS-" in cab_id) or ("CIOC" in cioc_id and len(cioc_id) > 8)

                for bp in range(1, bps_per_cioc + 1):
                    if is_official_format:
                        bp_id = f"{cioc_seq_num:03d}-CBP-{bp}"
                    else:
                        bp_id = f"BP-{bp:02d}"

                    bp_used_slots = 0
                    slots_list: List[CharmSlotModel] = []

                    for ch in range(1, charms_per_bp + 1):
                        is_spare = (ch > spare_threshold) and (spare_pct > 0)
                        
                        # Lookup across aliases
                        candidate_keys = [
                            f"{cab_id}/{cioc_id}/{bp_id}/{ch}",
                            f"{cab_id}/{cioc_id}/{bp}/{ch}",
                            f"{cab_id}/{cioc_id}/BP-{bp:02d}/{ch}",
                            f"CAB-{c_idx:02d}/{cioc_id}/{bp_id}/{ch}",
                            f"CAB-{c_idx:02d}/CIOC-{ci_idx:02d}/BP-{bp:02d}/{ch}"
                        ]
                        a = None
                        for k in candidate_keys:
                            if k in alloc_map:
                                a = alloc_map[k]
                                break

                        if a:
                            bp_used_slots += 1
                            slots_list.append(CharmSlotModel(
                                charm_index=ch,
                                is_allocated=True,
                                is_spare=is_spare,
                                signal_tag=a.tag,
                                signal_type=a.signal_type,
                                charm_type=a.charm_type or a.charm_part_no,
                                terminal_block=a.terminal_block or a.charm_tb_part_no,
                                cable_id=a.cable_id or a.field_cable_no,
                                pair_number=a.pair_number,
                                cable_size=a.field_cable_size,
                                redundancy=a.segregation or (a.custom_attributes.get("redundancy") if a.custom_attributes else None),
                                loop_name=a.loop_name
                            ))
                        else:
                            slots_list.append(CharmSlotModel(
                                charm_index=ch,
                                is_allocated=False,
                                is_spare=is_spare,
                                signal_tag=None,
                                signal_type=None,
                                charm_type=None,
                                terminal_block=None
                            ))

                    if bp_used_slots > 0:
                        cioc_used_bps += 1

                    cioc_used_slots += bp_used_slots
                    free_bp_slots = max(0, (charms_per_bp - spare_slots_per_bp) - bp_used_slots)

                    bps_list.append(BaseplateUtilisationModel(
                        baseplate_id=bp_id,
                        total_slots=charms_per_bp,
                        used_slots=bp_used_slots,
                        reserved_spare_slots=spare_slots_per_bp,
                        free_slots=free_bp_slots,
                        slots=slots_list
                    ))

                if cioc_used_slots > 0:
                    cab_used_ciocs += 1
                    used_bps_total += cioc_used_bps

                cab_used_slots += cioc_used_slots
                cioc_total_slots = bps_per_cioc * charms_per_bp
                cioc_reserved_spares = bps_per_cioc * spare_slots_per_bp
                cioc_free_slots = max(0, (cioc_total_slots - cioc_reserved_spares) - cioc_used_slots)
                cioc_util_pct = round((cioc_used_slots / max(1, cioc_total_slots - cioc_reserved_spares)) * 100.0, 1)

                ciocs_list.append(CIOCUtilisationModel(
                    cioc_id=cioc_id,
                    cabinet_id=cab_id,
                    total_baseplates=bps_per_cioc,
                    used_baseplates=cioc_used_bps,
                    total_slots=cioc_total_slots,
                    used_slots=cioc_used_slots,
                    reserved_spare_slots=cioc_reserved_spares,
                    free_slots=cioc_free_slots,
                    utilization_pct=cioc_util_pct,
                    baseplates=bps_list
                ))

            if cab_used_slots > 0:
                used_cabs += 1
                used_ciocs_total += cab_used_ciocs

            cab_total_slots = ciocs_per_cab * bps_per_cioc * charms_per_bp
            cab_reserved_spares = ciocs_per_cab * bps_per_cioc * spare_slots_per_bp
            cab_free_slots = max(0, (cab_total_slots - cab_reserved_spares) - cab_used_slots)
            cab_util_pct = round((cab_used_slots / max(1, cab_total_slots - cab_reserved_spares)) * 100.0, 1)

            cabinets_list.append(CabinetUtilisationModel(
                cabinet_id=cab_id,
                total_ciocs=ciocs_per_cab,
                used_ciocs=cab_used_ciocs,
                total_slots=cab_total_slots,
                used_slots=cab_used_slots,
                reserved_spare_slots=cab_reserved_spares,
                free_slots=cab_free_slots,
                utilization_pct=cab_util_pct,
                ciocs=ciocs_list
            ))

        free_unreserved = max(0, (total_charm_positions - reserved_spare_positions) - allocated_count)
        overall_util = round((allocated_count / max(1, total_charm_positions - reserved_spare_positions)) * 100.0, 1)
        spare_achieved = round((reserved_spare_positions / max(1, total_charm_positions)) * 100.0, 1)

        return UtilisationSummaryModel(
            total_cabinets=actual_total_cabs,
            used_cabinets=used_cabs,
            total_ciocs=actual_total_cabs * ciocs_per_cab,
            used_ciocs=used_ciocs_total,
            total_baseplates=actual_total_cabs * ciocs_per_cab * bps_per_cioc,
            used_baseplates=used_bps_total,
            total_charm_positions=total_charm_positions,
            allocated_signals=allocated_count,
            unallocated_signals=unallocated_count,
            reserved_spare_positions=reserved_spare_positions,
            free_unreserved_positions=free_unreserved,
            overall_utilisation_pct=overall_util,
            spare_capacity_achieved_pct=spare_achieved,
            cabinets=cabinets_list
        )

    # Convenience alias
    calculate = calculate_utilisation
