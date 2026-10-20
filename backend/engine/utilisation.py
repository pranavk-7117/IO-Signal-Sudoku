import math
from typing import List, Dict, Any
from models import (
    HardwareConfigModel, AssignmentModel,
    UtilisationSummaryModel, CabinetUtilisationModel, CIOCUtilisationModel,
    BaseplateUtilisationModel, CharmSlotModel
)

class UtilisationCalculator:
    @staticmethod
    def calculate_utilisation(
        config: HardwareConfigModel,
        assignments: List[AssignmentModel]
    ) -> UtilisationSummaryModel:
        total_cabs = config.cabinets_count
        ciocs_per_cab = config.ciocs_per_cabinet
        bps_per_cioc = config.baseplates_per_cioc
        charms_per_bp = config.charms_per_baseplate
        spare_pct = config.spare_percentage

        spare_slots_per_bp = max(1, int(math.ceil(charms_per_bp * (spare_pct / 100.0)))) if spare_pct > 0 else 0
        spare_threshold = charms_per_bp - spare_slots_per_bp

        # Map of allocated assignments by hardware address
        # key: (cab_id, cioc_id, bp_id, charm_index) -> AssignmentModel
        alloc_map: Dict[str, AssignmentModel] = {}
        allocated_count = 0
        unallocated_count = 0

        for a in assignments:
            if a.status == "Allocated" and a.cabinet_id and a.cioc_id and a.baseplate_id and a.charm_index:
                addr = f"{a.cabinet_id}/{a.cioc_id}/{a.baseplate_id}/{a.charm_index}"
                alloc_map[addr] = a
                allocated_count += 1
            else:
                unallocated_count += 1

        cabinets_list: List[CabinetUtilisationModel] = []
        used_cabs = 0
        used_ciocs_total = 0
        used_bps_total = 0
        total_charm_positions = total_cabs * ciocs_per_cab * bps_per_cioc * charms_per_bp
        reserved_spare_positions = total_cabs * ciocs_per_cab * bps_per_cioc * spare_slots_per_bp

        for c in range(1, total_cabs + 1):
            cab_id = f"CAB-{c:02d}"
            cab_used_slots = 0
            cab_used_ciocs = 0
            ciocs_list: List[CIOCUtilisationModel] = []

            for ci in range(1, ciocs_per_cab + 1):
                cioc_id = f"CIOC-{ci:02d}"
                cioc_used_slots = 0
                cioc_used_bps = 0
                bps_list: List[BaseplateUtilisationModel] = []

                for bp in range(1, bps_per_cioc + 1):
                    bp_id = f"BP-{bp:02d}"
                    bp_slots: List[CharmSlotModel] = []
                    bp_used = 0

                    for ch in range(1, charms_per_bp + 1):
                        is_spare = (ch > spare_threshold) if spare_slots_per_bp > 0 else False
                        addr = f"{cab_id}/{cioc_id}/{bp_id}/{ch}"
                        assigned_sig = alloc_map.get(addr)

                        if assigned_sig:
                            bp_used += 1
                            bp_slots.append(CharmSlotModel(
                                charm_index=ch,
                                is_allocated=True,
                                is_spare=is_spare,
                                signal_tag=assigned_sig.tag,
                                signal_type=assigned_sig.signal_type,
                                charm_type=assigned_sig.charm_type,
                                terminal_block=assigned_sig.terminal_block
                            ))
                        else:
                            bp_slots.append(CharmSlotModel(
                                charm_index=ch,
                                is_allocated=False,
                                is_spare=is_spare,
                                signal_tag=None,
                                signal_type=None,
                                charm_type=None,
                                terminal_block=None
                            ))

                    if bp_used > 0:
                        cioc_used_bps += 1

                    cioc_used_slots += bp_used
                    bp_free = charms_per_bp - bp_used - spare_slots_per_bp
                    bps_list.append(BaseplateUtilisationModel(
                        baseplate_id=bp_id,
                        total_slots=charms_per_bp,
                        used_slots=bp_used,
                        reserved_spare_slots=spare_slots_per_bp,
                        free_slots=max(0, bp_free),
                        slots=bp_slots
                    ))

                if cioc_used_slots > 0:
                    cab_used_ciocs += 1
                    used_ciocs_total += 1

                used_bps_total += cioc_used_bps
                cab_used_slots += cioc_used_slots
                cioc_total_slots = bps_per_cioc * charms_per_bp
                cioc_spare_slots = bps_per_cioc * spare_slots_per_bp
                ciocs_list.append(CIOCUtilisationModel(
                    cioc_id=cioc_id,
                    cabinet_id=cab_id,
                    total_baseplates=bps_per_cioc,
                    used_baseplates=cioc_used_bps,
                    total_slots=cioc_total_slots,
                    used_slots=cioc_used_slots,
                    reserved_spare_slots=cioc_spare_slots,
                    free_slots=max(0, cioc_total_slots - cioc_used_slots - cioc_spare_slots),
                    utilization_pct=round((cioc_used_slots / float(cioc_total_slots)) * 100.0, 1),
                    baseplates=bps_list
                ))

            if cab_used_slots > 0:
                used_cabs += 1

            cab_total_slots = ciocs_per_cab * bps_per_cioc * charms_per_bp
            cab_spare_slots = ciocs_per_cab * bps_per_cioc * spare_slots_per_bp
            cabinets_list.append(CabinetUtilisationModel(
                cabinet_id=cab_id,
                total_ciocs=ciocs_per_cab,
                used_ciocs=cab_used_ciocs,
                total_slots=cab_total_slots,
                used_slots=cab_used_slots,
                reserved_spare_slots=cab_spare_slots,
                free_slots=max(0, cab_total_slots - cab_used_slots - cab_spare_slots),
                utilization_pct=round((cab_used_slots / float(cab_total_slots)) * 100.0, 1),
                ciocs=ciocs_list
            ))

        free_unreserved = max(0, total_charm_positions - allocated_count - reserved_spare_positions)
        overall_util_pct = round((allocated_count / float(total_charm_positions)) * 100.0, 1) if total_charm_positions > 0 else 0.0
        spare_achieved_pct = round((reserved_spare_positions / float(total_charm_positions)) * 100.0, 1) if total_charm_positions > 0 else 0.0

        return UtilisationSummaryModel(
            total_cabinets=total_cabs,
            used_cabinets=used_cabs,
            total_ciocs=total_cabs * ciocs_per_cab,
            used_ciocs=used_ciocs_total,
            total_baseplates=total_cabs * ciocs_per_cab * bps_per_cioc,
            used_baseplates=used_bps_total,
            total_charm_positions=total_charm_positions,
            allocated_signals=allocated_count,
            unallocated_signals=unallocated_count,
            reserved_spare_positions=reserved_spare_positions,
            free_unreserved_positions=free_unreserved,
            overall_utilisation_pct=overall_util_pct,
            spare_capacity_achieved_pct=spare_achieved_pct,
            cabinets=cabinets_list
        )
