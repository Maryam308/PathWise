import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth }       from "../../context/AuthContext.jsx";
import { useGoals }      from "../../context/GoalsContext.jsx";
import { useWizard }     from "../../hooks/useWizard.js";
import { WIZARD_STEPS, GOAL_CATEGORIES, WIZARD_QUICK_PROMPTS } from "../../constants/goals.js";
import { formatBD }      from "../../utils/formatters.js";
import { calcMonthlyNeeded } from "../../utils/goalCalculations.js";
import { aiCoachService } from "../../services/aiCoachService.js";

const STORAGE_KEY = "pathwise_ai_chat_v2";

// ── Session storage ───────────────────────────────────────────────────────────
const loadMessages = () => {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || null; } catch { return null; }
};
const saveMessages = (msgs) => {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-60))); } catch {}
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const parseActionFromReply = (reply) => {
  const m = reply.match(/```action\s*([\s\S]*?)```/);
  if (!m) return null;
  try { return JSON.parse(m[1].trim()); } catch { return null; }
};
const stripActionBlock = (reply) => reply.replace(/```action[\s\S]*?```/g, "").trim();
const formatTime = (ts) =>
  ts ? new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";

// ── Sub-components ────────────────────────────────────────────────────────────

const ConfirmAction = ({ action, onConfirm, onCancel }) => {
  if (!action) return null;
  const d       = action.data || {};
  const monthly = d.monthlySavingsTarget || calcMonthlyNeeded(d.targetAmount, d.savedAmount, d.deadline);
  return (
    <div className="mx-3 mb-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
        {action.type === "DELETE_GOAL" ? "🗑 Delete goal?" : action.type === "UPDATE_GOAL" ? "✏️ Update goal?" : "✅ Create this goal?"}
      </p>
      {action.type === "CREATE_GOAL" && (
        <div className="text-xs text-gray-600 bg-gray-50 rounded-xl p-3 mb-3 space-y-1">
          {[
            ["Name",         d.name],
            ["Category",     d.category],
            ["Target",       formatBD(d.targetAmount),       "text-[#6b7c3f]"],
            ["Already saved",formatBD(d.savedAmount || 0)],
            ["Deadline",     d.deadline
              ? new Date(d.deadline).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
              : "Not set"],
            ...(monthly ? [["Monthly", formatBD(monthly)]] : []),
            ["Priority",     d.priority],
          ].map(([label, val, valClass = ""]) => (
            <div key={label} className="flex justify-between">
              <span className="text-gray-400">{label}</span>
              <span className={`font-bold ${valClass}`}>{val}</span>
            </div>
          ))}
        </div>
      )}
      {action.type === "DELETE_GOAL" && (
        <p className="text-sm text-red-600 font-medium mb-3">Delete "{d.name}"? This cannot be undone.</p>
      )}
      <div className="flex gap-2">
        <button onClick={onCancel}
          className="flex-1 py-1.5 text-xs font-semibold border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors">
          ✏️ Edit
        </button>
        <button onClick={() => onConfirm(action)}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg text-white transition-colors ${
            action.type === "DELETE_GOAL" ? "bg-red-500 hover:bg-red-600" : "bg-[#6b7c3f] hover:bg-[#5a6a33]"
          }`}>
          Confirm
        </button>
      </div>
    </div>
  );
};

const CategoryPicker = ({ onSelect }) => (
  <div className="mx-3 mb-2 flex flex-wrap gap-1.5">
    {GOAL_CATEGORIES.map((c) => (
      <button key={c.value} onClick={() => onSelect(c.value)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 hover:border-[#6b7c3f] hover:text-[#6b7c3f] rounded-full text-xs font-semibold text-gray-600 transition-colors shadow-sm">
        {c.icon} {c.label}
      </button>
    ))}
  </div>
);

const PriorityPicker = ({ onSelect }) => (
  <div className="mx-3 mb-2 flex gap-2">
    {[{ v: "HIGH", label: "🔴 High" }, { v: "MEDIUM", label: "🟡 Medium" }, { v: "LOW", label: "⚪ Low" }].map(({ v, label }) => (
      <button key={v} onClick={() => onSelect(v)}
        className="flex-1 py-2 bg-white border border-gray-200 hover:border-[#6b7c3f] rounded-xl text-xs font-bold text-gray-600 hover:text-[#6b7c3f] transition-colors shadow-sm">
        {label}
      </button>
    ))}
  </div>
);

const ChatMessage = ({ msg }) => (
  <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2`}>
    {msg.role === "assistant" && (
      <div className="w-7 h-7 bg-[#6b7c3f] rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-sm">🤖</div>
    )}
    <div className="max-w-[80%]">
      <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
        msg.role === "user"  ? "bg-[#2c3347] text-white rounded-tr-sm"
        : msg.isError        ? "bg-red-50 text-red-700 rounded-tl-sm border border-red-100"
        : msg.isSuccess      ? "bg-emerald-50 text-emerald-800 rounded-tl-sm border border-emerald-100"
        :                      "bg-white text-gray-700 rounded-tl-sm shadow-sm border border-gray-100"
      }`}>
        {msg.content}
      </div>
      <p className="text-xs text-gray-300 mt-0.5 px-1">{formatTime(msg.timestamp)}</p>
    </div>
    {msg.role === "user" && (
      <div className="w-7 h-7 bg-gray-200 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
    )}
  </div>
);

const TypingIndicator = () => (
  <div className="flex items-center gap-2">
    <div className="w-7 h-7 bg-[#6b7c3f] rounded-lg flex items-center justify-center text-sm">🤖</div>
    <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm border border-gray-100 flex gap-1.5">
      {[0, 1, 2].map((j) => (
        <div key={j} className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"
          style={{ animationDelay: `${j * 0.15}s` }} />
      ))}
    </div>
  </div>
);

// ═════════════════════════════════════════════════════════════════════════════
// Main widget
// ═════════════════════════════════════════════════════════════════════════════
const AICoachWidget = () => {
  const { token }   = useAuth();
  const { goals, createGoal, updateGoal, deleteGoal, financialSnapshot } = useGoals();

const WELCOME = {
  role: "assistant",
  content: (() => {
    const disposable = financialSnapshot?.disposableIncome;
    const hasNoDisposable = disposable !== null && disposable <= 0;

    let baseMessage = "Hi! I'm your PathWise AI Coach 🤖\n\n" +
      "I know your goals and finances. You can:\n" +
      "• Ask how you're doing\n" +
      "• Say \"Create a goal\" and I'll walk you through it step by step\n" +
      "• Ask me to delete or update a goal\n" +
      "• Get savings advice\n\n";

    if (hasNoDisposable) {
      baseMessage += "⚠️ **Note:** Your disposable income is currently 0, meaning your expenses equal or exceed your salary. " +
        "I recommend:\n" +
        "• Reviewing your fixed expenses in Profile → My Information\n" +
        "• Considering ways to reduce spending before creating new goals\n" +
        "• If you have existing goals, you may need to adjust their monthly targets\n\n";
    }

    baseMessage += "What would you like to do?";
    return baseMessage;
  })(),
  timestamp: new Date().toISOString(),
};

  const [open,          setOpen]          = useState(false);
  const [messages,      setMessages]      = useState(() => loadMessages() || [WELCOME]);
  const [input,         setInput]         = useState("");
  const [loading,       setLoading]       = useState(false);
  const [showTooltip,   setShowTooltip]   = useState(true);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [pendingAction, setPendingAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  useEffect(() => { saveMessages(messages); }, [messages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, pendingAction]);
  useEffect(() => { const t = setTimeout(() => setShowTooltip(false), 5000); return () => clearTimeout(t); }, []);
  useEffect(() => { if (open) { setTimeout(() => inputRef.current?.focus(), 100); setUnreadCount(0); } }, [open]);

  const addMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, { ...msg, timestamp: msg.timestamp || new Date().toISOString() }]);
    if (!open) setUnreadCount((n) => n + 1);
  }, [open]);

  const addBotMessage = useCallback((content) => addMessage({ role: "assistant", content }), [addMessage]);

  // ── Context event ─────────────────────────────────────────────────────────
  const notifyContextEvent = useCallback(async (actionType, goalName) => {
    await aiCoachService.notifyGoalAction(token, actionType, goalName);
  }, [token]);

  // ── Execute action ─────────────────────────────────────────────────────────
  const executeAction = useCallback(async (action) => {
    setActionLoading(true);
    setPendingAction(null);
    try {
      if (action.type === "CREATE_GOAL") {
        const created = await createGoal(action.data);
        wizard.setWizardStep(WIZARD_STEPS.IDLE);
        wizard.setGoalDraft(wizard.INITIAL_DRAFT);
        await notifyContextEvent("CREATE_GOAL", created.name);
        const deadline = new Date(created.deadline).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
        addMessage({
          role: "assistant",
          content: `🎉 Goal "${created.name}" created! Target: ${formatBD(created.targetAmount)} by ${deadline}.\n\nI've added it to your goals list.`,
          isSuccess: true,
        });

      } else if (action.type === "UPDATE_GOAL") {
        let goalId = action.data.id;
        if (!goalId && action.data.name) {
          const match = goals.find((g) =>
            g.name?.toLowerCase() === action.data.name?.toLowerCase() ||
            g.name?.toLowerCase().includes(action.data.name?.toLowerCase())
          );
          goalId = match?.id;
        }
        if (!goalId) {
          addMessage({ role: "assistant", content: `❌ I couldn't find a goal matching "${action.data.name}".`, isError: true });
          return;
        }
        const existing   = goals.find((g) => g.id === goalId) || {};
        const newMonthly = parseFloat(action.data.monthlySavingsTarget ?? existing.monthlySavingsTarget ?? 0);
        const newTarget  = parseFloat(action.data.targetAmount ?? existing.targetAmount ?? 0);
        const newSaved   = parseFloat(action.data.savedAmount  ?? existing.savedAmount  ?? 0);
        if (newMonthly > 0 && newTarget > 0 && newMonthly >= (newTarget - newSaved)) {
          addMessage({
            role: "assistant",
            content: `⚠️ Monthly savings of ${formatBD(newMonthly)} would exceed the remaining balance of ${formatBD(newTarget - newSaved)}. Please set a lower monthly target.`,
            isError: true,
          });
          return;
        }
        const updated = await updateGoal(goalId, { ...existing, ...action.data, id: goalId });
        await notifyContextEvent("UPDATE_GOAL", updated.name);
        addMessage({ role: "assistant", content: `✅ "${updated.name}" updated successfully!`, isSuccess: true });

      } else if (action.type === "DELETE_GOAL") {
        let goalId = action.data.id;
        if (!goalId && action.data.name) {
          const match = goals.find((g) =>
            g.name?.toLowerCase() === action.data.name?.toLowerCase() ||
            g.name?.toLowerCase().includes(action.data.name?.toLowerCase())
          );
          goalId = match?.id;
        }
        if (!goalId) {
          addMessage({ role: "assistant", content: `❌ I couldn't find a goal matching "${action.data.name}".`, isError: true });
          return;
        }
        await deleteGoal(goalId);
        await notifyContextEvent("DELETE_GOAL", action.data.name);
        addMessage({ role: "assistant", content: `✅ Goal "${action.data.name}" deleted.`, isSuccess: true });
      }
    } catch (err) {
      if (action.type === "CREATE_GOAL") {
        wizard.setGoalDraft({
          name:                 action.data.name                 || "",
          category:             action.data.category             || "",
          targetAmount:         String(action.data.targetAmount  ?? ""),
          savedAmount:          String(action.data.savedAmount   ?? "0"),
          deadline:             action.data.deadline             || "",
          monthlySavingsTarget: action.data.monthlySavingsTarget != null ? String(action.data.monthlySavingsTarget) : "",
          priority:             action.data.priority             || "",
          currency:             action.data.currency             || "BHD",
        });
        wizard.setWizardStep(WIZARD_STEPS.CONFIRM);
        addMessage({
          role: "assistant",
          content: `❌ Couldn't create goal: ${err.message || "Unknown error."}\n\nTell me what to change or type "cancel" to start over.`,
          isError: true,
        });
      } else {
        addMessage({ role: "assistant", content: `❌ Couldn't complete that: ${err.message || "Unknown error."}`, isError: true });
      }
    } finally {
      setActionLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, createGoal, updateGoal, deleteGoal, notifyContextEvent, addMessage]);

  // ── Wizard hook ───────────────────────────────────────────────────────────
  const wizard = useWizard({ addBotMessage, executeAction, financialSnapshot });

  // ── Send to AI backend ────────────────────────────────────────────────────
  const sendToAI = useCallback(async (text) => {
    setLoading(true);
    try {
      const data   = await aiCoachService.chat(token, text);
      const raw    = data.message || "I'm not sure how to respond. Try rephrasing?";
      const action = parseActionFromReply(raw);
      const clean  = stripActionBlock(raw);
      addMessage({ role: "assistant", content: clean, timestamp: data.timestamp });
      if (action) setPendingAction(action);
    } catch (err) {
      addMessage({
        role: "assistant",
        content: `⚠️ ${err.message?.includes("fetch") ? "Can't reach the server." : err.message || "Something went wrong."}`,
        isError: true,
      });
    } finally {
      setLoading(false);
    }
  }, [token, addMessage]);

  // ── sendMessage ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading || actionLoading) return;
    setInput("");
    addMessage({ role: "user", content: msg });

    // If wizard is active, route to wizard
    if (wizard.isActive) { wizard.handleInput(msg); return; }

    const lower = msg.toLowerCase();
    const explicitCreate =
      lower.includes("create") || lower.includes("new goal") || lower.includes("add goal") ||
      lower.includes("make a goal") || lower.includes("set a goal") || lower.includes("i want to save") ||
      lower.includes("saving for") || lower.includes("save for");

    const CATEGORY_WORDS = ["house","car","travel","education","emergency","business","trip","vacation","phone","laptop","wedding"];
    const isJustCategory  = CATEGORY_WORDS.some((c) => lower.trim() === c || lower.trim() === `${c} goal`);
    const lastAiContent   = [...messages].reverse().find((m) => m.role === "assistant")?.content?.toLowerCase() || "";
    const aiOfferedCreate = lastAiContent.includes("save for") || lastAiContent.includes("create a goal") || lastAiContent.includes("set up a goal");

    if (explicitCreate || isJustCategory || (aiOfferedCreate && isJustCategory)) {
      wizard.startWizard(CATEGORY_WORDS.find((c) => lower.includes(c)));
      return;
    }
    await sendToAI(msg);
  }, [input, loading, actionLoading, wizard, messages, addMessage, sendToAI]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = () => {
    setMessages([WELCOME]);
    wizard.setWizardStep(WIZARD_STEPS.IDLE);
    wizard.setGoalDraft(wizard.INITIAL_DRAFT);
    setPendingAction(null);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  const isWizardActive = wizard.isActive;
  const isBusy         = loading || actionLoading;

  const inputPlaceholder =
    wizard.wizardStep === WIZARD_STEPS.CATEGORY ? "Type a category or pick above..." :
    wizard.wizardStep === WIZARD_STEPS.PRIORITY  ? "Type High, Medium, or Low..." :
    wizard.wizardStep === WIZARD_STEPS.CONFIRM   ? "Type \"confirm\" or what to change..." :
    "Type your message...";

  const wizardProgress =
    (Object.values(WIZARD_STEPS).indexOf(wizard.wizardStep) /
      (Object.values(WIZARD_STEPS).length - 1)) * 100;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
          style={{ height: "540px" }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#2c3347] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#6b7c3f] rounded-xl flex items-center justify-center text-lg">🤖</div>
              <div>
                <p className="text-white font-bold text-sm">PathWise AI Coach</p>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${isBusy ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
                  <span className={`text-xs font-medium ${isBusy ? "text-amber-400" : "text-emerald-400"}`}>
                    {loading ? "Thinking..." : actionLoading ? "Working..." : isWizardActive ? "Creating goal..." : "Online"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              {isWizardActive && (
                <button onClick={wizard.cancelWizard}
                  className="px-2 py-1 text-xs font-semibold text-amber-300 hover:text-white border border-amber-400/30 hover:border-white/30 rounded-lg transition-colors">
                  Cancel
                </button>
              )}
              <button onClick={clearChat}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                </svg>
              </button>
              <button onClick={() => setOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Wizard progress bar */}
          {isWizardActive && (
            <div className="h-1 bg-gray-100 shrink-0">
              <div className="h-full bg-[#6b7c3f] transition-all duration-500"
                style={{ width: `${wizardProgress}%` }} />
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2.5 bg-gray-50">
            {messages.map((msg, i) => <ChatMessage key={i} msg={msg} />)}
            {isBusy && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Context-sensitive UI chips */}
          {wizard.wizardStep === WIZARD_STEPS.CATEGORY && <CategoryPicker onSelect={(v) => sendMessage(v)} />}
          {wizard.wizardStep === WIZARD_STEPS.PRIORITY  && <PriorityPicker onSelect={(v) => sendMessage(v)} />}

          {pendingAction && (
            <ConfirmAction
              action={pendingAction}
              onConfirm={executeAction}
              onCancel={() => {
                setPendingAction(null);
                addBotMessage("Action cancelled. Let me know if you'd like to change anything.");
              }}
            />
          )}

          {/* Quick prompts (only on welcome screen) */}
          {messages.length <= 1 && !isWizardActive && (
            <div className="px-3 py-2 flex flex-wrap gap-1.5 bg-gray-50 border-t border-gray-100">
              {WIZARD_QUICK_PROMPTS.map((q) => (
                <button key={q} onClick={() => sendMessage(q)}
                  className="text-xs text-gray-500 bg-white border border-gray-200 hover:border-[#6b7c3f] hover:text-[#6b7c3f] rounded-full px-2.5 py-1 transition-colors font-medium shadow-sm">
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 py-3 bg-white border-t border-gray-100 flex items-end gap-2 shrink-0">
            <textarea ref={inputRef} value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={inputPlaceholder}
              rows={1}
              style={{ resize: "none", maxHeight: "80px", overflowY: "auto" }}
              className="flex-1 text-sm text-gray-700 placeholder-gray-300 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#6b7c3f] focus:ring-2 focus:ring-[#6b7c3f]/10 transition-all"
            />
            <button onClick={() => sendMessage()}
              disabled={!input.trim() || isBusy}
              className="w-9 h-9 bg-[#6b7c3f] hover:bg-[#5a6a33] disabled:bg-gray-200 rounded-xl flex items-center justify-center transition-all shrink-0 self-end">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M22 2L11 13" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22 2L15 22 11 13 2 9l20-7z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Tooltip */}
      {!open && showTooltip && (
        <div className="relative bg-[#2c3347] text-white text-xs px-3 py-2 rounded-xl shadow-lg">
          <p className="font-bold">PathWise AI Coach</p>
          <p className="text-gray-400 mt-0.5">Create goals, get advice, simulate savings!</p>
          <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-[#2c3347] rotate-45" />
        </div>
      )}

      {/* FAB */}
      <div className="relative">
        {unreadCount > 0 && !open && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center z-10">
            <span className="text-white text-xs font-bold">{unreadCount}</span>
          </div>
        )}
        <button onClick={() => { setOpen((o) => !o); setShowTooltip(false); }}
          className="w-14 h-14 bg-[#2c3347] hover:bg-[#3d4357] rounded-full flex items-center justify-center shadow-xl hover:shadow-2xl transition-all duration-200 hover:-translate-y-0.5">
          {open
            ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/></svg>
            : <span className="text-2xl">🤖</span>
          }
        </button>
      </div>
    </div>
  );
};

export default AICoachWidget;