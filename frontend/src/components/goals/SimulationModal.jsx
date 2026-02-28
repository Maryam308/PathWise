import { useState } from "react";
import { goalService } from "../../services/goalService.js";
import { useAuth } from "../../context/AuthContext.jsx";

const EXPENSE_CATEGORIES = [
  { value: "HOUSING",       label: "Housing",      icon: "🏠" },
  { value: "TRANSPORT",     label: "Transport",    icon: "🚗" },
  { value: "FOOD",          label: "Food",         icon: "🛒" },
  { value: "UTILITIES",     label: "Utilities",    icon: "⚡" },
  { value: "SUBSCRIPTIONS", label: "Subscriptions",icon: "📱" },
  { value: "HEALTHCARE",    label: "Healthcare",   icon: "❤️" },
  { value: "FAMILY",        label: "Family",       icon: "👨‍👩‍👧" },
  { value: "OTHER",         label: "Other",        icon: "📦" },
];

const formatBD = (v) =>
  v != null
    ? `BD ${parseFloat(v).toLocaleString("en-BH", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`
    : "—";

const SimulationModal = ({ goal, onClose }) => {
  const { token } = useAuth();
  const [adjustments, setAdjustments] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!goal) return null;

  const currentMonthly = parseFloat(goal.monthlySavingsTarget || 0);

  const totalAdjustment = Object.values(adjustments).reduce(
    (sum, v) => sum + (parseFloat(v) || 0), 0
  );
  const simulatedMonthly = currentMonthly + totalAdjustment;

  const setAdjustment = (cat, val) => {
    setAdjustments((prev) => ({ ...prev, [cat]: val }));
    setResult(null);
    setError(null);
  };

  const handleSimulate = async () => {
    if (currentMonthly <= 0) {
      setError("Set a monthly savings target for this goal first (via Projection).");
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

  // Dual line SVG chart
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
        <line x1={pad} y1={pad} x2={w - pad} y2={pad} stroke="#6b7c3f" strokeWidth="1" strokeDasharray="4 3" opacity="0.3" />
        {/* baseline */}
        <polyline points={bPts.join(" ")} fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* simulated */}
        <polyline points={sPts.join(" ")} fill="none" stroke="#6b7c3f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <polygon points={`${pad},${h - pad} ${sPts.join(" ")} ${w - pad},${h - pad}`} fill="#6b7c3f" opacity="0.07" />
      </svg>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <h2 className="text-xl font-black text-gray-900">Spending Simulation</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {goal.name} — what if I cut spending?
            </p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-5">
          {/* Current baseline */}
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
              ⚠ No monthly savings target set. Use Projection first to set a target.
            </div>
          )}

          {/* Expense cuts */}
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">
              How much could you cut from each category per month?
            </p>
            <div className="flex flex-col gap-2">
              {EXPENSE_CATEGORIES.map((cat) => (
                <div key={cat.value} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5">
                  <span className="text-lg">{cat.icon}</span>
                  <span className="flex-1 text-sm font-medium text-gray-700">{cat.label}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-gray-400 font-medium">BD</span>
                    <input
                      type="number"
                      value={adjustments[cat.value] || ""}
                      onChange={(e) => setAdjustment(cat.value, e.target.value)}
                      placeholder="0.000"
                      step="0.001"
                      min="0"
                      className="w-24 text-sm font-semibold text-right bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#6b7c3f] focus:ring-1 focus:ring-[#6b7c3f]/20 transition-all"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total savings increase */}
          {totalAdjustment > 0 && (
            <div className="flex items-center justify-between bg-[#6b7c3f]/5 border border-[#6b7c3f]/20 rounded-xl px-4 py-3">
              <span className="text-sm font-semibold text-gray-700">Extra savings from cuts</span>
              <span className="text-sm font-black text-[#6b7c3f]">+ {formatBD(totalAdjustment)}/mo</span>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500 font-medium bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>
          )}

          <button
            onClick={handleSimulate}
            disabled={loading || totalAdjustment <= 0}
            className="w-full py-3.5 bg-[#2c3347] hover:bg-[#3d4357] disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                  <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                Simulating...
              </>
            ) : "Run Simulation"}
          </button>

          {/* Results */}
          {result && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-300">
              <div className="bg-gray-50 rounded-xl p-3">
                <DualChart
                  baseline={result.baselineChart}
                  simulated={result.simulatedChart}
                  target={result.targetAmount}
                />
                <div className="flex items-center gap-4 justify-center mt-2">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-gray-300 rounded" /><span className="text-xs text-gray-400">Without cuts</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-[#6b7c3f] rounded" /><span className="text-xs text-gray-400">With cuts</span></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Without cuts</p>
                  <p className="text-sm font-black text-gray-700">{result.baselineCompletionDate}</p>
                  <p className="text-xs text-gray-400">{result.baselineMonths} months</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                  <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider mb-1">With cuts</p>
                  <p className="text-sm font-black text-gray-900">{result.simulatedCompletionDate}</p>
                  <p className="text-xs text-emerald-600">{result.simulatedMonths} months</p>
                </div>
              </div>

              {result.monthsSaved > 0 && (
                <div className="bg-[#6b7c3f] rounded-xl px-4 py-3 text-center">
                  <p className="text-white font-black text-lg">🎉 {result.monthsSaved} months faster</p>
                  <p className="text-[#c5d48a] text-xs mt-0.5">by cutting {formatBD(result.totalAdjustment)}/month from your expenses</p>
                </div>
              )}

              <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-3 leading-relaxed">
                {result.affordabilityNote}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimulationModal;