import { useState } from "react";
import { goalService } from "../../services/goalService.js";
import { useAuth } from "../../context/AuthContext.jsx";

const formatBD = (v) =>
  v != null
    ? `BD ${parseFloat(v).toLocaleString("en-BH", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`
    : "—";

// ── Chart ─────────────────────────────────────────────────────────────────────
// Root cause of "chart looks the same for all cases":
//
// The old code used `i / (data.length - 1)` for the x position, which
// normalises every projection to fill 100% of the chart width regardless of
// how many months it takes. A 3-month projection and a 36-month one looked
// identical — both just a straight diagonal line from left to right.
//
// Fix: use a FIXED x-axis of GRID_MONTHS (36). Every point is placed at its
// real month position on that grid, so:
//   • High monthly rate  → steep line that reaches the target early (left side)
//   • Low monthly rate   → gentle slope that reaches the target late (right side)
// The slope now visually communicates how fast you're saving.
const GRID_MONTHS = 36;

const ChartLine = ({ data, target, monthsNeeded, deadlineMonths }) => {
  if (!data || data.length < 2) return null;

  const maxVal = parseFloat(target);
  const w = 480, h = 120, pad = 10;

  // Each data point sits at its real index on the 36-month grid
  const toX = (i) => pad + (i / GRID_MONTHS) * (w - pad * 2);
  const toY = (amount) =>
    h - pad - (Math.min(parseFloat(amount), maxVal) / maxVal) * (h - pad * 2);

  const pts = data.map((d, i) => `${toX(i)},${toY(d.amount)}`);

  const lastX    = toX(data.length - 1);
  const targetY  = pad;

  // Deadline marker (amber dashed line) — only shown when deadline is set
  // and completion date differs from deadline
  const showDeadline =
    deadlineMonths != null &&
    deadlineMonths > 0 &&
    Math.abs(deadlineMonths - (data.length - 1)) > 0.5;
  const deadlineX = showDeadline
    ? Math.min(toX(deadlineMonths), w - pad)
    : null;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-28">
      {/* Horizontal grid lines at 25%, 50%, 75% */}
      {[0.25, 0.5, 0.75].map((frac) => {
        const gy = pad + frac * (h - pad * 2);
        return (
          <line key={frac} x1={pad} y1={gy} x2={w - pad} y2={gy}
            stroke="#e5e7eb" strokeWidth="0.5" />
        );
      })}

      {/* Target dashed line at top */}
      <line x1={pad} y1={targetY} x2={w - pad} y2={targetY}
        stroke="#6b7c3f" strokeWidth="1" strokeDasharray="4 3" opacity="0.4" />

      {/* Deadline marker */}
      {showDeadline && (
        <line x1={deadlineX} y1={pad} x2={deadlineX} y2={h - pad}
          stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.7" />
      )}

      {/* Area fill */}
      <polygon
        points={`${pad},${h - pad} ${pts.join(" ")} ${lastX},${h - pad}`}
        fill="#6b7c3f" opacity="0.08"
      />

      {/* Progress line */}
      <polyline points={pts.join(" ")} fill="none"
        stroke="#6b7c3f" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />

      {/* Completion dot */}
      <circle cx={lastX} cy={targetY} r="4" fill="#6b7c3f" />
      <circle cx={lastX} cy={targetY} r="2" fill="white" />
    </svg>
  );
};

