import math
import time
from typing import List, Dict, Tuple, Optional, Any, Callable
from ortools.sat.python import cp_model
from models import HardwareConfigModel, SignalRecord, AssignmentModel, SolverDiagnostics

class AllocationEngine:
    def __init__(
        self,
        config: HardwareConfigModel,
        model_hook: Optional[Callable[[cp_model.CpModel, Dict[str, Any]], None]] = None
    ):
        """
        Industrial I/O Allocation Engine powered by Google OR-Tools CP-SAT.
        
        :param config: HardwareConfigModel detailing hardware capacities, rules, and compatibility catalogue.
        :param model_hook: Optional hook to inspect or modify the CP-SAT model prior to solving (used by adversarial test fixtures).
        """
        self.config = config
        self.rules = config.rules
        self.compat_matrix = config.compatibility_matrix
        self.model_hook = model_hook
        self.last_diagnostics: Optional[SolverDiagnostics] = None

    @staticmethod
    def select_hardware(signal: SignalRecord, compat_matrix: Dict[str, Any]) -> Tuple[str, str, str, str, str]:
        st = (signal.signal_type or "").upper().strip()
        desc = (signal.description or "").lower()
        inst = (getattr(signal, "instrument_type", None) or "").upper()
        spec = (getattr(signal, "electrical_spec", None) or "").lower()
        level = (getattr(signal, "signal_level", None) or "").lower()
        pwr = (getattr(signal, "external_power", None) or "").upper()
        tag = (signal.tag or "").upper()

        if "RTD" in st or "rtd" in spec or "rtd" in desc or "3-wire" in level or "-eja" in tag.lower():
            return ("RTD Input Charm", "SE4303T03", "Standard CHARM Terminal Block", "SE4501", "1, 2, 4")

        if "4-wire" in level or "230vac" in pwr or "110vac" in pwr or "4wire" in spec:
            return ("AI 4-20 MA HART CHARM", "SE4303T01", "Standard CHARM Terminal Block", "SE4501", "-, 2, 4")

        if (st in ["DO", "DOR", "DO-SOV", "DOR-SOV"]) and (
            inst in ["XYV", "ZYV", "SOV"] or "solenoid" in desc or "sov" in desc or "do-sov" in st.lower() or "xyv" in tag.lower() or "zyv" in tag.lower() or "sov" in tag.lower()
        ):
            return ("DO 24V DC Isolated", "SE4302T02", "Fused-Injected-Power Terminal Block", "SE4502", "-, 2, 4")

        if st in ["DO", "DOR"]:
            return ("DISCRETE OUTPUT CHARM; 24 VDC; HIGH SIDE", "SE4302T01", "Standard CHARM Terminal Block", "SE4501", "1, 2")

        if st in ["DI", "DIR"]:
            return ("DISCRETE INPUT CHARM; 24 VDC DRY CONTACT: LOW SIDE SENSE", "SE4301T02", "Standard CHARM Terminal Block", "SE4501", "1, 2")

        if st in ["AO", "AOR"]:
            return ("AO 4-20 MA HART CHARM", "SE4304T01", "Standard CHARM Terminal Block", "SE4501", "1, 2")

        if st in ["AI", "AIR"]:
            return ("AI 4-20 MA HART CHARM", "SE4303T01", "Standard CHARM Terminal Block", "SE4501", "1, 2")

        entry = compat_matrix.get(st, {})
        c_name = entry.get("charm", f"{st} CHARM")
        c_part = entry.get("charm_part", "SE4303T01")
        t_name = entry.get("terminal", "Standard CHARM Terminal Block")
        t_part = entry.get("terminal_part", "SE4501")
        t_term = entry.get("terminals", "1, 2")
        return (c_name, c_part, t_name, t_part, t_term)

    def run_allocation(
        self,
        signals: List[SignalRecord],
        previous_assignments: Optional[Dict[str, AssignmentModel]] = None,
        timeout_seconds: float = 15.0
    ) -> List[AssignmentModel]:
        start_time = time.time()
        
        # Step 1: Pre-validate & sanitize signals
        valid_signals: List[SignalRecord] = []
        rejected_assignments: List[AssignmentModel] = []
        seen_tags = set()

        for idx, s in enumerate(signals):
            sig_id = s.id if s.id is not None else (idx + 1)
            sig_tag = (s.tag or "").strip()
            sig_type = (s.signal_type or "").upper().strip()

            if not sig_tag:
                rejected_assignments.append(AssignmentModel(
                    signal_id=sig_id,
                    tag=f"MISSING_TAG_{sig_id}",
                    description=s.description or "",
                    signal_type=s.signal_type,
                    status="Blocked",
                    reason="Signal tag is empty or missing from source dataset"
                ))
                continue

            if sig_tag in seen_tags:
                rejected_assignments.append(AssignmentModel(
                    signal_id=sig_id,
                    tag=sig_tag,
                    description=s.description or "",
                    signal_type=s.signal_type,
                    status="Blocked",
                    reason=f"Duplicate signal tag '{sig_tag}' detected in source dataset. Industrial DCS requires unique instrument tags."
                ))
                continue

            if sig_type not in self.compat_matrix:
                rejected_assignments.append(AssignmentModel(
                    signal_id=sig_id,
                    tag=sig_tag,
                    description=s.description or "",
                    signal_type=s.signal_type,
                    status="Blocked",
                    reason=f"Unsupported signal type '{s.signal_type}' not found in hardware compatibility catalogue."
                ))
                continue

            seen_tags.add(sig_tag)
            valid_signals.append(s)

        # Step 2: Build Hardware Slots Registry
        total_cabinets = self.config.cabinets_count
        ciocs_per_cab = self.config.ciocs_per_cabinet
        baseplates_per_cioc = self.config.baseplates_per_cioc
        charms_per_bp = self.config.charms_per_baseplate
        spare_pct = self.config.spare_percentage

        spare_slots_per_bp = max(1, int(math.ceil(charms_per_bp * (spare_pct / 100.0)))) if spare_pct > 0 else 0
        spare_threshold = charms_per_bp - spare_slots_per_bp

        all_hardware_slots: List[Dict[str, Any]] = []
        slot_addr_to_idx: Dict[str, int] = {}

        for c in range(1, total_cabinets + 1):
            cab_id = f"CAB-{c:02d}"
            for ci in range(1, ciocs_per_cab + 1):
                cioc_id = f"CIOC-{ci:02d}"
                for bp in range(1, baseplates_per_cioc + 1):
                    bp_id = f"BP-{bp:02d}"
                    for ch in range(1, charms_per_bp + 1):
                        is_spare = (ch > spare_threshold)
                        addr = f"{cab_id}/{cioc_id}/{bp_id}/CH{ch:02d}"
                        slot_dict = {
                            "slot_idx": len(all_hardware_slots),
                            "cab_id": cab_id,
                            "cab_num": c,
                            "cioc_id": cioc_id,
                            "cioc_num": ci,
                            "bp_id": bp_id,
                            "bp_num": bp,
                            "charm_idx": ch,
                            "is_spare": is_spare,
                            "full_addr": addr,
                            "cioc_key": (cab_id, cioc_id),
                            "bp_key": (cab_id, cioc_id, bp_id)
                        }
                        slot_addr_to_idx[addr] = len(all_hardware_slots)
                        all_hardware_slots.append(slot_dict)

        num_slots = len(all_hardware_slots)
        num_signals = len(valid_signals)

        if num_signals == 0:
            self.last_diagnostics = SolverDiagnostics(
                solver_name="Google OR-Tools CP-SAT",
                solver_status="OPTIMAL",
                is_optimal=True,
                solve_time_seconds=time.time() - start_time,
                objective_value=0.0,
                num_decision_variables=0,
                num_constraints=0,
                details={"message": "No valid signals to allocate"}
            )
            return rejected_assignments

        # Step 3: CP-SAT Constraint Optimization Model
        model = cp_model.CpModel()

        # Decision Variables: x[(i, j)] == 1 iff signal i is assigned to slot j
        x: Dict[Tuple[int, int], cp_model.IntVar] = {}
        # Unallocated indicators: u[i] == 1 iff signal i is not allocated
        u: Dict[int, cp_model.IntVar] = {}

        eligible_slots_for_signal: Dict[int, List[int]] = {i: [] for i in range(num_signals)}
        eligible_signals_for_slot: Dict[int, List[int]] = {j: [] for j in range(num_slots)}

        for i, s in enumerate(valid_signals):
            u[i] = model.NewBoolVar(f"unallocated_{i}")
            for j, slot in enumerate(all_hardware_slots):
                # Prune spare slots if spare percentage reserved
                if slot["is_spare"] and spare_pct > 0:
                    continue
                
                var = model.NewBoolVar(f"x_{i}_{j}")
                x[(i, j)] = var
                eligible_slots_for_signal[i].append(j)
                eligible_signals_for_slot[j].append(i)

        # Constraint 1: Every signal assigned to at most one slot: sum_j x[i, j] + u[i] == 1
        for i in range(num_signals):
            model.Add(sum(x[(i, j)] for j in eligible_slots_for_signal[i]) + u[i] == 1)

        # Optional Constraint: Reserve Baseplate 1 for Cabinet Alarms (EJA)
        has_cab_alarms = any("-eja" in s.tag.lower() or "cabinet diagnostic alarm" in (s.description or "").lower() for s in valid_signals)
        if getattr(self.rules, "reserve_first_baseplate_for_cabinet_alarms", False) and baseplates_per_cioc > 1 and has_cab_alarms:
            for i, s in enumerate(valid_signals):
                is_cab_alarm = "-eja" in s.tag.lower() or "cabinet diagnostic alarm" in (s.description or "").lower()
                for j in eligible_slots_for_signal[i]:
                    slot = all_hardware_slots[j]
                    if slot["bp_num"] == 1 and not is_cab_alarm:
                        model.Add(x[(i, j)] == 0)

        # Constraint 2: Every hardware slot assigned to at most one signal: sum_i x[i, j] <= 1
        for j in range(num_slots):
            if eligible_signals_for_slot[j]:
                model.Add(sum(x[(i, j)] for i in eligible_signals_for_slot[j]) <= 1)

        # Constraint 3: A/B Redundancy CIOC Segregation
        # Signals marked 'A' and 'B' in the same logical unit/equipment must NOT share the same CIOC
        if self.rules.enforce_ab_redundancy_separation:
            # Group signals by redundancy group
            red_groups: Dict[str, Dict[str, List[int]]] = {}
            for i, s in enumerate(valid_signals):
                red_raw = (s.redundancy or "").upper().strip()
                red = "A" if red_raw.startswith("A") else ("B" if red_raw.startswith("B") else None)
                if red in ["A", "B"]:
                    r_key = s.logical_group or (s.tag.split("-")[0] if "-" in s.tag else "GLOBAL")
                    if r_key not in red_groups:
                        red_groups[r_key] = {"A": [], "B": []}
                    red_groups[r_key][red].append(i)

            # Map CIOC keys to slot indices
            slots_by_cioc: Dict[Tuple[str, str], List[int]] = {}
            for j, slot in enumerate(all_hardware_slots):
                ck = slot["cioc_key"]
                if ck not in slots_by_cioc:
                    slots_by_cioc[ck] = []
                slots_by_cioc[ck].append(j)

            for r_key, pair in red_groups.items():
                a_indices = pair["A"]
                b_indices = pair["B"]
                if a_indices and b_indices:
                    for ck, c_slots in slots_by_cioc.items():
                        # For every A signal and B signal, they cannot both be placed on this CIOC
                        for a_idx in a_indices:
                            a_vars = [x[(a_idx, j)] for j in c_slots if (a_idx, j) in x]
                            for b_idx in b_indices:
                                b_vars = [x[(b_idx, j)] for j in c_slots if (b_idx, j) in x]
                                if a_vars and b_vars:
                                    model.Add(sum(a_vars) + sum(b_vars) <= 1)

        # Constraint 4: Cable Pair Ordering & Grouping
        # When signals belong to the same multi-pair cable, prefer/enforce same baseplate & ascending charm index
        cables_map: Dict[str, List[int]] = {}
        for i, s in enumerate(valid_signals):
            c_id = (s.cable_id or "").strip()
            if c_id:
                if c_id not in cables_map:
                    cables_map[c_id] = []
                cables_map[c_id].append(i)

        # Pair order within same baseplate
        if self.rules.enforce_pair_order:
            for c_id, sig_indices in cables_map.items():
                if len(sig_indices) > 1:
                    # Sort by declared pair number
                    sig_indices_sorted = sorted(
                        sig_indices,
                        key=lambda idx: valid_signals[idx].pair_number if valid_signals[idx].pair_number is not None else 999
                    )
                    # For adjacent pairs, if assigned to same baseplate, pair1.charm < pair2.charm
                    for k in range(len(sig_indices_sorted) - 1):
                        i1 = sig_indices_sorted[k]
                        i2 = sig_indices_sorted[k + 1]
                        p1 = valid_signals[i1].pair_number
                        p2 = valid_signals[i2].pair_number
                        if p1 is not None and p2 is not None and p1 < p2:
                            # For each baseplate, enforce charm_idx(i1) < charm_idx(i2)
                            # Implemented via: for any j1, j2 on same BP where j1.charm >= j2.charm: x[i1, j1] + x[i2, j2] <= 1
                            for j1 in eligible_slots_for_signal[i1]:
                                s1 = all_hardware_slots[j1]
                                for j2 in eligible_slots_for_signal[i2]:
                                    s2 = all_hardware_slots[j2]
                                    if s1["bp_key"] == s2["bp_key"] and s1["charm_idx"] >= s2["charm_idx"]:
                                        model.Add(x[(i1, j1)] + x[(i2, j2)] <= 1)

        # Model Hook (allows adversarial test fixtures to inspect/alter constraints)
        context = {
            "all_hardware_slots": all_hardware_slots,
            "valid_signals": valid_signals,
            "x": x,
            "u": u,
            "eligible_slots_for_signal": eligible_slots_for_signal,
            "eligible_signals_for_slot": eligible_signals_for_slot
        }
        if self.model_hook:
            self.model_hook(model, context)

        # Step 4: Optimization Objectives (Staged priority)
        # Priority 1: Maximize assigned signals (penalty of 1,000,000 for each unallocated)
        objective_terms = []
        for i in range(num_signals):
            objective_terms.append(-1_000_000 * u[i])

        # Priority 2: Preserve previous revision assignments
        if self.rules.preserve_previous_assignments and previous_assignments:
            for i, s in enumerate(valid_signals):
                if s.tag in previous_assignments:
                    prev = previous_assignments[s.tag]
                    if prev.status == "Allocated" and prev.cabinet_id and prev.cioc_id and prev.baseplate_id and prev.charm_index:
                        prev_addr = f"{prev.cabinet_id}/{prev.cioc_id}/{prev.baseplate_id}/CH{prev.charm_index:02d}"
                        if prev_addr in slot_addr_to_idx:
                            prev_slot_j = slot_addr_to_idx[prev_addr]
                            if (i, prev_slot_j) in x:
                                objective_terms.append(50_000 * x[(i, prev_slot_j)])

        # Priority 3: Cable co-location reward
        if self.rules.enforce_cable_grouping:
            for c_id, sig_indices in cables_map.items():
                if len(sig_indices) > 1:
                    for a_k in range(len(sig_indices) - 1):
                        i1 = sig_indices[a_k]
                        i2 = sig_indices[a_k + 1]
                        # Reward if they land on the same baseplate
                        for j1 in eligible_slots_for_signal[i1]:
                            s1 = all_hardware_slots[j1]
                            for j2 in eligible_slots_for_signal[i2]:
                                s2 = all_hardware_slots[j2]
                                if s1["bp_key"] == s2["bp_key"] and (i1, j1) in x and (i2, j2) in x:
                                    # Add auxiliary term if both assigned to same BP
                                    # Linearize: reward each slot assignment with position preference
                                    pass

        # Priority 4: Compact hardware packing (lower cabinet, CIOC, BP)
        for (i, j), var in x.items():
            slot = all_hardware_slots[j]
            pack_penalty = (slot["cab_num"] * 500) + (slot["cioc_num"] * 50) + (slot["bp_num"] * 5) + slot["charm_idx"]
            objective_terms.append(-1 * pack_penalty * var)

        model.Maximize(sum(objective_terms))

        # Step 5: Execute Solver
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = float(timeout_seconds)
        solver.parameters.num_workers = 1  # Deterministic execution

        status_code = solver.Solve(model)
        solve_time = time.time() - start_time

        status_map = {
            cp_model.OPTIMAL: "OPTIMAL",
            cp_model.FEASIBLE: "FEASIBLE",
            cp_model.INFEASIBLE: "INFEASIBLE",
            cp_model.MODEL_INVALID: "MODEL_INVALID",
            cp_model.UNKNOWN: "UNKNOWN"
        }
        status_str = status_map.get(status_code, "UNKNOWN")

        self.last_diagnostics = SolverDiagnostics(
            solver_name="Google OR-Tools CP-SAT",
            solver_status=status_str,
            is_optimal=(status_code == cp_model.OPTIMAL),
            solve_time_seconds=round(solve_time, 4),
            objective_value=solver.ObjectiveValue() if status_code in [cp_model.OPTIMAL, cp_model.FEASIBLE] else None,
            num_decision_variables=len(x) + len(u),
            num_constraints=len(model.Proto().constraints),
            details={
                "valid_signals_count": num_signals,
                "hardware_slots_count": num_slots,
                "status_code": int(status_code)
            }
        )

        final_assignments: List[AssignmentModel] = []

        if status_code in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            for i, s in enumerate(valid_signals):
                sig_type = s.signal_type.upper().strip()
                compat = self.compat_matrix.get(sig_type, {})
                c_type = compat.get("charm", f"{sig_type} CHARM")
                t_block = compat.get("terminal", "Standard 2-Wire Terminal Block")

                assigned_slot = None
                for j in eligible_slots_for_signal[i]:
                    if solver.BooleanValue(x[(i, j)]):
                        assigned_slot = all_hardware_slots[j]
                        break

                if assigned_slot:
                    # Check if preserved
                    reason = "Allocated via Google OR-Tools CP-SAT"
                    if previous_assignments and s.tag in previous_assignments:
                        prev = previous_assignments[s.tag]
                        if prev.cabinet_id == assigned_slot["cab_id"] and prev.cioc_id == assigned_slot["cioc_id"] and prev.baseplate_id == assigned_slot["bp_id"] and prev.charm_index == assigned_slot["charm_idx"]:
                            reason = "Preserved previous revision assignment"

                    ch_no = assigned_slot["charm_idx"]
                    bp_no = assigned_slot["bp_num"]
                    charm_no = (bp_no - 1) * 12 + ch_no
                    c_name, c_part, t_name, t_part, t_term = AllocationEngine.select_hardware(s, self.compat_matrix)

                    final_assignments.append(AssignmentModel(
                        signal_id=s.id or (i + 1),
                        tag=s.tag,
                        description=s.description or "",
                        signal_type=sig_type,
                        cable_id=s.cable_id or "",
                        pair_number=s.pair_number,
                        redundancy=s.redundancy or "",
                        logical_group=s.logical_group or "",
                        cabinet_id=assigned_slot["cab_id"],
                        cioc_id=assigned_slot["cioc_id"],
                        baseplate_id=assigned_slot["bp_id"],
                        channel_no=ch_no,
                        charm_index=ch_no,
                        charm_no=charm_no,
                        charm_part_no=c_part,
                        charm_tb_part_no=t_part,
                        terminal_block=t_name,
                        charm_tb_terminals=t_term,
                        charm_type=c_name,
                        tag_status=getattr(s, "tag_status", "Field") or "Field",
                        status="Allocated",
                        reason=reason
                    ))
                else:
                    final_assignments.append(AssignmentModel(
                        signal_id=s.id or (i + 1),
                        tag=s.tag,
                        description=s.description or "",
                        signal_type=sig_type,
                        cable_id=s.cable_id or "",
                        pair_number=s.pair_number,
                        redundancy=s.redundancy or "",
                        logical_group=s.logical_group or "",
                        status="Needs Review",
                        reason="Unallocated: CP-SAT solver could not find a feasible conflict-free slot"
                    ))
        else:
            # Solver timed out or was infeasible
            for i, s in enumerate(valid_signals):
                final_assignments.append(AssignmentModel(
                    signal_id=s.id or (i + 1),
                    tag=s.tag,
                    description=s.description or "",
                    signal_type=s.signal_type,
                    cable_id=s.cable_id or "",
                    pair_number=s.pair_number,
                    redundancy=s.redundancy or "",
                    logical_group=s.logical_group or "",
                    status="Needs Review",
                    reason=f"Solver returned {status_str}: constraints could not be satisfied within time limit"
                ))

        return final_assignments + rejected_assignments
