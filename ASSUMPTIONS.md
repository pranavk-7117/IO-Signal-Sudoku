# ENGINEERING ASSUMPTIONS AND DESIGN SPECIFICATIONS

This document logs all engineering conventions, domain interpretations, and technical design decisions applied to achieve Problem Statement #02 compliance (Emerson DeltaV CHARMs Electronic Marshalling).

---

## 1. Hardware Architecture & Hierarchy
- **Hierarchy Structure**: `Cabinet` $\rightarrow$ `CIOC` $\rightarrow$ `Baseplate` $\rightarrow$ `CHARM` $\rightarrow$ `Terminal Block`.
- **Default Sizing**:
  - 1 Marshalling Cabinet contains up to 4 CIOCs (CIOC-01 through CIOC-04).
  - 1 CIOC contains up to 8 Baseplates (`001-CBP-1` through `001-CBP-8`).
  - 1 Baseplate contains 12 CHARM channels (1..12).
  - 1 CIOC = 96 channels ($8 \times 12$).
  - 1 Marshalling Cabinet = 384 channels ($4 \times 96$).
- **Addressing Formula**:
  $$\text{CHARM\_No} = (\text{Baseplate\_No} - 1) \times 12 + \text{Channel\_No}$$
  Example: Baseplate 2, Channel 1 gives $\text{CHARM\_No} = (2 - 1) \times 12 + 1 = 13$.

---

## 2. Multicore / Multipair Cable Handling
- **Standard Cable Sizing Palette**: Cables in industrial automation standardly come in $\{2, 6, 12, 24\}$ pairs.
- **Inference of Cable Size**:
  If cable size is not explicitly mapped or provided in the source dataset, the platform calculates $\max(\text{pair numbers for this cable})$ and selects the smallest size in $\{2, 6, 12, 24\}$ greater than or equal to that maximum.
- **Continuity & Splitting Rules**:
  - Cables with $\le 12$ pairs must NEVER be split across baseplates. They must occupy a contiguous block of channels on a single baseplate. Multiple small cables can share a baseplate as long as each cable's pairs are strictly grouped together in monotonic order.
  - A 24-pair cable spans exactly 2 adjacent baseplates under the same CIOC:
    - Pairs 1–12 land on the first baseplate (channels 1–12).
    - Pairs 13–24 land on the second baseplate (channels 1–12).
  - **Explicit Spare Pairs**: If a 24-pair cable has only 18 active field signals, the remaining 6 pairs are not skipped; they are explicitly allocated as `Wired Spare` (if wired spare tagging applies) or `Spare Slot` in exact pair sequence.

---

## 3. Redundancy & Segregation Philosophy
- **A/B Segregation**: Signals designated as redundant A and B (or Duty/Standby, Primary/Secondary, Train A/Train B) within the same process unit, loop, or equipment train must NOT reside on the same CIOC. They must be segregated into different CIOCs (and ideally different controllers) to prevent a single hardware failure from taking down both redundant paths.
- **Normalisation**: Incoming customer values like `Duty`, `Primary`, `Main`, `Train A`, `A-CONTROL` normalise to `A`; `Standby`, `Secondary`, `Backup`, `Train B`, `B-ALARM` normalise to `B`.

---

## 4. CHARM and Terminal Block Selection Matrix
Driven entirely by user-configurable JSON/DB rule definitions:

| Signal Type / Criteria | CHARM Module | Part No. | Terminal Block | TB Part No. | Terminals |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **AIR** (Standard 2-wire 4–20mA HART) | AI 4-20 MA HART CHARM | `SE4303T01` | Standard CHARM TB | `SE4501` | `1, 2` |
| **AIR** (RTD / 3-Wire Temp / -EJA) | RTD Input Charm | `SE4303T03` | Standard CHARM TB | `SE4501` | `1, 2, 4` |
| **AIR** (4-Wire / Coriolis / 230VAC) | AI 4-20 MA HART CHARM | `SE4303T01` | Standard CHARM TB | `SE4501` | `-, 2, 4` |
| **AOR** (4–20mA HART Output) | AO 4-20 MA HART CHARM | `SE4304T01` | Standard CHARM TB | `SE4501` | `1, 2` |
| **DIR** (24VDC Dry Contact) | DI 24VDC Dry Contact | `SE4301T02` | Standard CHARM TB | `SE4501` | `1, 2` |
| **DOR** (High-current: SOV, XYV, ZYV, horn, beacon) | DO 24VDC Isolated | `SE4302T02` | Fused-Injected-Power TB | `SE4502` | `-, 2, 4` |
| **DOR** (Standard discrete indicator/alarm) | DO 24VDC High-Side | `SE4302T01` | Standard CHARM TB | `SE4501` | `1, 2` |
| **DOR** (Relay output) | DO 24VDC High-Side | `SE4302T01` | Relay Output TB | `SE4503` | `1, 2` |
| **Spare Slot** (Unpopulated) | CHARM Protection Cover | `SE6103` | Standard CHARM TB | `SE4501` | `-` |

---

## 5. Spare Capacity Allocation
- Configured spare percentage (e.g. 10%) specifies that ~10% of baseplates per marshalling cabinet are left fully empty/unconnected for future project expansions.
- In addition, within populated baseplates, unassigned pairs of cables become explicit spare slots (`Spare Slot`).

---

## 6. Naming Pattern Engine
All generated component names are derived dynamically from customizable pattern templates:
- **System Cabinet**: `{area}-DCS-{unit}-{seq:02d}`
- **Controller**: `{area}CTL{unit}{seq:02d}` (or `{area}DPK{unit}{seq:02d}`)
- **Marshalling Cabinet**: `{area}-DCM-{unit}-{seq:02d}`
- **CIOC**: `{area}DCIOC{unit}{seq:03d}`
- **Baseplate**: `{cioc_seq:03d}-CBP-{bp_num}`
- **Wired Spare Tag**: `{area}DSP{controller}{cioc_seq:03d}{charm_no}`

---

## 7. Revision Stability (Differential Minimisation)
- When Rev B is loaded against Rev A:
  1. Signals with identical tag and electrical properties retain their exact physical assignment (`cabinet`, `cioc`, `baseplate`, `channel`).
  2. Deleted signals vacate their slot (which becomes available for same-group allocation or remains an open gap, preserving wiring numbering for all other channels).
  3. New/modified signals are allocated into available positions nearest to their group/cable cluster.
  4. 0 moves are made for unchanged signals unless mathematically impossible due to hard capacity expansions.
