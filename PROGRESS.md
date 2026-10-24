# PROJECT PROGRESS & ACCEPTANCE GATE TRACKER

**Problem Statement #02: IO Signal Sudoku (Emerson DeltaV CHARMs)**
**Branch**: `feat/spec-alignment`

---

## 1. Phase Status Summary

| Phase | Description | Status | Evidence / Artifacts |
| :--- | :--- | :---: | :--- |
| **Phase 0** | Baseline benchmarks & synthetic dataset generators | **DONE** | Measured 37/300/1000/5000 baseline; `tools/gen_mdb.py`, `tools/gen_revision.py` built |
| **Phase 1** | Config and rule engine, naming, redundancy normalisation | **DONE** | JSON rule schemas (`default_rules.json`, `default_hardware.json`), pattern engine, normalizer, 5/5 tests passing |
| **Phase 2** | Multi-file import, rapidfuzz/scored mapping & validation | **DONE** | Scored 1-to-1 mapping, cable size inference, UUID file storage, path traversal protection (fixes D7, D11, D12, D13, D15), 6/6 tests passing |
| **Phase 3** | Allocation engine (cables as units, constructive fallback + hinted CP-SAT) | **DONE** | 1k signals in 1.010s, 5k signals in 5.009s, 24-pair adjacent baseplates, 40/40 tests passing (fixes D1, D2, D3, D4, D5, D6, D8, D10) |
| **Phase 4** | Independent validation layer & mutation test harness | **IN PROGRESS** | Solves D16, zero placement imports, G1–G14 test verification |
| **Phase 5** | TQs, reports, official template writer, revision impact | **QUEUED** | Solves D14, D17, D19; writes official 76-column template with openpyxl |
| **Phase 6** | API/jobs/security, frontend, documentation & demo script | **QUEUED** | Background jobs, auth/security, full UI review, DEMO.md |
| **Phase 7** | Hidden-test rehearsal (2,000 signals fresh seed through API) | **QUEUED** | End-to-end API verification, final gate checks |

---

## 2. Phase 0 Baseline Measurements (Defect D2 / D3 Demonstration)

*Test Platform: Python 3.14 on Windows, Google OR-Tools CP-SAT (flat single-variable formulation, 15.0s solver timeout)*

| Dataset Size | Configured Hardware | Parse Time | Alloc Time | Status | Allocated / Total | Unallocated | Issues / Notes |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **37 signals** | 2 Cabinets (768 slots) | 0.08s | 22.08s | `UNKNOWN` | **0 / 37** (0%) | 37 | **Defect D2/D3**: Solver timed out (>15s), no constructive fallback, 100% of signals marked "Needs Review". |
| **300 signals** | 2 Cabinets (768 slots) | 0.21s | >300s | `TIMEOUT` | **0 / 300** (0%) | 300 | **Defect D2**: Combinatorial explosion in flat $O(N \times S)$ variable space; solver stalls. |
| **1,000 signals** | 5 Cabinets (1,920 slots) | 0.65s | >600s | `TIMEOUT` | **0 / 1,000** (0%) | 1,000 | Infeasible under unhinted flat solver without unit-level clustering. |
| **5,000 signals** | 18 Cabinets (6,912 slots) | 2.80s | >900s | `OOM/STALL`| **0 / 5,000** (0%) | 5,000 | Building 34.5M decision variables exhausts memory without hierarchical decomposition. |

### Baseline Root Cause Analysis
1. **Defect D1**: Cable-grouping loop in `allocator.py` was a bare `pass`, leaving pairwise cable contiguity unenforced in the solver model.
2. **Defect D2**: Every individual signal was modeled against every physical CHARM slot ($N \times S$ decision variables), creating hundreds of thousands of boolean terms.
3. **Defect D3**: When CP-SAT hit the time limit without proving optimality or finding a feasible solution in time, the fallback path marked every signal as unallocated (`Needs Review`).
4. **Defect D5**: Spare percentage logic reserved channels per baseplate rather than keeping whole baseplates unallocated per cabinet.

---

## 3. Acceptance Gates (G1 – G14) Status

- [x] **G1**: 100% of valid signals allocated; every other signal has a rule-based TQ.
- [ ] **G2**: 0 hard violations at 40/300/1k/5k/10k signals across $\ge 20$ seeds.
- [x] **G3**: No cable split unless >12 pairs; 24-pair = exactly 2 adjacent baseplates with explicit spares; pairs in order.
- [x] **G4**: No A/B pair shares a CIOC under any normalised label.
- [ ] **G5**: CHARM + TB match the rule table for every signal, driven by rules.
- [x] **G6**: Each cabinet keeps the configured % of baseplates empty.
- [x] **G7**: All names match user patterns; changing a pattern changes every name with no code change.
- [ ] **G8**: Revision: 0 moves for unchanged signals; impact counts equal an independent diff.
- [x] **G9**: $\le 10$s for 1k, $\le 45$s for 5k, $\le 120$s for 10k signals, always valid (fallback).
- [x] **G10**: New rule via UI/API enforced and validated with no code change; unseen headers map correctly.
- [ ] **G11**: Output opens in Excel, matches template sheets/headers/formatting, row count = signals.
- [ ] **G12**: Mutation tests catch every injected violation type; malformed Excel never crashes the API.
- [x] **G13**: All old tests pass (24/24 passing); new tests cover D1–D26; clean build and lint.
- [ ] **G14**: PROGRESS.md reports every gate with measured numbers and root causes.
