import { useState }          from "react";
import { goalService }        from "../../services/goalService.js";
import { useAuth }            from "../../context/AuthContext.jsx";
import { formatBD }           from "../../utils/formatters.js";
import { ModalShell, CloseButton, Spinner } from "../ui/primitives.jsx";

// ── Chart ─────────────────────────────────────────────────────────────────────
// Fixed 36-month x-axis so slope is proportional to monthly savings rate.
// A high monthly rate → steep line reaching goal early (left side).
// A low monthly rate  → gentle slope reaching goal late (right side).
const GRID_MONTHS = 36;

const ProjectionChart = ({ data, target, deadlineMonths }) => {
  if (!data || data.length < 2) return null;

  const maxVal = parseFloat(target);
  const w = 480, h = 120, pad = 10;
  const toX = (i)      => pad + (i / GRID_MONTHS) * (w - pad * 2);
  const toY = (amount) =>
    h - pad - (Math.min(parseFloat(amount), maxVal) / maxVal) * (h - pad * 2);

  const pts    = data.map((d, i) => `${toX(i)},${toY(d.amount)}`);
  const lastX  = toX(data.length - 1);
  const targetY = pad;

  const showDeadline =
    deadlineMonths != null &&
    deadlineMonths > 0 &&
    Math.abs(deadlineMonths - (data.length - 1)) > 0.5;
  const deadlineX = showDeadline ? Math.min(toX(deadlineMonths), w - pad) : null;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-28">
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((frac) => {
        const gy = pad + frac * (h - pad * 2);
        return <line key={frac} x1={pad} y1={gy} x2={w - pad} y2={gy} stroke="#e5e7eb" strokeWidth="0.5" />;
      })}
      {/* Target line */}
      <line x1={pad} y1={targetY} x2={w - pad} y2={targetY}
        stroke="#6b7c3f" strokeWidth="1" strokeDasharray="4 3" opacity="0.4" />
      {/* Deadline marker */}
      {showDeadline && (
        <line x1={deadlineX} y1={pad} x2={deadlineX} y2={h - pad}
          stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.7" />
      )}
      {/* Area fill */}
      <polygon points={`${pad},${h - pad} ${pts.join(" ")} ${lastX},${h - pad}`}
        fill="#6b7c3f" opacity="0.08" />
      {/* Progress line */}
      <polyline points={pts.join(" ")} fill="none"
        stroke="#6b7c3f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Completion dot */}
      <circle cx={lastX} cy={targetY} r="4" fill="#6b7c3f" />
      <circle cx={lastX} cy={targetY} r="2" fill="white" />
    </svg>
  );
};