// ── Modal ─────────────────────────────────────────────────────────────────────
const ProjectionModal = ({ goal, onClose, onSaved }) => {
  const { token } = useAuth();
  const [rate, setRate] = useState(
    goal?.monthlySavingsTarget ? parseFloat(goal.monthlySavingsTarget).toFixed(3) : ""
  );
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  if (!goal) return null;

  const disposable      = parseFloat(goal.disposableIncome || 0);
  const totalCommitment = parseFloat(goal.totalMonthlyCommitment || 0);
  const currentTarget   = parseFloat(goal.monthlySavingsTarget || 0);
  const alreadyCommitted = totalCommitment - currentTarget;
  const maxAvailable     = Math.max(0, disposable - alreadyCommitted);

  const handleCalculate = async () => {
    const rateVal = parseFloat(rate);
    if (!rateVal || rateVal <= 0) { setError("Enter a valid monthly amount."); return; }
    if (rateVal > maxAvailable)   { setError(`Maximum you can allocate is ${formatBD(maxAvailable)}.`); return; }
    setError(null);
    setLoading(true);
    try {
      const data = await goalService.getProjection(token, goal.id, rateVal);
      setResult(data);
    } catch (err) {
      setError(err.message || "Failed to calculate projection.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setLoading(true);
    try {
      // Projection endpoint already persists the rate — just close and refresh
      onSaved(result);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Convert backend YearMonth deadline string (e.g. "2027-06") to months from now
  const deadlineMonthsFromNow = (() => {
    if (!result?.goalDeadline) return null;
    const [y, m] = result.goalDeadline.split("-").map(Number);
    const now = new Date();
    return (y - now.getFullYear()) * 12 + (m - (now.getMonth() + 1));
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <h2 className="text-xl font-black text-gray-900">Savings Projection</h2>
            <p className="text-sm text-gray-400 mt-0.5">{goal.name}</p>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-5">

          {/* Goal summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-0.5">Target</p>
              <p className="text-sm font-bold text-gray-800">{formatBD(goal.targetAmount)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-0.5">Saved</p>
              <p className="text-sm font-bold text-gray-800">{formatBD(goal.savedAmount)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-0.5">Remaining</p>
              <p className="text-sm font-bold text-gray-800">
                {formatBD(parseFloat(goal.targetAmount) - parseFloat(goal.savedAmount || 0))}
              </p>
            </div>
          </div>

          {/* Affordability info */}
          <div className="bg-[#2c3347]/5 border border-[#2c3347]/10 rounded-xl p-4 flex flex-col gap-2">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Your budget</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Disposable income</span>
              <span className="font-semibold text-gray-800">{formatBD(disposable)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Already committed (other goals)</span>
              <span className="font-semibold text-red-500">− {formatBD(alreadyCommitted)}</span>
            </div>
            <div className="h-px bg-gray-200 my-1" />
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-gray-700">Max for this goal</span>
              <span className="font-black text-[#6b7c3f]">{formatBD(maxAvailable)}</span>
            </div>
          </div>

          {/* Rate input */}
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">
              Monthly savings amount (BD)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={rate}
                onChange={(e) => { setRate(e.target.value); setResult(null); setError(null); }}
                placeholder="0.000"
                step="0.001"
                min="0"
                max={maxAvailable}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-[#6b7c3f] focus:ring-2 focus:ring-[#6b7c3f]/10 outline-none text-sm font-medium transition-all"
              />
              <button
                onClick={handleCalculate}
                disabled={loading}
                className="px-5 py-3 bg-[#2c3347] hover:bg-[#3d4357] text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {loading ? "..." : "Calculate"}
              </button>
            </div>

            {/* Quick-fill buttons at 25 / 50 / 75 / 100% of max */}
            <div className="flex gap-2 mt-2">
              {[0.25, 0.5, 0.75, 1].map((pct) => {
                const val = (maxAvailable * pct).toFixed(3);
                return (
                  <button
                    key={pct}
                    onClick={() => { setRate(val); setResult(null); }}
                    className="flex-1 py-1.5 text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    {Math.round(pct * 100)}%
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 font-medium bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>
          )}

          {/* Results */}
          {result && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-300">

              {/* Chart */}
              <div className="bg-gray-50 rounded-xl p-3">
                <ChartLine
                  data={result.chartData}
                  target={result.targetAmount}
                  monthsNeeded={result.monthsNeeded}
                  deadlineMonths={deadlineMonthsFromNow}
                />
                {/* X-axis labels */}
                <div className="flex justify-between items-center text-xs text-gray-400 mt-1 px-1">
                  <span>Now</span>
                  <span className="text-gray-300 text-center">
                    {result.monthsNeeded} month{result.monthsNeeded !== 1 ? "s" : ""}
                  </span>
                  <span className="text-[#6b7c3f] font-semibold">{result.projectedCompletionDate}</span>
                </div>
                {/* Legend */}
                {deadlineMonthsFromNow != null && (
                  <div className="flex items-center gap-3 justify-center mt-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-0.5 bg-[#6b7c3f] rounded" />
                      <span className="text-xs text-gray-400">Savings progress</span>
                    </div>
                    {showDeadlineLegend(result, deadlineMonthsFromNow) && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-0.5 bg-amber-400 rounded" style={{ borderTop: "2px dashed" }} />
                        <span className="text-xs text-gray-400">Deadline</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Key stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-xl p-4 ${result.isOnTrack ? "bg-emerald-50 border border-emerald-100" : "bg-amber-50 border border-amber-100"}`}>
                  <p className="text-xs font-semibold mb-1 uppercase tracking-wider"
                    style={{ color: result.isOnTrack ? "#059669" : "#d97706" }}>
                    {result.isOnTrack ? "✓ On Track" : "⚠ At Risk"}
                  </p>
                  <p className="text-lg font-black text-gray-900">{result.monthsNeeded} months</p>
                  <p className="text-xs text-gray-500 mt-0.5">to reach goal</p>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Completion</p>
                  <p className="text-sm font-black text-gray-900">{result.projectedCompletionDate}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Deadline: {result.goalDeadline}</p>
                </div>
              </div>

              {result.monthsAheadOrBehind !== 0 && (
                <p className="text-sm text-center font-medium"
                  style={{ color: result.isOnTrack ? "#059669" : "#d97706" }}>
                  {result.isOnTrack
                    ? `${Math.abs(result.monthsAheadOrBehind)} months ahead of deadline 🎉`
                    : `${Math.abs(result.monthsAheadOrBehind)} months behind deadline — consider saving more`}
                </p>
              )}

              <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-3 leading-relaxed">
                {result.affordabilityNote}
              </p>

              <button
                onClick={handleSave}
                disabled={loading}
                className="w-full py-3.5 bg-[#6b7c3f] hover:bg-[#5a6a33] text-white font-bold rounded-xl transition-all disabled:opacity-50"
              >
                Save BD {parseFloat(rate).toFixed(3)}/month to this goal
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper — only show the deadline legend if the deadline line is actually visible
const showDeadlineLegend = (result, deadlineMonths) =>
  deadlineMonths != null &&
  deadlineMonths > 0 &&
  Math.abs(deadlineMonths - result.monthsNeeded) > 0.5;

export default ProjectionModal;