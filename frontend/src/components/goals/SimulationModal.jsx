import { useState }          from "react";
import { goalService }        from "../../services/goalService.js";
import { useAuth }            from "../../context/AuthContext.jsx";
import { EXPENSE_CATEGORY_META } from "../../constants/goals.js";
import { formatBD }           from "../../utils/formatters.js";
import { ModalShell, CloseButton, Spinner } from "../ui/primitives.jsx";

const SimulationModal = ({ goal, userExpenses = [], onClose }) => {
  const { token } = useAuth();
  const [adjustments, setAdjustments] = useState({});
  const [result,  setResult]          = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error,   setError]           = useState(null);

  if (!goal) return null;

  const currentMonthly = parseFloat(goal.monthlySavingsTarget || 0);

  // Map user expenses to display rows
  const expenseRows = userExpenses.map((e) => ({
    category:  e.category,
    label:     EXPENSE_CATEGORY_META[e.category]?.label ?? e.category,
    icon:      EXPENSE_CATEGORY_META[e.category]?.icon  ?? "📦",
    max:       parseFloat(e.amount),
    userLabel: e.label,
  }));

  const totalAdjustment  = Object.values(adjustments).reduce((s, v) => s + (parseFloat(v) || 0), 0);
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
      setResult(
        await goalService.simulate(token, {
          goalId: goal.id,
          currentMonthlySavingsTarget: currentMonthly,
          spendingAdjustments: adj,
        })
      );
    } catch (err) {
      setError(err.message || "Simulation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 pb-4">
        <div>
          <h2 className="text-xl font-black text-gray-900">Spending Simulation</h2>
          <p className="text-sm text-gray-400 mt-0.5">{goal.name} — what if I cut spending?</p>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      <div className="px-6 pb-6 flex flex-col gap-5">
        {/* Current vs simulated summary */}
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
            ⚠ No monthly savings target set. Use the Projection tool first.
          </div>
        )}

        {/* Expense sliders */}
        {expenseRows.length === 0 ? (
          <div className="bg-gray-50 rounded-xl px-4 py-6 text-center text-sm text-gray-400">
            No expense categories found. Make sure you've set up your monthly expenses in your profile.
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              How much could you cut from each category per month?
            </p>
            <div className="flex flex-col gap-2">
              {expenseRows.map((row) => (
                <ExpenseRow
                  key={row.category}
                  row={row}
                  value={adjustments[row.category] ?? ""}
                  onChange={(val) => setAdjustment(row.category, val, row.max)}
                  onBlur={(val) => {
                    const clamped = Math.min(Math.max(parseFloat(val) || 0, 0), row.max);
                    setAdjustments((prev) => ({ ...prev, [row.category]: clamped || "" }));
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Total cut */}
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
          {loading ? <><Spinner /> Simulating...</> : "Run Simulation"}
        </button>

        {/* Results */}
        {result && <SimulationResults result={result} />}
      </div>
    </ModalShell>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const ExpenseRow = ({ row, value, onChange, onBlur }) => {
  const current = parseFloat(value) || 0;
  const pct     = row.max > 0 ? (current / row.max) * 100 : 0;
  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-lg">{row.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-gray-700">{row.label}</span>
            {row.userLabel && <span className="text-xs text-gray-400">({row.userLabel})</span>}
          </div>
          <p className="text-xs text-gray-400">Current: {formatBD(row.max)}/mo</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-gray-400 font-medium">BD</span>
          <input type="number" value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e)   => onBlur(e.target.value)}
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
};

const DualChart = ({ baseline, simulated, target }) => {
  if (!baseline || baseline.length < 2) return null;
  const maxVal = parseFloat(target);
  const w = 480, h = 130, pad = 12;
  const toCoords = (data) =>
    data.map((d, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = h - pad - (Math.min(parseFloat(d.amount), maxVal) / maxVal) * (h - pad * 2);
      return `${x},${y}`;
    });
  const bPts = toCoords(baseline);
  const sPts = toCoords(simulated);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-32">
      <line x1={pad} y1={pad} x2={w - pad} y2={pad} stroke="#6b7c3f" strokeWidth="1" strokeDasharray="4 3" opacity="0.3"/>
      <polyline points={bPts.join(" ")} fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points={sPts.join(" ")} fill="none" stroke="#6b7c3f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <polygon points={`${pad},${h - pad} ${sPts.join(" ")} ${w - pad},${h - pad}`} fill="#6b7c3f" opacity="0.07"/>
    </svg>
  );
};

const SimulationResults = ({ result }) => {
  // Safe date formatter: handles Jackson arrays and strings without UTC shift
  const fmtDate = (val) => {
    if (!val) return "—";
    if (Array.isArray(val)) {
      const [y, m] = val;
      return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    }
    const parts = String(val).split("-").map(Number);
    if (parts.length >= 2) return new Date(parts[0], parts[1] - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    return String(val);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-gray-50 rounded-xl p-3">
        <DualChart
          baseline={result.baselineChart}
          simulated={result.simulatedChart}
          target={result.targetAmount}
        />
        <div className="flex items-center gap-4 justify-center mt-2">
          <ChartLegendItem color="bg-gray-300" label="Without cuts" />
          <ChartLegendItem color="bg-[#6b7c3f]" label="With cuts" />
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
          <p className="text-[#c5d48a] text-xs mt-0.5">by freeing up {formatBD(result.totalAdjustment)}/month</p>
        </div>
      )}

      {result.affordabilityNote && (
        <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-3 leading-relaxed">
          {result.affordabilityNote}
        </p>
      )}
    </div>
  );
};

const ChartLegendItem = ({ color, label }) => (
  <div className="flex items-center gap-1.5">
    <div className={`w-3 h-0.5 ${color} rounded`} />
    <span className="text-xs text-gray-400">{label}</span>
  </div>
);

export default SimulationModal;