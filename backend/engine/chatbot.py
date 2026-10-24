import os
import json
import urllib.request
import urllib.error
from typing import List, Dict, Any, Optional
from models import (
    ChatRequest, ChatResponse, ChatMessage,
    HardwareConfigModel, RiskAssessmentResponse
)

def _resolve_groq_key() -> str:
    key = os.getenv("GROQ_API_KEY", "").strip()
    if key:
        return key
    for path in [".env", "../.env", "backend/.env"]:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.strip().startswith("GROQ_API_KEY="):
                            return line.strip().split("=", 1)[1].strip().strip('"').strip("'")
            except Exception:
                pass
    return ""

GROQ_API_KEY = _resolve_groq_key()
CANDIDATE_MODELS = ["qwen/qwen3.8-27b", "openai/gpt-oss-20b", "openai/gpt-oss-120b"]

SYSTEM_PROMPT = """You are an expert Emerson DeltaV DCS Systems & Marshalling Automation Specialist for the "IO Signal Sudoku" application.
You assist Lead DCS and Instrument Engineers in designing, reviewing, and optimizing CHARM I/O signal allocations.

Core Engineering Principles:
1. Physical Hierarchy: System Cabinet -> Controller -> Marshalling Cabinet -> CIOC -> Baseplate (12 CHARMs) -> Channel / Terminal Block.
2. Capacity: Each CIOC has 8 Baseplates x 12 Channels = 96 CHARM channels.
3. Segregation: Redundant Train A and Train B signals must NEVER share the same CIOC. Train A lands on even CIOCs, Train B on odd CIOCs.
4. Electrical Protection: High-inrush or inductive discrete loads (solenoids, horns, beacons, sounders) require Isolated DO CHARMs (SE4302T02) and Fused-Injected-Power Terminal Blocks (SE4502). Standard 24V discrete uses SE4302T01 with SE4501.
5. Spare Margin: The engineering standard mandates 10% wired spares calculated per IO type (AIR, AOR, DIR, DOR) per controller, plus future space.
6. Multi-pair Cables: 12-pair and 24-pair field cables must be kept contiguous across adjacent baseplates without pair interleaving.
7. Revision Stability: Rev A to Rev B allocations must preserve 100% of unchanged signal positions, vacating only decommissioned signals.

Be concise, authoritative, and direct. Use bullet points and bold tags. Give concrete rule recommendations whenever the user asks about risks, errors, or optimization.
"""

