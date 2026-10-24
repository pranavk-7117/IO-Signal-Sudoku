# TOOLS AND MODELS DECLARATION

## AI Assistance
- **Model**: Google DeepMind Gemini 2.5 Pro (Antigravity Agentic Pair Programmer)

## Backend Stack
- **Runtime**: Python 3.14+ (Virtual Environment)
- **Web Framework**: FastAPI (Lifespan event handlers, strict Pydantic v2 validation, background jobs queue)
- **Constraint Solver**: Google OR-Tools CP-SAT (`ortools==9.11.4210` pinned, multi-worker deterministic portfolio search with constructive fallback)
- **Data & Excel Processing**:
  - `openpyxl==3.1.5`: Reading official templates, preserving formulas/styles, cell-level formatting
  - `pandas==2.2.3`: High-performance dataset analysis, batch validation
  - `rapidfuzz==3.10.1`: Multi-level fuzzy header mapping with token set ratio
- **Networking & API**:
  - `httpx==0.28.1`: Asynchronous HTTP test client & background job polling
  - `uvicorn==0.34.0`: High-performance ASGI production server
- **Database Engine**:
  - SQLite (Local zero-dependency persistence)
  - Supabase PostgreSQL (Production connection pooler auto-detecting IPv4 transaction mode)

## Frontend Stack
- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS (Industrial navy/slate theme, status accents)
- **Icons**: Lucide React
- **Visualization**: Recharts (Cabinet fill %, spare distribution, CIOC utilization)
- **Routing**: React Router DOM v7

## Verification & Tooling
- **Test Framework**: Pytest (`pytest==9.1.1`, `pytest-asyncio`, `anyio`)
- **Adversarial & Mutation Test Harness**: Custom mutation injectors for G1–G14 verification
- **Synthetic IO Generators**: `tools/gen_mdb.py` (scale benchmarks 37 to 10k signals), `tools/gen_revision.py`
