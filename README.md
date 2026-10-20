# IO Signal Sudoku
## Intelligent Industrial IO Signal Allocation & Validation Platform for Emerson DeltaV™

[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.150%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![OR-Tools CP-SAT](https://img.shields.io/badge/OR--Tools-CP--SAT-red.svg)](https://developers.google.com/optimization)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg)](https://tailwindcss.com/)

**IO Signal Sudoku** is an enterprise-grade industrial automation engineering web platform designed to automate the allocation, constraint verification, technical query generation, and lifecycle revision management of thousands of I/O signals into **Emerson DeltaV™ Electronic Marshalling (CHARMs)** hardware.

---

## 🏭 Industrial Problem Statement

In major DCS (Distributed Control System) automation projects (refineries, power plants, chemical plants, offshore platforms), project engineering teams manually cross-reference 10,000+ instrument signals from customer IO Excel lists into control system hardware. Manual allocation leads to:
1. **A/B Redundancy Violations**: Single points of failure caused by placing redundant signals on the same carrier.
2. **Cable Disruption**: Splitting multi-pair field cables across disparate cabinets or breaking wire pair ordering.
3. **Severe Revision Rework**: When customers release Rev B or Rev C, manual changes often trigger unnecessary re-wiring, driving up commissioning costs.
4. **Engineering Ambiguity**: Unresolved signal specifications stall project delivery without traceable documentation.

**IO Signal Sudoku** solves this through deterministic constraint optimization (Google OR-Tools CP-SAT), an independent validation audit engine, automated Technical Query (TQ) generation, and revision-aware minimal movement re-allocation.

---

## 🏗️ Hardware Hierarchy & Constraint Rules

The application models the authentic DeltaV electronic marshalling hierarchy:

$$\text{Cabinet} \longrightarrow \text{CIOC (Carrier)} \longrightarrow \text{Baseplate} \longrightarrow \text{CHARM Channel} \longrightarrow \text{Terminal Block}$$

### Core Industrial Rules:
* **Rule 1: Logical Grouping**: Clusters instruments belonging to the same process subsystem (e.g. Boiler Feedwater, Steam Turbine, ESD) into adjacent baseplates.
* **Rule 2: A/B Redundancy Separation (Hard Constraint)**: Signals marked with redundant designators `A` and `B` **must never share the same CIOC** to prevent common-cause failure.
* **Rule 3: Capacity Management**: Strictly enforces 1 signal per CHARM slot and maximum configured CHARMs per baseplate (12 CHARMs standard).
* **Rule 4: Multi-Pair Cable Continuity & Ordering**: Preserves wire pair sequences (e.g., Pair 1, 2, 3...) consecutively on contiguous slots within the same baseplate/cabinet.
* **Rule 5: Reserved Spare Capacity**: Enforces configurable reserved spare thresholds (e.g., 10% or 20%) that cannot be occupied by standard signals.
* **Rule 6: Electrical Signal Compatibility**: Mappings for `AI` (4-20mA HART), `AO`, `DI` (24VDC Dry Contact), `DO`, `DO-SOV` (Isolated Fused Power Injection), `RTD`, and `TC`.
* **Rule 7: Revision Assignment Preservation**: When allocating Rev B or Rev C, preserves existing valid assignments to minimize physical wiring changes.

---

## 🚀 Technology Stack

### Backend
* **Python 3.10+** (tested on 3.14.7)
* **FastAPI** with Pydantic v2 schemas
* **Google OR-Tools CP-SAT**: Constraint Programming solver
* **Pandas & OpenPyXL**: High-performance Excel data ingestion and multi-sheet reporting
* **SQLite / Supabase**: Zero-configuration local database with complete relational schema
* **Pytest**: Automated test suite for all engineering constraints

### Frontend
* **React 19 & TypeScript**
* **Vite**
* **Tailwind CSS** (Industrial dark navy & electric blue design language)
* **Lucide React**: Engineering & DCS iconography
* **Recharts**: Hardware density and carrier utilisation charts
* **React Router v7**: Seamless multi-view navigation

---

## ⚡ Quick Start & Setup Instructions

### 1. Prerequisites
* **Node.js**: v18+ (Node 24 recommended)
* **Python**: v3.10+ (Python 3.14 supported)
* **npm**: v9+

### 2. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install fastapi uvicorn pydantic pandas openpyxl pytest ortools python-multipart

# Start the backend server (runs on port 8000)
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
Backend Swagger API documentation will be available at: `http://127.0.0.1:8000/docs`

### 3. Frontend Setup
```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install npm dependencies
npm install

# Start the Vite development server (runs on port 5173)
npm run dev
```
Open your browser at: `http://localhost:5173`

---

## 🧪 Running Automated Tests

A dedicated constraint verification test suite validates all engineering rules:

```bash
cd backend
.\venv\Scripts\pytest
```

**Verified Test Scenarios:**
1. Valid IO list allocates with 100% hard rule compliance.
2. Incompatible signal types (`UNKNOWN_OPTIC_440V`) are blocked.
3. A/B Redundancy Separation strictly isolates redundant channels to distinct CIOCs.
4. Cabinet and Baseplate capacity bounds are enforced.
5. Cable pair ordering and continuity are maintained.
6. Configurable spare capacity (10%) is reserved.
7. Duplicate signal tags are identified and flagged.
8. Revision comparison detects Added, Deleted, Modified, and Preserved assignments.

---

## 📋 Demonstration Scenario Guide (End-to-End Walkthrough)

The application comes pre-seeded with a comprehensive synthetic DCS project:

1. **Dashboard (`/`)**:
   * Inspect overall KPIs: 74 imported signals, 73 successfully allocated signals, 2 blocking validation issues, 3 open TQs, and cabinet utilisation metrics.
2. **IO Data Import Wizard (`/import`)**:
   * Download the synthetic workbooks: `Customer_IO_List_RevA.xlsx`, `Customer_IO_List_RevB.xlsx`, or `DeltaV_Allocation_Template.xlsx`.
   * Upload and experience the 4-step wizard: sheet selection, fuzzy column mapping, pre-validation preview, and confirmation.
3. **Rules & Hardware (`/rules-hardware`)**:
   * View and tweak the hardware hierarchy (Cabinets, CIOCs, Baseplates, CHARMs).
   * Adjust the Reserved Spare Percentage slider (10% to 30%).
   * Toggle hard constraints: A/B Redundancy Separation, Cable Grouping, Pair Ascending Order.
4. **Allocation Workspace (`/allocation`)**:
   * Dense, filterable engineering table displaying every signal's physical address: `CAB-01/CIOC-01/BP-01/CH01`.
   * Test a **Manual Reassignment** with real-time validation guard (prevents illegal slot assignments).
   * Click **Run Allocation** to trigger the CP-SAT solver.
5. **Hardware Utilisation Rack (`/utilisation`)**:
   * Interactive 12-CHARM rack visualizer with color-coded signal types (AI, AO, DI, DO, DO-SOV, Spares).
   * Hover over any slot to see instrument tags and wiring characteristics.
6. **Validation & Technical Queries (`/validation-tqs`)**:
   * Inspect the independent validation audit log.
   * View generated Technical Queries (e.g. for `TAG-ERR-901`), add resolution notes, and update statuses.
7. **Revision Manager (`/revisions`)**:
   * Switch between **Rev A** and **Rev B**.
   * View the side-by-side diff: detects added instruments (`TT-2003`, `AT-4001`), deleted instruments (`PT-2001`), and highlights preserved vs moved hardware assignments.
8. **Reports & Exports (`/reports`)**:
   * Download completed allocation schedules, validation reports, TQ registers, and revision diff spreadsheets.

---

## 🔒 Security & Data Integrity
* Safe, read-only parsing of uploaded spreadsheets; no macro execution.
* SQL injection prevention via parameterized SQLite / Supabase queries.
* Comprehensive audit trail tracking every manual override and solver run.

---

## 👥 Authors
* Developed for **Code Apex - Problem Statement #02: IO Signal Sudoku (Industrial Automation)**
* Team: **QuadProtectors**