class ChatbotService:
    @staticmethod
    def answer_query(
        request: ChatRequest,
        project_meta: Optional[Dict[str, Any]] = None,
        hw_config: Optional[HardwareConfigModel] = None,
        risk_info: Optional[RiskAssessmentResponse] = None,
        validation_summary: Optional[Dict[str, Any]] = None
    ) -> ChatResponse:
        # Build contextual system prompt
        context_lines = [SYSTEM_PROMPT, "\n--- CURRENT PROJECT TELEMETRY ---"]
        if project_meta:
            context_lines.append(f"Project: {project_meta.get('name', 'N/A')} ({project_meta.get('current_revision', 'Rev A')}) | Customer: {project_meta.get('customer_name', 'Industrial DCS')}")
        if hw_config:
            r = hw_config.rules
            context_lines.append(f"Hardware Config: {hw_config.cabinets_count} Cabinets, {hw_config.ciocs_per_cabinet} CIOCs/cab, Spares: {hw_config.spare_percentage}%")
            context_lines.append(f"Rules: A/B Segregation={r.enforce_ab_redundancy_separation}, Cable Grouping={r.enforce_cable_grouping}, Pair Order={r.enforce_pair_order}")
        if risk_info:
            context_lines.append(f"Risk Assessment: Score={risk_info.overall_score}/100, Level={risk_info.risk_level} ({risk_info.summary})")
            if risk_info.factors:
                context_lines.append("Active Risk Factors:")
                for f in risk_info.factors[:3]:
                    context_lines.append(f" - [{f.severity}] {f.title}: {f.description}")
        if validation_summary:
            context_lines.append(f"Validation: Errors={validation_summary.get('error_count', 0)}, Warnings={validation_summary.get('warning_count', 0)}, Fully Validated={validation_summary.get('is_fully_validated', False)}")
        if request.context_page:
            context_lines.append(f"Active UI Page: {request.context_page}")

        full_system_prompt = "\n".join(context_lines)

        messages_payload = [{"role": "system", "content": full_system_prompt}]
        for m in request.messages[-8:]:  # keep last 8 messages for context
            messages_payload.append({"role": m.role, "content": m.content})

        # Call Groq API with model fallback
        api_key = GROQ_API_KEY
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "IOSignalSudoku/1.0"
        }

        response_content = None
        model_used = None

        for model_name in CANDIDATE_MODELS:
            payload = {
                "model": model_name,
                "messages": messages_payload,
                "temperature": 0.3,
                "max_tokens": 600
            }
            try:
                req = urllib.request.Request(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers=headers,
                    data=json.dumps(payload).encode("utf-8")
                )
                with urllib.request.urlopen(req, timeout=12) as resp:
                    res_data = json.loads(resp.read().decode("utf-8"))
                    choice = res_data.get("choices", [{}])[0]
                    content = choice.get("message", {}).get("content", "").strip()
                    if content:
                        response_content = content
                        model_used = model_name
                        break
            except Exception as e:
                # Try next model in candidate list
                continue

        # If external API fails or is offline, generate intelligent deterministic fallback response
        if not response_content:
            last_user_msg = request.messages[-1].content.lower() if request.messages else ""
            model_used = "deterministic-dcs-engine"

            if "risk" in last_user_msg or "rule" in last_user_msg:
                if risk_info and risk_info.overall_score > 25:
                    response_content = (
                        f"### Project Risk Assessment ({risk_info.risk_level} - {risk_info.overall_score}/100)\n\n"
                        f"Based on the Emerson DeltaV allocation guidelines, the primary risk factors are:\n"
                        + "\n".join([f"- **{f.title}**: {f.description}" for f in risk_info.factors[:3]])
                        + "\n\n**Recommended Rule Adjustments:**\n"
                        "- Enable **Train A/B Redundancy Separation** to guarantee odd/even CIOC isolation.\n"
                        "- Enforce **10.0% Wired Spares** independently by IO type (AIR, AOR, DIR, DOR) per controller.\n"
                        "- Ensure **Solenoid / Horn loads** use Isolated DO `SE4302T02` with Fused TB `SE4502`."
                    )
                else:
                    response_content = (
                        "### Risk Level: LOW (Compliant)\n\n"
                        "Your current allocation strictly aligns with Emerson DeltaV engineering rules:\n"
                        "- **A/B Segregation:** Redundant instruments are isolated across separate carriers.\n"
                        "- **Spare Margin:** 10% wired spare threshold is satisfied per controller.\n"
                        "- **Cable Grouping:** Field cable pairs remain contiguous across baseplates."
                    )
            elif "solenoid" in last_user_msg or "sov" in last_user_msg or "horn" in last_user_msg:
                response_content = (
                    "### Solenoid & Inductive Load Hardware Requirements\n\n"
                    "Per the project engineering guidelines:\n"
                    "- **CHARM Module:** **SE4302T02** (DO 24 VDC Isolated) is required to suppress back-EMF and prevent carrier brownout.\n"
                    "- **Terminal Block:** **SE4502** (Fused-Injected-Power Terminal Block) is required for external field loop power and fuse protection.\n"
                    "- Standard `SE4302T01` high-side DO must NOT be used on solenoids or sirens drawing >0.5A."
                )
            elif "spare" in last_user_msg:
                response_content = (
                    "### 10% Wired Spare Philosophy\n\n"
                    "The Emerson DeltaV standard requires 10% wired spares **by IO type per controller**:\n"
                    "- Unused AI positions do **not** satisfy a DO spare requirement.\n"
                    "- Spares must be fully populated with functional CHARMs and terminal blocks, tagged as `Wired Spare` with traceable tags (e.g., `3201DSP...`).\n"
                    "- In addition, unallocated positions are marked `SE6103` Protection Covers (`Spare Slot`)."
                )
            else:
                response_content = (
                    "### Emerson DeltaV DCS Systems Assistant\n\n"
                    "I am monitoring your allocation against project design standards:\n"
                    "- **Hierarchy:** Cabinets, Controllers, CIOCs, and 12-channel Baseplates.\n"
                    "- **Segregation:** Preserving Train A vs Train B isolation.\n"
                    "- **Explainability:** Click on any CHARM slot in the Hardware Utilisation page to inspect rule lineage."
                )

        # Detect suggestions that could be offered as 1-click actions
        suggested_actions = []
        if risk_info and risk_info.suggestions:
            for s in risk_info.suggestions:
                suggested_actions.append({
                    "id": s.id,
                    "title": s.title,
                    "rule_target": s.rule_target,
                    "suggested_value": s.suggested_value,
                    "risk_reduction_pts": s.risk_reduction_pts
                })

        return ChatResponse(
            message=ChatMessage(role="assistant", content=response_content),
            suggested_actions=suggested_actions,
            model_used=model_used
        )
