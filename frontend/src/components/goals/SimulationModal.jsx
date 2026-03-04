import { useState } from "react";
import { goalService } from "../../services/goalService.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useGoals } from "../../context/GoalsContext.jsx";

const CATEGORY_META = {
  HOUSING:       { label: "Housing",       icon: "🏠" },
  TRANSPORT:     { label: "Transport",     icon: "🚗" },
  FOOD:          { label: "Food",          icon: "🛒" },
  UTILITIES:     { label: "Utilities",     icon: "⚡" },
  SUBSCRIPTIONS: { label: "Subscriptions", icon: "📱" },
  HEALTHCARE:    { label: "Healthcare",    icon: "❤️" },
  FAMILY:        { label: "Family",        icon: "👨‍👩‍👧" },
  INSURANCE:     { label: "Insurance",     icon: "🛡️" },
  EDUCATION:     { label: "Education",     icon: "📚" },
  OTHER:         { label: "Other",         icon: "📦" },
};

const formatBD = (v) =>
  v != null
    ? `BD ${parseFloat(v).toLocaleString("en-BH", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`
    : "—";

// ── Dual-line chart ───────────────────────────────────────────────────────────
// Bug fixed: polygon fill closed at svg right edge instead of last point's x,
// causing a diagonal spike across the entire chart area.
const DualChart = ({ baseline, simulated, target }) => {
  if (!baseline || baseline.length < 2) return null;

  const maxVal  = parseFloat(target);
  const w = 480, h = 152, padX = 10, padTop = 16, padBottom = 28;
  const chartH  = h - padTop - padBottom;

  const toY = (amount) =>
    padTop + chartH - (Math.min(parseFloat(amount), maxVal) / maxVal) * chartH;

  const toCoords = (data) =>
    data.map((d, i) => ({
      x: padX + (i / (data.length - 1)) * (w - padX * 2),
      y: toY(d.amount),
      month: d.month || "",
    }));

  const bPts = toCoords(baseline);
  const sPts = toCoords(simulated);
  const botY = padTop + chartH;

  const polyStr = (pts) => pts.map((p) => `${p.x},${p.y}`).join(" ");
  const fillStr = (pts) => {
    const first = pts[0];
    const last  = pts[pts.length - 1];
    return `${first.x},${botY} ${polyStr(pts)} ${last.x},${botY}`;
  };

  const fmtLabel = (monthStr) => {
    if (!monthStr) return "";
    const [y, m] = String(monthStr).split("-");
    if (!y || !m) return monthStr;
    return new Date(parseInt(y), parseInt(m) - 1)
      .toLocaleString("en-GB", { month: "short", year: "2-digit" });
  };

  const labelIdxs = [0, Math.floor((bPts.length - 1) / 2), bPts.length - 1];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-36">
      {/* Target dashed line */}
      <line x1={padX} y1={padTop} x2={w - padX} y2={padTop}
        stroke="#6b7c3f" strokeWidth="1" strokeDasharray="4 3" opacity="0.3" />
      <text x={w - padX - 2} y={padTop - 3} fontSize="9" fill="#6b7c3f"
        textAnchor="end" opacity="0.5">Target</text>

      {/* Simulated fill */}
      <polygon points={fillStr(sPts)} fill="#6b7c3f" opacity="0.07" />

      {/* Baseline (grey) */}
      <polyline points={polyStr(bPts)} fill="none" stroke="#cbd5e1" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />

      {/* Simulated (green) */}
      <polyline points={polyStr(sPts)} fill="none" stroke="#6b7c3f" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />

      {/* End dots */}
      <circle cx={bPts[bPts.length - 1].x} cy={bPts[bPts.length - 1].y} r="3"   fill="#cbd5e1" />
      <circle cx={sPts[sPts.length - 1].x} cy={sPts[sPts.length - 1].y} r="3.5" fill="#6b7c3f" />

      {/* X-axis labels */}
      {labelIdxs.map((idx) => (
        <text key={idx} x={bPts[idx].x} y={h - 5} fontSize="9" fill="#9ca3af"
          textAnchor={idx === 0 ? "start" : idx === bPts.length - 1 ? "end" : "middle"}>
          {fmtLabel(bPts[idx].month)}
        </text>
      ))}
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const SimulationModal = ({ goal, onClose }) => {
  const { token }    = useAuth();
  // FIX: read expenses from GoalsContext directly.
  // Previously this component got `userExpenses` as a prop from GoalsPage,
  // but after the context refactor GoalsPage no longer passes that prop,
  // causing the "No expense categories found" message even when the user
  // had expenses. Reading from context ensures we always have fresh data.
  const { expenses } = useGoals();

  const [adjustments, setAdjustments] = useState({});
  const [result, setResult]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);

  if (!goal) return null;

  const currentMonthly = parseFloat(goal.monthlySavingsTarget || 0);

  // Normalise expense rows — API returns [{ category, amount, label? }]
  const expenseRows = (expenses || [])
    .filter((e) => e && e.category && parseFloat(e.amount) > 0)
    .map((e) => ({
      category:  e.category,
      label:     CATEGORY_META[e.category]?.label || e.category,
      icon:      CATEGORY_META[e.category]?.icon  || "📦",
      max:       parseFloat(e.amount),
      userLabel: e.label || null,
    }));

  const totalAdjustment  = Object.values(adjustments)
    .reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  const simulatedMonthly = currentMonthly + totalAdjustment;

  const setAdjustment = (cat, rawVal, max) => {
    const val = Math.min(Math.max(parseFloat(rawVal) || 0, 0), max);
    setAdjustments((prev) => ({ ...prev, [cat]: val || "" }));
    setResult(null);
    setError(null);
  };

  const handleSimulate = async () => {
    if (currentMonthly <= 0) {
      setError("Set a monthly savings target for this goal first (via Projection).");
      return;
    }
    if (totalAdjustment <= 0) {
      setError("Enter at least one spending cut to simulate.");
      return;
    }
    const adj = {};
    Object.entries(adjustments).forEach(([k, v]) => {
      if (parseFloat(v) > 0) adj[k] = parseFloat(v);
    });
    setError(null);
    setLoading(true);
    try {
      const data = await goalService.simulate(token, {
        goalId: goal.id,
        currentMonthlySavingsTarget: currentMonthly,
        spendingAdjustments: adj,
      });
      setResult(data);
    } catch (err) {
      setError(err.message || "Simulation failed.");
    } finally {
      setLoading(false);
    }
  };

  const fmtDate = (val) => {
    if (!val) return "—";
    // Jackson may serialise LocalDate as [2027, 11, 4] array or "2027-11-04" string.
    // Either way we only need YYYY-MM, so extract year+month directly
    // without constructing a Date object (avoids timezone shifting).
    if (Array.isArray(val)) {
      // [year, month, day] — month is 1-based
      const [y, m] = val;
      return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    }
    const s = String(val);
    // "YYYY-MM-DD" or "YYYY-MM"
    const parts = s.split("-");
    if (parts.length >= 2) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1; // 0-based for Date
      return new Date(y, m, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    }
    return s;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <h2 className="text-xl font-black text-gray-900">Spending Simulation</h2>
            <p className="text-sm text-gray-400 mt-0.5">{goal.name} — what if I cut spending?</p>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-5">

          {/* Current vs simulated header */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Current monthly savings</p>
              <p className="text-lg font-black text-gray-900 mt-0.5">{formatBD(currentMonthly)}</p>
            </div>
            {totalAdjustment > 0 && (
              <div className="text-right">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Simulated</p>
                <p className="text-lg font-black text-[#6b7c3f] mt-0.5">{formatBD(simulatedMonthly)}</p>
              </div>
            )}
          </div>

          {currentMonthly <= 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700 font-medium">
              ⚠ No monthly savings target set for this goal. Use the Projection tool first.
            </div>
          )}

          {/* Expense rows */}
          {expenseRows.length === 0 ? (
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-5 text-center">
              <p className="text-sm font-semibold text-amber-700 mb-1">No expense data found</p>
              <p className="text-xs text-amber-600 leading-relaxed">
                Make sure you've entered your monthly expenses during sign-up or in your
                profile settings. Once saved they'll appear here automatically.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                How much could you cut from each category per month?
              </p>
              <div className="flex flex-col gap-2">
                {expenseRows.map((row) => {
                  const current = parseFloat(adjustments[row.category]) || 0;
                  const pct     = row.max > 0 ? (current / row.max) * 100 : 0;
                  return (
                    <div key={row.category} className="bg-gray-50 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg">{row.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-gray-700">{row.label}</span>
                            {row.userLabel && (
                              <span className="text-xs text-gray-400">({row.userLabel})</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">Current: {formatBD(row.max)}/mo</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs text-gray-400 font-medium">BD</span>
                          <input
                            type="number"
                            value={adjustments[row.category] ?? ""}
                            onChange={(e) => setAdjustment(row.category, e.target.value, row.max)}
                            onBlur={(e) => {
                              const clamped = Math.min(Math.max(parseFloat(e.target.value) || 0, 0), row.max);
                              setAdjustments((prev) => ({ ...prev, [row.category]: clamped || "" }));
                            }}
                            placeholder="0.000" step="0.001" min="0" max={row.max}
                            className="w-24 text-sm font-semibold text-right bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#6b7c3f] focus:ring-1 focus:ring-[#6b7c3f]/20 transition-all"
                          />
                        </div>
                      </div>
                      {current > 0 && (
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-[#6b7c3f] rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      )}
                      {current >= row.max && row.max > 0 && (
                        <p className="text-xs text-amber-600 mt-1">Max cut — you'd eliminate this expense entirely</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {totalAdjustment > 0 && (
            <div className="flex items-center justify-between bg-[#6b7c3f]/5 border border-[#6b7c3f]/20 rounded-xl px-4 py-3">
              <span className="text-sm font-semibold text-gray-700">Total monthly savings freed up</span>
              <span className="text-sm font-black text-[#6b7c3f]">+ {formatBD(totalAdjustment)}/mo</span>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500 font-medium bg-red-50 px-4 py-2.5 rounded-xl">⚠ {error}</p>
          )}

          <button onClick={handleSimulate}
            disabled={loading || totalAdjustment <= 0 || expenseRows.length === 0}
            className="w-full py-3.5 bg-[#2c3347] hover:bg-[#3d4357] disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2">
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                  <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                </svg>
                Simulating...
              </>
            ) : "Run Simulation"}
          </button>

          {result && (
            <div className="flex flex-col gap-4">
              <div className="bg-gray-50 rounded-xl p-3">
                <DualChart
                  baseline={result.baselineChart}
                  simulated={result.simulatedChart}
                  target={result.targetAmount}
                />
                <div className="flex items-center gap-4 justify-center mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-gray-300 rounded" />
                    <span className="text-xs text-gray-400">Without cuts</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-[#6b7c3f] rounded" />
                    <span className="text-xs text-gray-400">With cuts</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Without cuts</p>
                  <p className="text-sm font-black text-gray-700">{fmtDate(result.baselineCompletionDate)}</p>
                  <p className="text-xs text-gray-400">{result.baselineMonths} months</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                  <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider mb-1">With cuts</p>
                  <p className="text-sm font-black text-gray-900">{fmtDate(result.simulatedCompletionDate)}</p>
                  <p className="text-xs text-emerald-600">{result.simulatedMonths} months</p>
                </div>
              </div>

              {result.monthsSaved > 0 && (
                <div className="bg-[#6b7c3f] rounded-xl px-4 py-3 text-center">
                  <p className="text-white font-black text-lg">🎉 {result.monthsSaved} months faster!</p>
                  <p className="text-[#c5d48a] text-xs mt-0.5">
                    by freeing up {formatBD(result.totalAdjustment)}/month
                  </p>
                </div>
              )}

              {result.affordabilityNote && (
                <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-3 leading-relaxed">
                  {result.affordabilityNote}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimulationModal;