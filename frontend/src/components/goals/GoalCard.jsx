import { useState } from "react";

const STATUS_CONFIG = {
  ON_TRACK: {
    label: "On Track",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
  },
  AT_RISK: {
    label: "At Risk",
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
  },
  COMPLETED: {
    label: "Completed",
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-500",
    bar: "bg-[#6b7c3f]",
  },
};

const CATEGORY_ICONS = {
  HOUSE:          "🏠",
  CAR:            "🚗",
  EDUCATION:      "📚",
  TRAVEL:         "✈️",
  EMERGENCY_FUND: "🛡️",
  BUSINESS:       "💼",
  CUSTOM:         "🎯",
};

const PRIORITY_BADGE = {
  HIGH:   { label: "High",   bg: "bg-red-50",    text: "text-red-600" },
  MEDIUM: { label: "Medium", bg: "bg-orange-50",  text: "text-orange-600" },
  LOW:    { label: "Low",    bg: "bg-gray-100",   text: "text-gray-500" },
};

const GoalCard = ({ goal, onEdit, onDelete, onProjection, onSimulation }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const status   = STATUS_CONFIG[goal.status]     || STATUS_CONFIG.ON_TRACK;
  const priority = PRIORITY_BADGE[goal.priority]  || PRIORITY_BADGE.LOW;
  const icon     = CATEGORY_ICONS[goal.category]  || "🎯";
  const progress = Math.min(goal.progressPercentage || 0, 100);

  const formatBD = (v) =>
    v != null
      ? `BD ${parseFloat(v).toLocaleString("en-BH", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`
      : "—";

  const deadline = goal.deadline
    ? new Date(goal.deadline).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
    : "—";

  return (
    <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 p-5 flex flex-col gap-3 group">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-xl shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 text-sm leading-tight line-clamp-1">{goal.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priority.bg} ${priority.text}`}>
                {priority.label}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${status.bg} ${status.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>

          {/* ⋮ menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 z-20 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1">
                <button onClick={() => { onEdit(goal); setMenuOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit goal
                </button>
                <button onClick={() => { onProjection(goal); setMenuOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Projection
                </button>
                <button onClick={() => { onSimulation(goal); setMenuOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                  Simulation
                </button>
                <div className="h-px bg-gray-100 my-1" />
                <button onClick={() => { onDelete(goal.id); setMenuOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
                  </svg>
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Saved / Target */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-black text-gray-900">{formatBD(goal.savedAmount)}</span>
        <span className="text-sm text-gray-400">of {formatBD(goal.targetAmount)}</span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-gray-400">{progress.toFixed(1)}% saved</span>
          {goal.monthlySavingsTarget && (
            <span className="text-xs font-semibold text-[#6b7c3f]">{formatBD(goal.monthlySavingsTarget)}/mo</span>
          )}
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${status.bar}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Financial context strip */}
      {(goal.disposableIncome != null || goal.totalMonthlyCommitment != null) && (
        <div className="grid grid-cols-2 gap-2 bg-gray-50 rounded-xl p-3">
          <div>
            <p className="text-xs text-gray-400 leading-none mb-0.5">Disposable</p>
            <p className="text-xs font-bold text-gray-700">{formatBD(goal.disposableIncome)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 leading-none mb-0.5">Total committed</p>
            <p className="text-xs font-bold text-gray-700">{formatBD(goal.totalMonthlyCommitment)}</p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-50">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          {deadline}
        </div>
        {goal.warningLevel && goal.warningLevel !== "NONE" && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            goal.warningLevel === "RED" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
          }`}>
            {goal.warningLevel === "RED" ? "⚠ Over budget" : "⚠ Ambitious"}
          </span>
        )}
      </div>

      {/* Inline quick-action buttons — always visible */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onProjection(goal)}
          className="flex-1 py-2 text-xs font-semibold text-[#6b7c3f] bg-[#6b7c3f]/8 hover:bg-[#6b7c3f]/15 rounded-lg transition-colors"
        >
          📈 Projection
        </button>
        <button
          onClick={() => onSimulation(goal)}
          className="flex-1 py-2 text-xs font-semibold text-[#2c3347] bg-[#2c3347]/5 hover:bg-[#2c3347]/10 rounded-lg transition-colors"
        >
          🔬 Simulate
        </button>
        <button
          onClick={() => onEdit(goal)}
          className="py-2 px-3 text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          ✏️
        </button>
        <button
          onClick={() => onDelete(goal.id)}
          className="py-2 px-3 text-xs font-semibold text-red-400 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
        >
          🗑️
        </button>
      </div>
    </div>
  );
};

export default GoalCard;