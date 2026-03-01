import { useState, useEffect, useMemo } from "react";

const CATEGORIES = [
  { value: "HOUSE",         label: "House",         icon: "🏠" },
  { value: "CAR",           label: "Car",           icon: "🚗" },
  { value: "EDUCATION",     label: "Education",     icon: "📚" },
  { value: "TRAVEL",        label: "Travel",        icon: "✈️" },
  { value: "EMERGENCY_FUND",label: "Emergency Fund",icon: "🛡️" },
  { value: "BUSINESS",      label: "Business",      icon: "💼" },
  { value: "CUSTOM",        label: "Custom",        icon: "🎯" },
];

const PRIORITIES = [
  { value: "HIGH",   label: "High",   color: "text-red-600 bg-red-50 border-red-200" },
  { value: "MEDIUM", label: "Medium", color: "text-orange-600 bg-orange-50 border-orange-200" },
  { value: "LOW",    label: "Low",    color: "text-gray-600 bg-gray-50 border-gray-200" },
];

// today as YYYY-MM for month input min
const todayMonth = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1); // minimum = next month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// Convert YYYY-MM (month input value) → YYYY-MM-DD (last day of month, for backend)
const monthToLastDay = (ym) => {
  if (!ym) return "";
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${last}`;
};

// Convert YYYY-MM-DD → YYYY-MM (for month input value)
const dateToMonth = (d) => {
  if (!d) return "";
  return d.slice(0, 7); // "2028-06-30" → "2028-06"
};

// Calculate suggested deadline from target - saved and monthly rate
const calcDeadline = (targetAmount, savedAmount, monthlyRate) => {
  const target  = parseFloat(targetAmount) || 0;
  const saved   = parseFloat(savedAmount)  || 0;
  const monthly = parseFloat(monthlyRate)  || 0;
  if (target <= 0 || monthly <= 0 || saved >= target) return null;
  const months = Math.ceil((target - saved) / monthly);
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
};

// How many months until a date
const monthsUntil = (dateStr) => {
  if (!dateStr) return null;
  const now = new Date();
  const end = new Date(dateStr);
  return Math.round((end - now) / (1000 * 60 * 60 * 24 * 30.44));
};

// Infer monthly rate from deadline + remaining
const inferMonthly = (targetAmount, savedAmount, deadline) => {
  const months = monthsUntil(deadline);
  if (!months || months <= 0) return null;
  const rem = (parseFloat(targetAmount) || 0) - (parseFloat(savedAmount) || 0);
  if (rem <= 0) return null;
  return (rem / months).toFixed(3);
};

const EMPTY = {
  name: "",
  category: "CUSTOM",
  targetAmount: "",
  savedAmount: "",
  monthlySavingsTarget: "",
  currency: "BHD",
  deadline: "",
  priority: "MEDIUM",
  deadlineMode: "manual", // "manual" | "calculated"
};

const GoalModal = ({ isOpen, onClose, onSubmit, editingGoal, loading, serverError, maxAllocatable = null }) => {
  const [form, setForm]     = useState(EMPTY);
  const [errors, setErrors] = useState({});

  // Reset form on open/switch between create & edit
  useEffect(() => {
    if (!isOpen) return;
    if (editingGoal) {
      setForm({
        name:                 editingGoal.name               || "",
        category:             editingGoal.category           || "CUSTOM",
        targetAmount:         editingGoal.targetAmount       || "",
        savedAmount:          editingGoal.savedAmount        || "",
        monthlySavingsTarget: editingGoal.monthlySavingsTarget || "",
        currency:             editingGoal.currency           || "BHD",
        deadline:             dateToMonth(editingGoal.deadline) || "",
        priority:             editingGoal.priority           || "MEDIUM",
        deadlineMode:         "manual",
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
  }, [editingGoal, isOpen]);

  // Auto-update deadline when in "calculated" mode
  useEffect(() => {
    if (form.deadlineMode !== "calculated") return;
    const suggested = calcDeadline(form.targetAmount, form.savedAmount, form.monthlySavingsTarget);
    if (suggested) {
      // Store as YYYY-MM for the month input
      setForm((prev) => ({ ...prev, deadline: suggested.slice(0, 7) }));
    }
  }, [form.targetAmount, form.savedAmount, form.monthlySavingsTarget, form.deadlineMode]);

  // Auto-infer monthly rate when deadline is set manually and rate is empty
  const inferredMonthly = useMemo(() => {
    if (form.monthlySavingsTarget) return null;
    return inferMonthly(form.targetAmount, form.savedAmount, monthToLastDay(form.deadline));
  }, [form.targetAmount, form.savedAmount, form.deadline, form.monthlySavingsTarget]);

  const monthsLeft = monthsUntil(monthToLastDay(form.deadline));

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const validate = () => {
    const e = {};
    const target  = parseFloat(form.targetAmount);
    const saved   = parseFloat(form.savedAmount);
    const monthly = parseFloat(form.monthlySavingsTarget);

    if (!form.name.trim())
      e.name = "Goal name is required";

    if (!form.targetAmount || isNaN(target) || target <= 0)
      e.targetAmount = "Enter a valid target amount greater than 0";

    if (form.savedAmount !== "" && (isNaN(saved) || saved < 0))
      e.savedAmount = "Already saved must be 0 or more";

    if (form.savedAmount !== "" && !isNaN(saved) && !isNaN(target) && saved > target)
      e.savedAmount = "Amount saved cannot exceed the target amount";

    if (!form.deadline)
      e.deadline = "Deadline is required";
    else if (form.deadline <= dateToMonth(new Date().toISOString()))
      e.deadline = "Deadline must be in the future";

    if (form.monthlySavingsTarget !== "" && (isNaN(monthly) || monthly <= 0))
      e.monthlySavingsTarget = "Monthly savings must be greater than 0";

    if (form.monthlySavingsTarget !== "" && !isNaN(monthly) && maxAllocatable !== null && monthly > maxAllocatable)
      e.monthlySavingsTarget = `Exceeds your available budget. Maximum you can allocate is BD ${maxAllocatable.toFixed(3)}.`;

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const finalMonthly = form.monthlySavingsTarget
      ? parseFloat(form.monthlySavingsTarget)
      : inferredMonthly
      ? parseFloat(inferredMonthly)
      : null;

    onSubmit({
      name:                 form.name.trim(),
      category:             form.category,
      targetAmount:         parseFloat(form.targetAmount),
      savedAmount:          parseFloat(form.savedAmount) || 0,
      monthlySavingsTarget: finalMonthly,
      currency:             form.currency,
      deadline:             monthToLastDay(form.deadline), // YYYY-MM → YYYY-MM-DD
      priority:             form.priority,
    });
  };

  if (!isOpen) return null;

  const remaining     = (parseFloat(form.targetAmount) || 0) - (parseFloat(form.savedAmount) || 0);
  const progressPct   = form.targetAmount > 0 && form.savedAmount
    ? Math.min(100, (parseFloat(form.savedAmount) / parseFloat(form.targetAmount)) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-0 sticky top-0 bg-white z-10 rounded-t-3xl">
          <div>
            <h2 className="text-xl font-black text-gray-900">
              {editingGoal ? "Edit Goal" : "New Goal"}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {editingGoal ? "Update your goal details" : "Set a new financial milestone"}
            </p>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          {/* Server error */}
          {serverError && (
            <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 font-medium flex items-start gap-2">
              <span className="text-base">⚠️</span>
              <span>{serverError}</span>
            </div>
          )}

          {/* Goal name */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Goal Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="e.g. Buy a Car"
              className={`w-full px-4 py-3 rounded-xl border text-sm font-medium placeholder-gray-300 outline-none transition-all ${
                errors.name ? "border-red-300 bg-red-50 focus:ring-red-100" : "border-gray-200 focus:border-[#6b7c3f] focus:ring-2 focus:ring-[#6b7c3f]/10"
              }`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">⚠ {errors.name}</p>}
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Category</label>
            <div className="grid grid-cols-7 gap-1.5">
              {CATEGORIES.map((cat) => (
                <button key={cat.value} type="button"
                  onClick={() => handleChange("category", cat.value)}
                  className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-xs transition-all ${
                    form.category === cat.value
                      ? "border-[#6b7c3f] bg-[#6b7c3f]/5 text-[#6b7c3f] font-semibold"
                      : "border-gray-100 text-gray-400 hover:border-gray-300"
                  }`}>
                  <span className="text-xl">{cat.icon}</span>
                  <span className="truncate w-full text-center text-[10px]">{cat.label.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Target + Saved */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Target Amount (BD)</label>
              <input type="number" value={form.targetAmount}
                onChange={(e) => handleChange("targetAmount", e.target.value)}
                placeholder="0.000" step="0.001" min="0.001"
                className={`w-full px-4 py-3 rounded-xl border text-sm font-medium placeholder-gray-300 outline-none transition-all ${
                  errors.targetAmount ? "border-red-300 bg-red-50" : "border-gray-200 focus:border-[#6b7c3f] focus:ring-2 focus:ring-[#6b7c3f]/10"
                }`}/>
              {errors.targetAmount && <p className="text-xs text-red-500 mt-1.5">⚠ {errors.targetAmount}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Already Saved (BD)</label>
              <input type="number" value={form.savedAmount}
                onChange={(e) => handleChange("savedAmount", e.target.value)}
                placeholder="0.000" step="0.001" min="0"
                max={form.targetAmount || undefined}
                className={`w-full px-4 py-3 rounded-xl border text-sm font-medium placeholder-gray-300 outline-none transition-all ${
                  errors.savedAmount ? "border-red-300 bg-red-50" : "border-gray-200 focus:border-[#6b7c3f] focus:ring-2 focus:ring-[#6b7c3f]/10"
                }`}/>
              {errors.savedAmount && <p className="text-xs text-red-500 mt-1.5">⚠ {errors.savedAmount}</p>}
            </div>
          </div>

          {/* Progress preview */}
          {parseFloat(form.targetAmount) > 0 && (
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>{progressPct.toFixed(1)}% saved</span>
                <span>BD {remaining.toFixed(3)} remaining</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#6b7c3f] rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          )}

          {/* Deadline mode toggle */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Deadline</label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
                <button type="button"
                  onClick={() => handleChange("deadlineMode", "manual")}
                  className={`px-3 py-1.5 transition-colors ${form.deadlineMode === "manual" ? "bg-[#2c3347] text-white" : "text-gray-400 hover:bg-gray-50"}`}>
                  Set manually
                </button>
                <button type="button"
                  onClick={() => handleChange("deadlineMode", "calculated")}
                  className={`px-3 py-1.5 transition-colors ${form.deadlineMode === "calculated" ? "bg-[#2c3347] text-white" : "text-gray-400 hover:bg-gray-50"}`}>
                  Calculate from monthly savings
                </button>
              </div>
            </div>

            {form.deadlineMode === "manual" ? (
              <input type="month" value={form.deadline}
                onChange={(e) => handleChange("deadline", e.target.value)}
                min={todayMonth()}
                className={`w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none transition-all ${
                  errors.deadline ? "border-red-300 bg-red-50" : "border-gray-200 focus:border-[#6b7c3f] focus:ring-2 focus:ring-[#6b7c3f]/10"
                }`}/>
            ) : (
              <div className="bg-[#6b7c3f]/5 border border-[#6b7c3f]/20 rounded-xl px-4 py-3 text-sm">
                {form.deadline
                  ? <span className="font-bold text-[#6b7c3f]">
                      📅 {new Date(monthToLastDay(form.deadline)).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                      {monthsLeft && <span className="text-gray-400 font-normal ml-2">({monthsLeft} months from now)</span>}
                    </span>
                  : <span className="text-gray-400">Enter target amount + monthly savings to auto-calculate</span>
                }
              </div>
            )}
            {errors.deadline && <p className="text-xs text-red-500 mt-1.5">⚠ {errors.deadline}</p>}
          </div>

          {/* Monthly savings */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
              Monthly Savings Target (BD)
              {form.deadlineMode === "calculated" && <span className="text-[#6b7c3f] ml-1">← required for calculation</span>}
              {maxAllocatable !== null && (
                <span className="ml-2 text-gray-400 font-normal normal-case tracking-normal">
                  · max <span className="font-bold text-[#6b7c3f]">BD {maxAllocatable.toFixed(3)}</span> available
                </span>
              )}
            </label>
            <input type="number" value={form.monthlySavingsTarget}
              onChange={(e) => {
                const val = e.target.value;
                handleChange("monthlySavingsTarget", val);
                // Live cap enforcement
                if (maxAllocatable !== null && parseFloat(val) > maxAllocatable) {
                  setErrors((prev) => ({ ...prev, monthlySavingsTarget: `Max available is BD ${maxAllocatable.toFixed(3)}` }));
                }
              }}
              placeholder={form.deadlineMode === "calculated" ? "Required" : "Optional"}
              step="0.001" min="0.001"
              max={maxAllocatable !== null ? maxAllocatable : undefined}
              className={`w-full px-4 py-3 rounded-xl border text-sm font-medium placeholder-gray-300 outline-none transition-all ${
                errors.monthlySavingsTarget ? "border-red-300 bg-red-50" : "border-gray-200 focus:border-[#6b7c3f] focus:ring-2 focus:ring-[#6b7c3f]/10"
              }`}/>
            {errors.monthlySavingsTarget && <p className="text-xs text-red-500 mt-1.5">⚠ {errors.monthlySavingsTarget}</p>}

            {/* Inferred rate hint */}
            {!form.monthlySavingsTarget && inferredMonthly && form.deadline && (
              <div className="mt-2 flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                <span className="text-amber-500 text-base">💡</span>
                <p className="text-xs text-amber-700">
                  To meet your deadline, you need to save{" "}
                  <button type="button" onClick={() => handleChange("monthlySavingsTarget", inferredMonthly)}
                    className="font-black text-[#6b7c3f] underline decoration-dotted">
                    BD {parseFloat(inferredMonthly).toLocaleString("en-BH", { minimumFractionDigits: 3 })}
                  </button>
                  /month. Tap to use.
                </p>
              </div>
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Priority</label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button key={p.value} type="button"
                  onClick={() => handleChange("priority", p.value)}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                    form.priority === p.value ? p.color : "border-gray-100 text-gray-400 bg-white hover:border-gray-200"
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Summary preview */}
          {form.name && parseFloat(form.targetAmount) > 0 && form.deadline >= todayMonth() && (
            <div className="bg-[#2c3347]/5 border border-[#2c3347]/10 rounded-xl p-4 text-sm text-gray-600">
              <p className="font-semibold text-gray-700 mb-2">📋 Goal Summary</p>
              <p>Save <strong className="text-[#6b7c3f]">BD {remaining.toFixed(3)}</strong> more for <strong>{form.name}</strong></p>
              {(form.monthlySavingsTarget || inferredMonthly) && (
                <p className="mt-1">at <strong>BD {parseFloat(form.monthlySavingsTarget || inferredMonthly).toFixed(3)}/month</strong> by {new Date(monthToLastDay(form.deadline)).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="px-5 py-3.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-3.5 bg-[#6b7c3f] hover:bg-[#5a6a33] disabled:bg-gray-200 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                    <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                  </svg>
                  Saving...
                </>
              ) : editingGoal ? "Save Changes" : "Create Goal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GoalModal;