// ── Modal ─────────────────────────────────────────────────────────────────────
const ProjectionModal = ({ goal, onClose, onSaved }) => {
  const { token } = useAuth();
  const [rate,    setRate]    = useState(
    goal?.monthlySavingsTarget ? parseFloat(goal.monthlySavingsTarget).toFixed(3) : ""
  );
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  if (!goal) return null;

  const disposable       = parseFloat(goal.disposableIncome || 0);
  const totalCommitment  = parseFloat(goal.totalMonthlyCommitment || 0);
  const currentTarget    = parseFloat(goal.monthlySavingsTarget || 0);
  const alreadyCommitted = totalCommitment - currentTarget;
  const maxAvailable     = Math.max(0, disposable - alreadyCommitted);

  const handleCalculate = async () => {
    const val = parseFloat(rate);
    if (!val || val <= 0)    { setError("Enter a valid monthly amount.");                              return; }
    if (val > maxAvailable)  { setError(`Maximum you can allocate is ${formatBD(maxAvailable)}.`); return; }
    setError(null);
    setLoading(true);
    try {
      setResult(await goalService.getProjection(token, goal.id, val));
    } catch (err) {
      setError(err.message || "Failed to calculate projection.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!result) return;
    onSaved(result);
    onClose();
  };

  const deadlineMonthsFromNow = (() => {
    if (!result?.goalDeadline) return null;
    const [y, m] = result.goalDeadline.split("-").map(Number);
    const now    = new Date();
    return (y - now.getFullYear()) * 12 + (m - (now.getMonth() + 1));
  })();

  const showDeadlineLegend =
    deadlineMonthsFromNow != null &&
    deadlineMonthsFromNow > 0 &&
    result &&
    Math.abs(deadlineMonthsFromNow - result.monthsNeeded) > 0.5;

  return (
    <ModalShell onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 pb-4">
        <div>
          <h2 className="text-xl font-black text-gray-900">Savings Projection</h2>
          <p className="text-sm text-gray-400 mt-0.5">{goal.name}</p>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      <div className="px-6 pb-6 flex flex-col gap-5">
        {/* Goal summary tiles */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Target",    value: formatBD(goal.targetAmount) },
            { label: "Saved",     value: formatBD(goal.savedAmount) },
            {
              label: "Remaining",
              value: formatBD(parseFloat(goal.targetAmount) - parseFloat(goal.savedAmount || 0)),
            },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-0.5">{label}</p>
              <p className="text-sm font-bold text-gray-800">{value}</p>
            </div>
          ))}
        </div>

        {/* Budget breakdown */}
        <div className="bg-[#2c3347]/5 border border-[#2c3347]/10 rounded-xl p-4 flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Your budget</p>
          <BudgetRow label="Disposable income"         value={formatBD(disposable)} />
          <BudgetRow label="Already committed (other goals)"
            value={`− ${formatBD(alreadyCommitted)}`} valueClass="text-red-500" />
          <div className="h-px bg-gray-200 my-1" />
          <BudgetRow label="Max for this goal" value={formatBD(maxAvailable)}
            labelClass="font-semibold text-gray-700" valueClass="font-black text-[#6b7c3f]" />
        </div>

        {/* Rate input */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">
            Monthly savings amount (BD)
          </label>
          <div className="flex gap-2">
            <input type="number" value={rate}
              onChange={(e) => { setRate(e.target.value); setResult(null); setError(null); }}
              placeholder="0.000" step="0.001" min="0" max={maxAvailable}
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-[#6b7c3f] focus:ring-2 focus:ring-[#6b7c3f]/10 outline-none text-sm font-medium transition-all"
            />
            <button onClick={handleCalculate} disabled={loading}
              className="px-5 py-3 bg-[#2c3347] hover:bg-[#3d4357] text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50">
              {loading ? <Spinner size="sm" /> : "Calculate"}
            </button>
          </div>
          {/* Quick-fill buttons */}
          <div className="flex gap-2 mt-2">
            {[0.25, 0.5, 0.75, 1].map((pct) => (
              <button key={pct}
                onClick={() => { setRate((maxAvailable * pct).toFixed(3)); setResult(null); }}
                className="flex-1 py-1.5 text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                {Math.round(pct * 100)}%
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500 font-medium bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>
        )}

        {/* Results */}
        {result && (
          <div className="flex flex-col gap-4">
            {/* Chart */}
            <div className="bg-gray-50 rounded-xl p-3">
              <ProjectionChart
                data={result.chartData}
                target={result.targetAmount}
                deadlineMonths={deadlineMonthsFromNow}
              />
              <div className="flex justify-between items-center text-xs text-gray-400 mt-1 px-1">
                <span>Now</span>
                <span className="text-gray-300">
                  {result.monthsNeeded} month{result.monthsNeeded !== 1 ? "s" : ""}
                </span>
                <span className="text-[#6b7c3f] font-semibold">{result.projectedCompletionDate}</span>
              </div>
              {showDeadlineLegend && (
                <div className="flex items-center gap-3 justify-center mt-2">
                  <LegendItem color="bg-[#6b7c3f]" label="Savings progress" />
                  <LegendItem color="bg-amber-400" label="Deadline" dashed />
                </div>
              )}
            </div>

            {/* Key stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-xl p-4 ${
                result.isOnTrack
                  ? "bg-emerald-50 border border-emerald-100"
                  : "bg-amber-50 border border-amber-100"
              }`}>
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
                  : `${Math.abs(result.monthsAheadOrBehind)} months behind — consider saving more`}
              </p>
            )}

            <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-3 leading-relaxed">
              {result.affordabilityNote}
            </p>

            <button onClick={handleSave} disabled={loading}
              className="w-full py-3.5 bg-[#6b7c3f] hover:bg-[#5a6a33] text-white font-bold rounded-xl transition-all disabled:opacity-50">
              Save BD {parseFloat(rate).toFixed(3)}/month to this goal
            </button>
          </div>
        )}
      </div>
    </ModalShell>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const BudgetRow = ({ label, value, labelClass = "text-gray-500", valueClass = "font-semibold text-gray-800" }) => (
  <div className="flex justify-between text-sm">
    <span className={labelClass}>{label}</span>
    <span className={valueClass}>{value}</span>
  </div>
);

const LegendItem = ({ color, label, dashed = false }) => (
  <div className="flex items-center gap-1.5">
    <div className={`w-3 h-0.5 ${color} rounded ${dashed ? "opacity-70" : ""}`} />
    <span className="text-xs text-gray-400">{label}</span>
  </div>
);

export default ProjectionModal;