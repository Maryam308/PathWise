import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { goalService } from "../../services/goalService.js";

const API_BASE = import.meta.env.VITE_BACKEND_URL;
const STORAGE_KEY = "pathwise_ai_chat_v2";

// ── Session storage helpers ───────────────────────────────────────────────────
const loadMessages = () => {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || null; } catch { return null; }
};
const saveMessages = (msgs) => {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-60))); } catch {}
};

// ── Date helpers ──────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split("T")[0];
const isFutureDate = (d) => d > todayStr();
const monthsUntil = (dateStr) => {
  if (!dateStr) return null;
  const months = Math.round((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24 * 30.44));
  return months > 0 ? months : null;
};
// Given a monthly savings rate, return the YYYY-MM-DD when the goal will be reached
const calcDeadline = (targetAmount, savedAmount, monthlyRate) => {
  const rem = (parseFloat(targetAmount) || 0) - (parseFloat(savedAmount) || 0);
  const rate = parseFloat(monthlyRate) || 0;
  if (rem <= 0 || rate <= 0) return null;
  const months = Math.ceil(rem / rate);
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
};
const calcMonthlyNeeded = (target, saved, deadline) => {
  const months = monthsUntil(deadline);
  const rem = parseFloat(target) - parseFloat(saved || 0);
  if (!months || rem <= 0) return null;
  return (rem / months).toFixed(3);
};
const formatBD = (v) =>
  `BD ${parseFloat(v).toLocaleString("en-BH", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;

// ── Goal creation wizard state machine ───────────────────────────────────────
const WIZARD_STEPS = {
  IDLE: "IDLE",
  NAME: "NAME",
  CATEGORY: "CATEGORY",
  TARGET: "TARGET",
  SAVED: "SAVED",
  DEADLINE: "DEADLINE",
  MONTHLY: "MONTHLY",
  PRIORITY: "PRIORITY",
  CONFIRM: "CONFIRM",
};

const CATEGORIES = [
  { value: "HOUSE",         label: "House",         icon: "🏠" },
  { value: "CAR",           label: "Car",           icon: "🚗" },
  { value: "EDUCATION",     label: "Education",     icon: "📚" },
  { value: "TRAVEL",        label: "Travel",        icon: "✈️" },
  { value: "EMERGENCY_FUND",label: "Emergency Fund",icon: "🛡️" },
  { value: "BUSINESS",      label: "Business",      icon: "💼" },
  { value: "CUSTOM",        label: "Custom",        icon: "🎯" },
];

const INITIAL_DRAFT = {
  name: "", category: "", targetAmount: "", savedAmount: "0",
  deadline: "", monthlySavingsTarget: "", priority: "MEDIUM", currency: "BHD",
};

// ── Strip AI action blocks ────────────────────────────────────────────────────
const parseActionFromReply = (reply) => {
  const match = reply.match(/```action\s*([\s\S]*?)```/);
  if (!match) return null;
  try { return JSON.parse(match[1].trim()); } catch { return null; }
};
const stripActionBlock = (reply) => reply.replace(/```action[\s\S]*?```/g, "").trim();

// ── Confirm card ──────────────────────────────────────────────────────────────
const ConfirmAction = ({ action, onConfirm, onCancel }) => {
  if (!action) return null;
  const d = action.data || {};
  const monthly = d.monthlySavingsTarget || calcMonthlyNeeded(d.targetAmount, d.savedAmount, d.deadline);
  return (
    <div className="mx-3 mb-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
        {action.type === "DELETE_GOAL" ? "🗑 Delete goal?" : action.type === "UPDATE_GOAL" ? "✏️ Update goal?" : "✅ Create this goal?"}
      </p>
      {action.type === "CREATE_GOAL" && d && (
        <div className="text-xs text-gray-600 bg-gray-50 rounded-xl p-3 mb-3 space-y-1">
          <div className="flex justify-between"><span className="text-gray-400">Name</span><span className="font-bold">{d.name}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Category</span><span className="font-bold">{d.category}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Target</span><span className="font-bold text-[#6b7c3f]">{formatBD(d.targetAmount)}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Already saved</span><span className="font-bold">{formatBD(d.savedAmount || 0)}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Deadline</span><span className="font-bold">{d.deadline ? new Date(d.deadline).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : "Not set"}</span></div>
          {monthly && <div className="flex justify-between"><span className="text-gray-400">Monthly needed</span><span className="font-bold">{formatBD(monthly)}</span></div>}
          <div className="flex justify-between"><span className="text-gray-400">Priority</span><span className="font-bold">{d.priority}</span></div>
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

// ── Category picker chips ─────────────────────────────────────────────────────
const CategoryPicker = ({ onSelect }) => (
  <div className="mx-3 mb-2 flex flex-wrap gap-1.5">
    {CATEGORIES.map((c) => (
      <button key={c.value} onClick={() => onSelect(c.value)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 hover:border-[#6b7c3f] hover:text-[#6b7c3f] rounded-full text-xs font-semibold text-gray-600 transition-colors shadow-sm">
        {c.icon} {c.label}
      </button>
    ))}
  </div>
);

// ── Priority picker ───────────────────────────────────────────────────────────
const PriorityPicker = ({ onSelect }) => (
  <div className="mx-3 mb-2 flex gap-2">
    {[
      { v: "HIGH", label: "🔴 High" },
      { v: "MEDIUM", label: "🟡 Medium" },
      { v: "LOW", label: "⚪ Low" },
    ].map(({ v, label }) => (
      <button key={v} onClick={() => onSelect(v)}
        className="flex-1 py-2 bg-white border border-gray-200 hover:border-[#6b7c3f] rounded-xl text-xs font-bold text-gray-600 hover:text-[#6b7c3f] transition-colors shadow-sm">
        {label}
      </button>
    ))}
  </div>
);

// ── Quick prompts ─────────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  "📊 How am I doing?",
  "🎯 Create a new goal",
  "💡 How can I save faster?",
  "📅 Weekly check-in",
];

// ═════════════════════════════════════════════════════════════════════════════
// Main Widget
// ═════════════════════════════════════════════════════════════════════════════
const AICoachWidget = ({ onGoalCreated, onGoalUpdated, onGoalDeleted, goals = [] }) => {
  const { token } = useAuth();

  const WELCOME = {
    role: "assistant",
    content: "Hi! I'm your PathWise AI Coach 🤖\n\nI know your goals and finances. You can:\n• Ask how you're doing\n• Say \"Create a goal\" and I'll walk you through it step by step\n• Ask me to delete or update a goal\n• Get savings advice\n\nWhat would you like to do?",
    timestamp: new Date().toISOString(),
  };

  const [open, setOpen]           = useState(false);
  const [messages, setMessages]   = useState(() => loadMessages() || [WELCOME]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Wizard state
  const [wizardStep, setWizardStep] = useState(WIZARD_STEPS.IDLE);
  const [goalDraft, setGoalDraft]   = useState(INITIAL_DRAFT);

  // Pending AI-suggested action (from non-wizard path)
  const [pendingAction, setPendingAction]     = useState(null);
  const [actionLoading, setActionLoading]     = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  useEffect(() => { saveMessages(messages); }, [messages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, pendingAction, wizardStep]);
  useEffect(() => { const t = setTimeout(() => setShowTooltip(false), 5000); return () => clearTimeout(t); }, []);
  useEffect(() => { if (open) { setTimeout(() => inputRef.current?.focus(), 100); setUnreadCount(0); } }, [open]);

  const addMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, { ...msg, timestamp: msg.timestamp || new Date().toISOString() }]);
    if (!open) setUnreadCount((n) => n + 1);
  }, [open]);

  const addBotMessage = useCallback((content) => {
    addMessage({ role: "assistant", content });
  }, [addMessage]);

  // ── Wizard: advance to next step, prompt accordingly ──────────────────────
  const wizardPrompt = useCallback((step, draft) => {
    const prompts = {
      [WIZARD_STEPS.NAME]:     "What would you like to name this goal?",
      [WIZARD_STEPS.CATEGORY]: "Great! What category does it fall under?",
      [WIZARD_STEPS.TARGET]:   "What's your target amount in BD?",
      [WIZARD_STEPS.SAVED]:    `How much have you already saved towards this goal? (Type 0 if nothing yet)`,
      [WIZARD_STEPS.DEADLINE]:
        draft.targetAmount && draft.savedAmount !== ""
          ? `When's your deadline? (YYYY-MM-DD format, must be a future date)\n\nYou need BD ${(parseFloat(draft.targetAmount) - parseFloat(draft.savedAmount || 0)).toFixed(3)} more.`
          : "When's your deadline? (YYYY-MM-DD format, must be a future date)",
      [WIZARD_STEPS.MONTHLY]:
        (() => {
          const m = calcMonthlyNeeded(draft.targetAmount, draft.savedAmount, draft.deadline);
          return m
            ? `To hit your deadline, you'd need to save ${formatBD(m)}/month.\n\nWould you like to set this as your monthly target? (Yes / or enter a different amount in BD)`
            : "Would you like to set a monthly savings target? (Enter amount in BD or type \"skip\")";
        })(),
      [WIZARD_STEPS.PRIORITY]: "Last thing — what's the priority? High, Medium, or Low?",
    };
    addBotMessage(prompts[step] || "");
  }, [addBotMessage]);

  const startWizard = useCallback((categoryHint = null) => {
    setGoalDraft(INITIAL_DRAFT);
    setWizardStep(WIZARD_STEPS.NAME);
    // If user already said e.g. "education", acknowledge it and skip straight to naming
    if (categoryHint) {
      addBotMessage(`Great choice! Let's set up your ${categoryHint} goal step by step 🎯\n\nWhat would you like to name this goal?`);
    } else {
      addBotMessage("Let's create your goal step by step 🎯\n\nWhat would you like to name this goal?");
    }
  }, [addBotMessage]);

  // ── Wizard: process user input per step ───────────────────────────────────
  const handleWizardInput = useCallback((text) => {
    const t = text.trim();

    if (wizardStep === WIZARD_STEPS.NAME) {
      if (!t) { addBotMessage("Please enter a name for your goal."); return; }
      const next = { ...goalDraft, name: t };
      setGoalDraft(next);
      setWizardStep(WIZARD_STEPS.CATEGORY);
      addBotMessage(`"${t}" — nice! 👍\n\nWhat category does it fall under?`);
      return;
    }

    if (wizardStep === WIZARD_STEPS.CATEGORY) {
      const match = CATEGORIES.find((c) =>
        c.value.toLowerCase() === t.toUpperCase() ||
        c.label.toLowerCase() === t.toLowerCase()
      );
      if (!match) {
        addBotMessage(`I didn't recognise that category. Please pick one from the options below.`);
        return;
      }
      const next = { ...goalDraft, category: match.value };
      setGoalDraft(next);
      setWizardStep(WIZARD_STEPS.TARGET);
      addBotMessage(`${match.icon} ${match.label} — got it!\n\nWhat's your target amount in BD?`);
      return;
    }

    if (wizardStep === WIZARD_STEPS.TARGET) {
      const val = parseFloat(t);
      if (isNaN(val) || val <= 0) { addBotMessage("Please enter a valid amount greater than 0."); return; }
      const next = { ...goalDraft, targetAmount: val.toFixed(3) };
      setGoalDraft(next);
      setWizardStep(WIZARD_STEPS.SAVED);
      addBotMessage(`${formatBD(val)} — noted! 💰\n\nHow much have you already saved towards this? (Enter 0 if nothing yet)`);
      return;
    }

    if (wizardStep === WIZARD_STEPS.SAVED) {
      const val = parseFloat(t);
      if (isNaN(val) || val < 0) { addBotMessage("Please enter 0 or a positive amount."); return; }
      if (val >= parseFloat(goalDraft.targetAmount)) {
        addBotMessage(`That's already at or above your target of ${formatBD(goalDraft.targetAmount)}! Either increase your target or reduce the saved amount.`);
        return;
      }
      const next = { ...goalDraft, savedAmount: val.toFixed(3) };
      setGoalDraft(next);
      setWizardStep(WIZARD_STEPS.DEADLINE);
      const rem = parseFloat(next.targetAmount) - val;
      addBotMessage(`Got it — ${formatBD(rem)} left to go!\n\nWhat's your deadline? (format: YYYY-MM-DD, e.g. 2027-06-30)`);
      return;
    }

    if (wizardStep === WIZARD_STEPS.DEADLINE) {
      const tl = t.toLowerCase();

      // User doesn't know their deadline — skip to monthly savings and calculate
      const dontKnow = ["idk", "i don't know", "i dont know", "not sure", "no idea", "unsure", "skip", "n/a", "no"].some(k => tl.includes(k));
      if (dontKnow) {
        setWizardStep(WIZARD_STEPS.MONTHLY);
        addBotMessage("No problem! Enter your monthly savings target and I'll calculate when you'll reach your goal automatically. How much can you save per month in BD?");
        return;
      }

      // Accept multiple date formats: YYYY-MM-DD, YYYY-M-DD, YYYY-MM, MM/YYYY, "June 2027",
      // "end of 2028", "by the end of 2028", "2028", "early 2028", "Q3 2028", etc.
      let parsed = null;

      // Helper: build last-day-of-month date string
      const lastOfMonth = (y, m) => {
        const last = new Date(y, m, 0).getDate();
        return `${y}-${String(m).padStart(2, "0")}-${last}`;
      };

      const thisYear = new Date().getFullYear();
      const monthNames = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

      // 1. YYYY-MM-DD or YYYY-M-DD or YYYY-MM (strict ISO-ish)
      const isoMatch = t.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
      if (isoMatch) {
        const y = parseInt(isoMatch[1]), m = parseInt(isoMatch[2]);
        if (m >= 1 && m <= 12 && y >= thisYear) parsed = lastOfMonth(y, m);
      }

      // 2. MM/YYYY
      if (!parsed) {
        const slashMatch = t.match(/^(\d{1,2})\/(\d{4})$/);
        if (slashMatch) {
          const m = parseInt(slashMatch[1]), y = parseInt(slashMatch[2]);
          if (m >= 1 && m <= 12 && y >= thisYear) parsed = lastOfMonth(y, m);
        }
      }

      // 3. Natural "Month YYYY" — e.g. "June 2027", "Jun 2027"
      if (!parsed) {
        const nm = tl.match(/\b([a-z]+)\s+(\d{4})\b/);
        if (nm) {
          const mIdx = monthNames.indexOf(nm[1].slice(0, 3));
          const y = parseInt(nm[2]);
          if (mIdx >= 0 && y >= thisYear) parsed = lastOfMonth(y, mIdx + 1);
        }
      }

      // 4. Year-only with qualifier: "end of 2028", "by end of 2028", "by the end of 2028",
      //    "beginning of 2028", "early 2028", "late 2028", "Q1/Q2/Q3/Q4 2028", plain "2028"
      if (!parsed) {
        const yearMatch = tl.match(/\b(\d{4})\b/);
        if (yearMatch) {
          const y = parseInt(yearMatch[1]);
          if (y >= thisYear && y <= thisYear + 20) {
            // Determine which month based on qualifier words
            let month = 12; // default: end of year = December
            if (/\b(q1|first quarter|jan|feb|mar|beginning|start|early)\b/.test(tl))  month = 3;
            else if (/\b(q2|second quarter|apr|may|jun|mid-year|middle)\b/.test(tl))  month = 6;
            else if (/\b(q3|third quarter|jul|aug|sep)\b/.test(tl))                   month = 9;
            else if (/\b(q4|fourth quarter|oct|nov|dec|end|late|last)\b/.test(tl))    month = 12;
            parsed = lastOfMonth(y, month);
          }
        }
      }

      if (!parsed) {
        addBotMessage(
          "I couldn't parse that date. Try formats like:\n• 2028  (I'll use Dec 2028)\n• end of 2028  or  early 2028\n• June 2028  or  2028-06\n• 06/2028\n\nOr type \"skip\" if you don't have a deadline yet."
        );
        return;
      }

      if (!isFutureDate(parsed)) {
        addBotMessage("That date is in the past! Please enter a future date.");
        return;
      }

      const next = { ...goalDraft, deadline: parsed };
      setGoalDraft(next);
      setWizardStep(WIZARD_STEPS.MONTHLY);

      const months = monthsUntil(parsed);
      const suggested = calcMonthlyNeeded(next.targetAmount, next.savedAmount, parsed);
      const displayDate = new Date(parsed).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

      addBotMessage(
        `📅 ${displayDate} — that's ${months} months away.\n\n` +
        (suggested
          ? `To reach your target by then, you'd need to save ${formatBD(suggested)}/month.\n\nWould you like to use this? (Yes / enter a different amount / Skip)`
          : `How much can you set aside monthly for this goal? (Enter amount in BD or "skip")`)
      );
      return;
    }

    if (wizardStep === WIZARD_STEPS.MONTHLY) {
      const suggested = calcMonthlyNeeded(goalDraft.targetAmount, goalDraft.savedAmount, goalDraft.deadline);
      let monthly = null;

      if (t.toLowerCase() === "yes" || t.toLowerCase() === "y") {
        monthly = suggested;
      } else if (t.toLowerCase() === "skip" || t.toLowerCase() === "no") {
        monthly = null;
      } else {
        const val = parseFloat(t);
        if (isNaN(val) || val <= 0) {
          addBotMessage(`Enter an amount in BD, "Yes" to use ${suggested ? formatBD(suggested) : "the suggested amount"}, or "Skip".`);
          return;
        }
        monthly = val.toFixed(3);
      }

      const next = { ...goalDraft, monthlySavingsTarget: monthly };
      setGoalDraft(next);
      setWizardStep(WIZARD_STEPS.PRIORITY);
      addBotMessage(
        monthly
          ? `${formatBD(monthly)}/month — great plan! 📈\n\nLast step: what's the priority for this goal?\n\n🔴 High   🟡 Medium   ⚪ Low`
          : `No monthly target set. You can always add one later.\n\nLast step: what's the priority?\n\n🔴 High   🟡 Medium   ⚪ Low`
      );
      return;
    }

    if (wizardStep === WIZARD_STEPS.PRIORITY) {
      const tUpper = t.toUpperCase();
      const priority = ["HIGH", "MEDIUM", "LOW"].includes(tUpper) ? tUpper
        : t.toLowerCase().startsWith("h") ? "HIGH"
        : t.toLowerCase().startsWith("l") ? "LOW"
        : "MEDIUM";

      const next = { ...goalDraft, priority };
      setGoalDraft(next);
      setWizardStep(WIZARD_STEPS.CONFIRM);

      const monthly = next.monthlySavingsTarget
        ? parseFloat(next.monthlySavingsTarget)
        : null;
      const suggested = calcMonthlyNeeded(next.targetAmount, next.savedAmount, next.deadline);

addBotMessage(
  `Here's your goal summary — does everything look correct? Reply "confirm" to create it, or tell me what to change.\n\n` +
  `📋 Name: ${next.name}\n` +
  `📂 Category: ${next.category}\n` +
  `💰 Target: ${formatBD(next.targetAmount)}\n` +
  `✅ Already saved: ${formatBD(next.savedAmount)}\n` +
  `📅 Deadline: ${next.deadline ? new Date(next.deadline).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : "Not set"}\n` +
  `📈 Monthly savings: ${monthly ? formatBD(monthly) : suggested ? `${formatBD(suggested)} (recommended)` : "Not set"}\n` +
  `⚡ Priority: ${priority}\n\n` +
  `Reply "confirm" to create, or just tell me what to change (e.g. "name is Lexus Car" or "target is 15000").`
);
      return;
    }

    if (wizardStep === WIZARD_STEPS.CONFIRM) {
      const tl = t.toLowerCase().trim();

      // ── Confirm — accept typos, partials, and affirmatives ───────────────
      const isConfirm =
        tl === "confirm" || tl === "yes" || tl === "create" || tl === "ok" ||
        tl === "looks good" || tl === "correct" || tl === "perfect" || tl === "done" ||
        tl === "yep" || tl === "yup" || tl === "sure" || tl === "go" || tl === "go ahead" ||
        tl === "do it" || tl === "submit" || tl === "save" ||
        // fuzzy: starts with "confir" (catches "confir", "confirn", "confirem" etc.)
        tl.startsWith("confir") ||
        // fuzzy: levenshtein-lite — "confiirm", "comfirm", "ocnfirm"
        (tl.length >= 5 && tl.length <= 9 && "confirm".split("").filter(c => tl.includes(c)).length >= 5);

      if (isConfirm) {

        // If user skipped deadline but set a monthly savings rate, auto-calculate deadline
        let deadline = goalDraft.deadline;
        if (!deadline && goalDraft.monthlySavingsTarget) {
          deadline = calcDeadline(goalDraft.targetAmount, goalDraft.savedAmount, goalDraft.monthlySavingsTarget);
        }

        // Still no deadline — backend requires it, must ask
        if (!deadline) {
          addBotMessage(
            "⚠️ I need a deadline to create this goal. When would you like to reach it?\n\n" +
            "You can say:\n• \"end of 2028\"\n• \"June 2029\"\n• Or I can calculate it if you set a monthly savings target."
          );
          setWizardStep(WIZARD_STEPS.DEADLINE);
          return;
        }

        const action = {
          type: "CREATE_GOAL",
          data: {
            ...goalDraft,
            deadline,
            targetAmount:         parseFloat(goalDraft.targetAmount),
            savedAmount:          parseFloat(goalDraft.savedAmount) || 0,
            monthlySavingsTarget: goalDraft.monthlySavingsTarget ? parseFloat(goalDraft.monthlySavingsTarget) : null,
          },
        };
        executeAction(action);
        setWizardStep(WIZARD_STEPS.IDLE);
        setGoalDraft(INITIAL_DRAFT);
        return;
      }

      // ── Cancel ────────────────────────────────────────────────────────────
      if (tl.includes("cancel") || tl.includes("stop") || tl.includes("abort") || tl === "no") {
        setWizardStep(WIZARD_STEPS.IDLE);
        setGoalDraft(INITIAL_DRAFT);
        addBotMessage("No problem — goal creation cancelled. What else can I help you with?");
        return;
      }

      // ── Smart inline-edit: extract the new value from what user said ──────
      // Patterns like: "name is Lexus Car", "change name to Lexus Car",
      //                "the name should be Lexus Car", "rename to Lexus Car",
      //                "name: Lexus Car", just "Lexus Car" (if name field is implied)
      let updated = { ...goalDraft };
      let changed = [];

      // Helper: strip common prefixes to get the raw value
      const extractValue = (text, keywords) => {
        let s = text;
        // Remove "change X to", "X is", "set X to", "update X to", "X:", "rename to" etc.
        const patterns = [
          /^(?:change|set|update|edit|rename|fix)\s+(?:\w+\s+)?to\s+/i,
          /^(?:\w+\s+)?(?:is|are|should be|:)\s+/i,
          /^to\s+/i,
        ];
        for (const p of patterns) s = s.replace(p, "").trim();
        return s || null;
      };

      // Detect which field is being changed
      const isName     = tl.includes("name") || tl.includes("rename") || tl.includes("call it") || tl.includes("call the");
      const isCategory = tl.includes("categ");
      const isTarget   = tl.includes("target") || tl.includes("amount");
      const isSaved    = tl.includes("saved") || tl.includes("already");
      const isDeadline = tl.includes("deadline") || tl.includes("date") || tl.includes("month");
      const isMonthly  = tl.includes("monthly") || tl.includes("per month") || tl.includes("each month");
      const isPriority = tl.includes("priority");

      if (isName) {
        // Extract the actual new name by finding what comes AFTER the keyword phrase
        // Handles: "change name to lx-rx", "rename to lx-rx", "name is lx-rx",
        //          "name: lx-rx", "call it lx-rx", "the name should be lx-rx"
        let newName = null;

        // Pattern: anything after "to ", "is ", "be ", ": "
        const afterKeyword = t.match(/\b(?:to|is|be|:)\s+(.+)/i);
        if (afterKeyword) {
          newName = afterKeyword[1].trim();
        } else {
          // Fallback: strip only the command words, keep the rest as the name
          newName = t
            .replace(/\b(change|rename|update|set|edit|fix|the|name|call|it|goal|please)\b/gi, "")
            .replace(/\s+/g, " ")
            .trim();
        }

        if (newName && newName.length > 0) {
          updated.name = newName;
          changed.push(`Name → "${newName}"`);
        }
      }

      if (isCategory) {
        const match = CATEGORIES.find((c) =>
          tl.includes(c.value.toLowerCase()) || tl.includes(c.label.toLowerCase())
        );
        if (match) { updated.category = match.value; changed.push(`Category → ${match.icon} ${match.label}`); }
      }

      if (isTarget) {
        const num = t.match(/[\d,]+\.?\d*/);
        if (num) {
          const val = parseFloat(num[0].replace(/,/g, ""));
          if (!isNaN(val) && val > 0) { updated.targetAmount = val.toFixed(3); changed.push(`Target → ${formatBD(val)}`); }
        }
      }

      if (isSaved) {
        const num = t.match(/[\d,]+\.?\d*/);
        if (num) {
          const val = parseFloat(num[0].replace(/,/g, ""));
          if (!isNaN(val) && val >= 0) {
            if (val >= parseFloat(updated.targetAmount)) {
              addBotMessage(`❌ Already saved (${formatBD(val)}) can't be ≥ target (${formatBD(updated.targetAmount)}). Please try again.`);
              return;
            }
            updated.savedAmount = val.toFixed(3);
            changed.push(`Already saved → ${formatBD(val)}`);
          }
        }
      }

      if (isDeadline) {
        // Same robust parser as the DEADLINE step
        const lastOfMonthEdit = (y, m) => `${y}-${String(m).padStart(2, "0")}-${new Date(y, m, 0).getDate()}`;
        const thisYearEdit = new Date().getFullYear();
        const monthNamesEdit = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
        let parsed = null;

        const isoMatch = t.match(/(\d{4})-(\d{1,2})(?:-\d{1,2})?/);
        if (isoMatch) {
          const y = parseInt(isoMatch[1]), m = parseInt(isoMatch[2]);
          if (m >= 1 && m <= 12 && y >= thisYearEdit) parsed = lastOfMonthEdit(y, m);
        }
        if (!parsed) {
          const slashMatch = t.match(/(\d{1,2})\/(\d{4})/);
          if (slashMatch) {
            const m = parseInt(slashMatch[1]), y = parseInt(slashMatch[2]);
            if (m >= 1 && m <= 12 && y >= thisYearEdit) parsed = lastOfMonthEdit(y, m);
          }
        }
        if (!parsed) {
          const nm = tl.match(/\b([a-z]+)\s+(\d{4})\b/);
          if (nm) {
            const mIdx = monthNamesEdit.indexOf(nm[1].slice(0, 3));
            const y = parseInt(nm[2]);
            if (mIdx >= 0 && y >= thisYearEdit) parsed = lastOfMonthEdit(y, mIdx + 1);
          }
        }
        if (!parsed) {
          const yearMatch = tl.match(/\b(\d{4})\b/);
          if (yearMatch) {
            const y = parseInt(yearMatch[1]);
            if (y >= thisYearEdit && y <= thisYearEdit + 20) {
              let month = 12;
              if (/\b(q1|first|jan|feb|mar|beginning|start|early)\b/.test(tl))  month = 3;
              else if (/\b(q2|second|apr|may|jun|mid)\b/.test(tl))              month = 6;
              else if (/\b(q3|third|jul|aug|sep)\b/.test(tl))                   month = 9;
              parsed = lastOfMonthEdit(y, month);
            }
          }
        }
        if (parsed) {
          if (!isFutureDate(parsed)) {
            addBotMessage("❌ That date is in the past. Please provide a future date.");
            return;
          }
          updated.deadline = parsed;
          changed.push(`Deadline → ${new Date(parsed).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`);
        }
      }

      if (isMonthly) {
        const num = t.match(/[\d,]+\.?\d*/);
        if (num) {
          const val = parseFloat(num[0].replace(/,/g, ""));
          if (!isNaN(val) && val > 0) { updated.monthlySavingsTarget = val.toFixed(3); changed.push(`Monthly → ${formatBD(val)}`); }
        }
      }

      if (isPriority) {
        const p = tl.includes("high") ? "HIGH" : tl.includes("low") ? "LOW" : tl.includes("med") ? "MEDIUM" : null;
        if (p) { updated.priority = p; changed.push(`Priority → ${p}`); }
      }

      // ── If we extracted at least one change, apply inline and show updated summary ──
      if (changed.length > 0) {
        setGoalDraft(updated);
        const monthly = updated.monthlySavingsTarget ? parseFloat(updated.monthlySavingsTarget) : null;
        const suggested = calcMonthlyNeeded(updated.targetAmount, updated.savedAmount, updated.deadline);
        const deadlineDisplay = updated.deadline
          ? new Date(updated.deadline).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
          : "Not set";
        addBotMessage(
          `✅ Updated: ${changed.join(" · ")}\n\n` +
          `Here's your updated summary:\n\n` +
          `📋 Name: ${updated.name}\n` +
          `📂 Category: ${updated.category}\n` +
          `💰 Target: ${formatBD(updated.targetAmount)}\n` +
          `✅ Already saved: ${formatBD(updated.savedAmount)}\n` +
          `📅 Deadline: ${deadlineDisplay}\n` +
          `📈 Monthly savings: ${monthly ? formatBD(monthly) : suggested ? `${formatBD(suggested)} (recommended)` : "Not set"}\n` +
          `⚡ Priority: ${updated.priority}\n\n` +
          `Reply "confirm" to create, or tell me anything else to change.`
        );
        return;
      }

      // ── Nothing matched — gently explain what's possible ──────────────────
      addBotMessage(
        `I can update any field directly — just tell me what to change, like:\n\n` +
        `• "name is Lexus Car"\n` +
        `• "change target to 10000"\n` +
        `• "deadline June 2028"\n` +
        `• "priority high"\n\n` +
        `Or reply "confirm" to create the goal as-is.`
      );
      return;
    }
  }, [wizardStep, goalDraft, addBotMessage, wizardPrompt]);

  // ── Notify backend of completed wizard action (resets Groq conversation context) ──
  const notifyContextEvent = useCallback(async (actionType, goalName) => {
    try {
      await fetch(`${API_BASE}/api/ai/context-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ actionType, goalName }),
      });
    } catch {
      // non-fatal — if this fails the worst case is a slightly confused AI response
    }
  }, [token]);

  // ── Execute confirmed goal action ─────────────────────────────────────────
// ── Execute confirmed goal action ─────────────────────────────────────────
const executeAction = useCallback(async (action) => {
  setActionLoading(true);
  setPendingAction(null);
  try {
    if (action.type === "CREATE_GOAL") {
      const created = await goalService.create(token, action.data);
      onGoalCreated?.(created);
      await notifyContextEvent("CREATE_GOAL", created.name);

      // Format the date to show only month and year
      const deadlineDate = new Date(created.deadline);
      const formattedDeadline = deadlineDate.toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric"
      });

      addMessage({
        role: "assistant",
        content: `🎉 Goal "${created.name}" created! Target: ${formatBD(created.targetAmount)} by ${formattedDeadline}.\n\nI've added it to your goals list — you can see it there now.`,
        isSuccess: true
      });

    } else if (action.type === "UPDATE_GOAL") {
      let goalId = action.data.id;
      if (!goalId && action.data.name) {
        const match = goals.find(g =>
          g.name?.toLowerCase() === action.data.name?.toLowerCase() ||
          g.name?.toLowerCase().includes(action.data.name?.toLowerCase())
        );
        goalId = match?.id;
      }
      if (!goalId) {
        addMessage({ role: "assistant", content: `❌ I couldn't find a goal matching "${action.data.name}". Please check the goal name and try again.`, isError: true });
        return;
      }
      const existing = goals.find(g => g.id === goalId) || {};
      const payload = { ...existing, ...action.data, id: goalId };
      const updated = await goalService.update(token, goalId, payload);
      onGoalUpdated?.(updated);
      await notifyContextEvent("UPDATE_GOAL", updated.name);
      addMessage({ role: "assistant", content: `✅ "${updated.name}" updated successfully!`, isSuccess: true });

    } else if (action.type === "DELETE_GOAL") {
      let goalId = action.data.id;
      if (!goalId && action.data.name) {
        const match = goals.find(g =>
          g.name?.toLowerCase() === action.data.name?.toLowerCase() ||
          g.name?.toLowerCase().includes(action.data.name?.toLowerCase())
        );
        goalId = match?.id;
      }
      if (!goalId) {
        addMessage({ role: "assistant", content: `❌ I couldn't find a goal matching "${action.data.name}".`, isError: true });
        return;
      }
      await goalService.remove(token, goalId);
      onGoalDeleted?.(goalId);
      await notifyContextEvent("DELETE_GOAL", action.data.name);
      addMessage({ role: "assistant", content: `✅ Goal "${action.data.name}" deleted.`, isSuccess: true });
    }
  } catch (err) {
    addMessage({ role: "assistant", content: `❌ Couldn't complete that: ${err.message || "Unknown error. Please try again."}`, isError: true });
  } finally {
    setActionLoading(false);
  }
}, [token, goals, notifyContextEvent, onGoalCreated, onGoalUpdated, onGoalDeleted, addMessage]);
  // ── Send to AI (non-wizard path) ──────────────────────────────────────────
  const sendToAI = useCallback(async (text) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Error ${res.status}`);

      const raw = data.message || "I'm not sure how to respond. Try rephrasing?";
      const action = parseActionFromReply(raw);
      const clean  = stripActionBlock(raw);

      addMessage({ role: "assistant", content: clean, timestamp: data.timestamp });
      if (action) setPendingAction(action);
    } catch (err) {
      const msg = err.message?.includes("fetch")
        ? "Can't reach the server. Check your connection."
        : err.message || "Something went wrong.";
      addMessage({ role: "assistant", content: `⚠️ ${msg}`, isError: true });
    } finally {
      setLoading(false);
    }
  }, [token, addMessage]);

  // ── Main send handler ────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading || actionLoading) return;
    setInput("");

    addMessage({ role: "user", content: msg });

    // Wizard is active — handle locally
    if (wizardStep !== WIZARD_STEPS.IDLE) {
      handleWizardInput(msg);
      return;
    }

    const lower = msg.toLowerCase();

    // ── Intercept goal creation intent before it reaches the AI ──────────────
    // Explicit triggers
    const explicitCreate = lower.includes("create") || lower.includes("new goal") ||
      lower.includes("add goal") || lower.includes("make a goal") || lower.includes("set a goal") ||
      lower.includes("start a goal") || lower.includes("i want to save") || lower.includes("i want to start saving") ||
      lower.includes("help me save") || lower.includes("saving for") || lower.includes("save for");

    // User replied with just a goal category name (common after AI asks "what would you like to save for?")
    const GOAL_CATEGORIES = ["house", "car", "travel", "education", "emergency", "business", "trip", "vacation", "phone", "laptop", "wedding"];
    const isJustCategory  = GOAL_CATEGORIES.some(c => lower.trim() === c || lower.trim() === `${c} goal` || lower.trim() === `a ${c}`);

    // Last AI message suggested creating a goal (AI asked "what would you like to save for?" etc.)
    const lastAiMsg = [...messages].reverse().find(m => m.role === "assistant")?.content?.toLowerCase() || "";
    const aiOfferedGoalCreation = lastAiMsg.includes("save for") || lastAiMsg.includes("would you like to save") ||
      lastAiMsg.includes("what would you like") || lastAiMsg.includes("create a goal") || lastAiMsg.includes("set up a goal");

    if (explicitCreate || isJustCategory || (aiOfferedGoalCreation && isJustCategory)) {
      // If user gave us a category name, pre-fill it in the wizard
      const matchedCategory = GOAL_CATEGORIES.find(c => lower.includes(c));
      startWizard(matchedCategory);
      return;
    }

    // Otherwise route to AI
    await sendToAI(msg);
  }, [input, loading, actionLoading, wizardStep, messages, addMessage, startWizard, handleWizardInput, sendToAI]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = () => {
    setMessages([WELCOME]);
    setWizardStep(WIZARD_STEPS.IDLE);
    setGoalDraft(INITIAL_DRAFT);
    setPendingAction(null);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  const formatTime = (ts) =>
    ts ? new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";

  const isWizardActive = wizardStep !== WIZARD_STEPS.IDLE;

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
                  <div className={`w-1.5 h-1.5 rounded-full transition-colors ${loading || actionLoading ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
                  <span className={`text-xs font-medium ${loading || actionLoading ? "text-amber-400" : "text-emerald-400"}`}>
                    {loading ? "Thinking..." : actionLoading ? "Working..." : isWizardActive ? "Creating goal..." : "Online"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              {isWizardActive && (
                <button onClick={() => { setWizardStep(WIZARD_STEPS.IDLE); setGoalDraft(INITIAL_DRAFT); addBotMessage("Goal creation cancelled."); }}
                  title="Cancel goal creation"
                  className="px-2 py-1 text-xs font-semibold text-amber-300 hover:text-white border border-amber-400/30 hover:border-white/30 rounded-lg transition-colors">
                  Cancel
                </button>
              )}
              <button onClick={clearChat} title="Clear chat"
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
                style={{ width: `${(Object.values(WIZARD_STEPS).indexOf(wizardStep) / (Object.values(WIZARD_STEPS).length - 1)) * 100}%` }} />
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2.5 bg-gray-50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2`}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 bg-[#6b7c3f] rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-sm">🤖</div>
                )}
                <div className="max-w-[80%]">
                  <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"        ? "bg-[#2c3347] text-white rounded-tr-sm"
                    : msg.isError             ? "bg-red-50 text-red-700 rounded-tl-sm border border-red-100"
                    : msg.isSuccess           ? "bg-emerald-50 text-emerald-800 rounded-tl-sm border border-emerald-100"
                    :                           "bg-white text-gray-700 rounded-tl-sm shadow-sm border border-gray-100"
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
            ))}
            {(loading || actionLoading) && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-[#6b7c3f] rounded-lg flex items-center justify-center text-sm">🤖</div>
                <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm border border-gray-100 flex gap-1.5">
                  {[0,1,2].map((j) => (
                    <div key={j} className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: `${j * 0.15}s` }}/>
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Category picker (shown during wizard CATEGORY step) */}
          {wizardStep === WIZARD_STEPS.CATEGORY && (
            <CategoryPicker onSelect={(v) => sendMessage(v)} />
          )}

          {/* Priority picker */}
          {wizardStep === WIZARD_STEPS.PRIORITY && (
            <PriorityPicker onSelect={(v) => sendMessage(v)} />
          )}

          {/* AI action confirm */}
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

          {/* Quick prompts (only when idle + fresh chat) */}
          {messages.length <= 1 && !isWizardActive && (
            <div className="px-3 py-2 flex flex-wrap gap-1.5 bg-gray-50 border-t border-gray-100">
              {QUICK_PROMPTS.map((q) => (
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
              placeholder={
                wizardStep === WIZARD_STEPS.CATEGORY ? "Type a category or pick above..."
                : wizardStep === WIZARD_STEPS.PRIORITY ? "High, Medium, or Low..."
                : wizardStep === WIZARD_STEPS.CONFIRM ? "Type \"confirm\" or what to change..."
                : "Type your message..."
              }
              rows={1}
              style={{ resize: "none", maxHeight: "80px", overflowY: "auto" }}
              className="flex-1 text-sm text-gray-700 placeholder-gray-300 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#6b7c3f] focus:ring-2 focus:ring-[#6b7c3f]/10 transition-all"
            />
            <button onClick={() => sendMessage()}
              disabled={!input.trim() || loading || actionLoading}
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