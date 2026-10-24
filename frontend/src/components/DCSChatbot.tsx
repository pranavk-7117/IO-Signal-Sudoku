import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Bot,
  Send,
  X,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  Cpu,
  Layers,
  ChevronDown,
  RotateCcw,
  Zap,
  ExternalLink,
  WifiOff
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { api } from '../services/api';
import { ChatMessage, RiskAssessmentResponse } from '../types';

function getLocalDCSExpertResponse(userText: string, riskInfo: RiskAssessmentResponse | null): { content: string; actions?: any[] } {
  const q = userText.toLowerCase();

  if (q.includes('risk') || q.includes('rule') || q.includes('suggest') || q.includes('score')) {
    if (riskInfo && riskInfo.overall_score > 20) {
      const topFactors = riskInfo.factors.slice(0, 3).map((f) => `* **[${f.severity}] ${f.title}:** ${f.description}`).join('\n');
      return {
        content: `### 🛡️ DCS Risk Assessment & Optimization Recommendations\n\n**Current Project Risk:** **${riskInfo.risk_level}** (${riskInfo.overall_score}/100)\n\n${riskInfo.summary}\n\n**Top Risk Factors:**\n${topFactors}\n\n**Recommended Actions:**\n* Use the **Apply Rule** buttons below to immediately enforce compliant parameters.\n* Re-run the CP-SAT solver to regenerate zero-violation hardware schedules.`,
        actions: riskInfo.suggestions
      };
    }
    return {
      content: `### 🛡️ DeltaV Allocation Rules & Risk Guide\n\n* **Train A / Train B Segregation:** Hard requirement. Redundant trains must be allocated to separate CIOC carriers (Train A even, Train B odd) to prevent common-cause plant trips.\n* **10% Wired Spares by IO Type:** Mandated by Emerson commissioning standards. Unused AI spares cannot satisfy DO requirements.\n* **Inductive DO Protection:** Solenoids, horns, and beacons require Isolated DO **SE4302T02** with Fused TB **SE4502** to suppress back-EMF spikes.\n* **Multi-Pair Cables:** 12-pair and 24-pair cables must occupy contiguous slots across adjacent baseplates.`
    };
  }

  if (q.includes('solenoid') || q.includes('sov') || q.includes('horn') || q.includes('beacon') || q.includes('isolated')) {
    return {
      content: `### ⚡ Solenoid & Inductive Load Hardware Requirements\n\nPer Emerson DeltaV and project engineering standards:\n\n* **CHARM Module:** **SE4302T02** (DO 24 VDC Isolated) is required to suppress inductive kickback and isolate carrier logic from field disturbances.\n* **Terminal Block:** **SE4502** (Fused-Injected-Power Terminal Block) provides dedicated loop fuse protection and injected field power distribution.\n* **Standard DO Restriction:** **SE4302T01** (High-Side DO) is only permitted for low-current indicator lamps and non-inductive discrete outputs (<0.5A).`
    };
  }

  if (q.includes('spare') || q.includes('wired')) {
    return {
      content: `### 📊 10% Wired Spare Philosophy (Emerson Standards)\n\n* **Per-Controller Independence:** Spare capacity is calculated as 10% independently for each IO type (AIR, AOR, DIR, DOR) per controller.\n* **Why IO Type Segregation Matters:** Ten spare analog inputs do not help when a commissioning modification requires an additional discrete solenoid output.\n* **Traceable Naming:** Installed wired spares receive traceable tags (e.g., \`3201DSP...\`) with installed functional CHARMs and terminal blocks.\n* **Future Spare Slots:** Uncommitted carrier positions are fitted with **SE6103** CHARM Protection Covers.`
    };
  }

  if (q.includes('rev') || q.includes('stability') || q.includes('diff') || q.includes('freeze')) {
    return {
      content: `### 🔄 Rev A → Rev B Revision Stability (DeltaV Pinning)\n\n* **Zero Signal Movement for Unchanged Tags:** The CP-SAT solver strictly freezes all existing signal addresses from Rev A.\n* **Vacated Deleted Signals:** Decommissioned signals (e.g. \`Status = DELETED\`) are released to hardware spares without shuffling existing field tags.\n* **Nearby Placement for New Signals:** Newly added tags are placed in adjacent spare slots on the same carrier or technical room.\n* **Full Traceability:** The revision impact report highlights every moved, added, and decommissioned channel.`
    };
  }

  return {
    content: `### 🤖 DeltaV Automation Specialist (Instant Expert Mode)\n\nI am ready to assist with your I/O signal allocations:\n\n* **Hardware Hierarchy:** System Cabinets (\`P30-DCS-32001-01\`), Controllers (\`P30DPK320101\`), CIOCs (96 channels), and 12-slot Baseplates.\n* **Segregation Philosophy:** Enforcing physical separation between Train A, Train B, alarms, and control loops.\n* **Signal Explainability:** Click any CHARM slot in the **Hardware Utilisation** rack visualizer to inspect placement rationale.\n\n*Tip: Start the backend server (\`uvicorn main:app --reload\`) to enable live Groq cloud reasoning.*`
  };
}

export const DCSChatbot: React.FC = () => {
  const { currentProject, currentRevision, refreshProjects } = useProject();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [inputMsg, setInputMsg] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        '👋 Welcome, DCS Engineer! I am your **DeltaV Allocation & Risk AI Assistant**.\n\nI can analyze your signal allocations, explain engineering rules, evaluate operational risks, and help you configure optimal hardware settings for commissioning compliance.\n\nHow can I assist your team today?'
    }
  ]);
  const [loading, setLoading] = useState<boolean>(false);
  const [riskInfo, setRiskInfo] = useState<RiskAssessmentResponse | null>(null);
  const [applyingSuggestionId, setApplyingSuggestionId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [backendAvailable, setBackendAvailable] = useState<boolean>(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && currentProject && currentRevision) {
      loadRiskInfo();
    }
  }, [isOpen, currentProject?.id, currentRevision?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const loadRiskInfo = async () => {
    if (!currentProject || !currentRevision) return;
    try {
      const data = await api.getRiskAssessment(currentProject.id, currentRevision.id);
      setRiskInfo(data);
    } catch (err) {
      console.warn('Could not load risk assessment in chatbot', err);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSend = async (userText?: string) => {
    const textToSend = userText || inputMsg;
    if (!textToSend.trim() || loading) return;

    const newMsgs: ChatMessage[] = [
      ...messages,
      { role: 'user', content: textToSend }
    ];
    setMessages(newMsgs);
    if (!userText) setInputMsg('');
    setLoading(true);

    try {
      const res = await api.sendChatMessage({
        project_id: currentProject?.id,
        revision_id: currentRevision?.id,
        messages: newMsgs,
        context_page: window.location.pathname
      });

      setBackendAvailable(true);
      setMessages((prev) => [...prev, res.message]);
    } catch (err: any) {
      console.warn('Backend chat unreachable, engaging local DCS expert engine:', err);
      setBackendAvailable(false);
      const fallback = getLocalDCSExpertResponse(textToSend, riskInfo);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `${fallback.content}\n\n*(Note: Instant DCS Expert Mode active)*`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleApplySuggestion = async (action: { id: string; rule_target: string; suggested_value: any; title: string }) => {
    if (!currentProject) return;
    try {
      setApplyingSuggestionId(action.id);
      await api.applyRuleSuggestion(
        currentProject.id,
        {
          suggestion_id: action.id,
          rule_target: action.rule_target,
          suggested_value: action.suggested_value
        },
        currentRevision?.id
      );

      showToast(`Rule updated: ${action.title}`);
      await loadRiskInfo();
      await refreshProjects();

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `✅ **Rule Successfully Updated:** *"${action.title}"*\n\nThe allocation parameters were saved. Re-run solver to produce the refreshed hardware schedule.`
        }
      ]);
    } catch (err: any) {
      showToast(`Failed to apply rule: ${err.message}`);
    } finally {
      setApplyingSuggestionId(null);
    }
  };

  const promptChips = [
    { label: '📊 Analyze Project Risk & Suggest Rules', query: 'Analyze the engineering risks and give me rule suggestions for this project.' },
    { label: '⚡ Why Solenoids need Isolated DO?', query: 'Why are Solenoids and Horns required to use Isolated DO SE4302T02 and Fused TB SE4502?' },
    { label: '🛡️ Explain 10% Wired Spares rule', query: 'Explain how 10% wired spare capacity must be calculated independently by IO type per controller.' },
    { label: '🔄 How does Rev A to Rev B stability work?', query: 'How does the CP-SAT engine guarantee revision stability between Rev A and Rev B?' }
  ];

  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-lg shadow-xl border border-slate-700 flex items-center space-x-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-full shadow-2xl flex items-center space-x-2.5 transition-all transform hover:scale-105 group border-2 border-white/20"
          title="Open DeltaV Engineering AI Assistant"
        >
          <div className="relative">
            <Bot className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse border-2 border-blue-600"></span>
          </div>
          <span className="text-xs font-bold tracking-wide">DeltaV AI Assistant</span>
          <Sparkles className="w-3.5 h-3.5 text-amber-300 opacity-80 group-hover:rotate-12 transition-transform" />
        </button>
      )}

      {/* Slide-over Chatbot Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 sm:w-[440px] h-[640px] max-h-[88vh] bg-white rounded-2xl shadow-2xl border border-slate-300 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center">
                <Bot className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold tracking-tight">DeltaV Engineering Copilot</h3>
                  <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded border border-blue-400/30">
                    Groq LLM
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  {currentProject?.name ? `${currentProject.name} (${currentRevision?.revision_code || 'Rev A'})` : 'IO Allocation Specialist'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={() => setMessages([{ role: 'assistant', content: 'Chat context reset. How can I help you optimize your DeltaV allocations?' }])}
                className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
                title="Reset Chat"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
                title="Close Assistant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Real-time Project Risk & Rule Bar */}
          {riskInfo && (
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between text-[11px]">
              <div className="flex items-center space-x-2">
                <ShieldAlert className={`w-3.5 h-3.5 ${riskInfo.overall_score > 40 ? 'text-rose-600' : 'text-emerald-600'}`} />
                <span className="font-semibold text-slate-700">Project Risk:</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  riskInfo.risk_level === 'CRITICAL' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                  riskInfo.risk_level === 'HIGH' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                  riskInfo.risk_level === 'MEDIUM' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                  'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}>
                  {riskInfo.risk_level} ({riskInfo.overall_score}/100)
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {riskInfo.suggestions.length} rule suggestions
              </span>
            </div>
          )}

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/60 text-xs">
            {messages.map((m, idx) => {
              const isAssistant = m.role === 'assistant';
              return (
                <div key={idx} className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-2xs leading-relaxed ${
                    isAssistant
                      ? 'bg-white text-slate-800 border border-slate-200'
                      : 'bg-blue-600 text-white font-medium'
                  }`}>
                    {/* Render message text with basic formatting */}
                    <div className="whitespace-pre-wrap space-y-1">
                      {m.content.split('\n\n').map((paragraph, pIdx) => (
                        <p key={pIdx}>
                          {paragraph.split('**').map((part, bIdx) =>
                            bIdx % 2 === 1 ? <strong key={bIdx} className={isAssistant ? "font-bold text-slate-900" : "font-bold text-white"}>{part}</strong> : part
                          )}
                        </p>
                      ))}
                    </div>

                    {/* Quick Suggestions Cards from Assistant */}
                    {isAssistant && riskInfo && riskInfo.suggestions.length > 0 && idx === messages.length - 1 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                          <Zap className="w-3 h-3 text-amber-500" />
                          <span>Actionable Rule Suggestions:</span>
                        </span>
                        {riskInfo.suggestions.map((sug) => (
                          <div key={sug.id} className="bg-slate-50 rounded-lg p-2 border border-slate-200 flex items-center justify-between gap-2">
                            <div className="text-[10px]">
                              <p className="font-bold text-slate-800">{sug.title}</p>
                              <span className="text-emerald-700 font-medium">-{sug.risk_reduction_pts} risk pts</span>
                            </div>
                            <button
                              disabled={applyingSuggestionId === sug.id}
                              onClick={() => handleApplySuggestion(sug)}
                              className="px-2 py-1 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors whitespace-nowrap disabled:opacity-50"
                            >
                              {applyingSuggestionId === sug.id ? 'Applying...' : 'Apply Rule'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-2xs flex items-center space-x-2 text-slate-500">
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce"></div>
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]"></div>
                  <span className="text-[11px] font-medium ml-1">Analyzing DeltaV engineering rules...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Pills */}
          <div className="p-2 bg-white border-t border-slate-100 flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
            {promptChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(chip.query)}
                className="whitespace-nowrap px-2.5 py-1 text-[10px] font-medium text-slate-700 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 rounded-full transition-colors flex items-center space-x-1"
              >
                <span>{chip.label}</span>
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-center space-x-2">
            <input
              type="text"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask anything about DeltaV rules, risk, or signals..."
              className="flex-1 text-xs px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-hidden focus:border-blue-500 bg-slate-50 focus:bg-white transition-all text-slate-800"
            />
            <button
              onClick={() => handleSend()}
              disabled={!inputMsg.trim() || loading}
              className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              title="Send Message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
