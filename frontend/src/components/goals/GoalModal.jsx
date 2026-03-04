import { useGoalForm }                    from "../../hooks/useGoalForm.js";
import { FormField, ModalShell, CloseButton, inputCn, Spinner } from "../ui/primitives.jsx";
import { GOAL_CATEGORIES, GOAL_PRIORITIES } from "../../constants/goals.js";
import { monthToLastDay, minDeadlineMonth } from "../../utils/goalCalculations.js";

const GoalModal = ({
  isOpen,
  onClose,
  onSubmit,
  editingGoal,
  loading,
  serverError,
  maxAllocatable = null,
}) => {
  const {
    form, errors, handleChange,
    validate, buildPayload,
    inferredMonthly, monthsLeft,
    remaining, progressPct, showSummary,
  } = useGoalForm({ isOpen, editingGoal, maxAllocatable });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) onSubmit(buildPayload());
  };

  return (
    <ModalShell onClose={onClose}>
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
        <CloseButton onClick={onClose} />
      </div>

      <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
        {/* Server error */}
        {serverError && (
          <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 font-medium flex items-start gap-2">
            <span className="text-base">⚠️</span>
            <span>{serverError}</span>
          </div>
        )}

        {/* Name */}
        <FormField label="Goal Name" error={errors.name}>
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="e.g. Buy a Car"
            className={inputCn(Boolean(errors.name))}
          />
        </FormField>

        {/* Category */}
        <FormField label="Category">
          <div className="grid grid-cols-7 gap-1.5">
            {GOAL_CATEGORIES.map((cat) => (
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
        </FormField>

        {/* Target + Saved */}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Target Amount (BD)" error={errors.targetAmount}>
            <input type="number" value={form.targetAmount}
              onChange={(e) => handleChange("targetAmount", e.target.value)}
              placeholder="0.000" step="0.001" min="0.001"
              className={inputCn(Boolean(errors.targetAmount))}
            />
          </FormField>
          <FormField label="Already Saved (BD)" error={errors.savedAmount}>
            <input type="number" value={form.savedAmount}
              onChange={(e) => handleChange("savedAmount", e.target.value)}
              placeholder="0.000" step="0.001" min="0"
              max={form.targetAmount || undefined}
              className={inputCn(Boolean(errors.savedAmount))}
            />
          </FormField>
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

        {/* Deadline */}
        <FormField label="Deadline" error={errors.deadline}>
          {/* Mode toggle */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
              {["manual", "calculated"].map((mode) => (
                <button key={mode} type="button"
                  onClick={() => handleChange("deadlineMode", mode)}
                  className={`px-3 py-1.5 transition-colors ${
                    form.deadlineMode === mode ? "bg-[#2c3347] text-white" : "text-gray-400 hover:bg-gray-50"
                  }`}>
                  {mode === "manual" ? "Set manually" : "Calculate from monthly savings"}
                </button>
              ))}
            </div>
          </div>

          {form.deadlineMode === "manual" ? (
            <input type="month" value={form.deadline}
              onChange={(e) => handleChange("deadline", e.target.value)}
              min={minDeadlineMonth()}
              className={inputCn(Boolean(errors.deadline))}
            />
          ) : (
            <div className="bg-[#6b7c3f]/5 border border-[#6b7c3f]/20 rounded-xl px-4 py-3 text-sm">
              {form.deadline ? (
                <span className="font-bold text-[#6b7c3f]">
                  📅{" "}
                  {new Date(monthToLastDay(form.deadline)).toLocaleDateString("en-GB", {
                    month: "long", year: "numeric",
                  })}
                  {monthsLeft && (
                    <span className="text-gray-400 font-normal ml-2">({monthsLeft} months from now)</span>
                  )}
                </span>
              ) : (
                <span className="text-gray-400">
                  Enter target amount + monthly savings to auto-calculate
                </span>
              )}
            </div>
          )}
        </FormField>

        {/* Monthly savings */}
        <FormField
          label="Monthly Savings Target (BD)"
          hint={
            form.deadlineMode === "calculated"
              ? "← required for calculation"
              : maxAllocatable !== null
              ? `· max BD ${maxAllocatable.toFixed(3)} available`
              : undefined
          }
          error={errors.monthlySavingsTarget}
        >
          <input type="number" value={form.monthlySavingsTarget}
            onChange={(e) => handleChange("monthlySavingsTarget", e.target.value)}
            placeholder={form.deadlineMode === "calculated" ? "Required" : "Optional"}
            step="0.001" min="0.001"
            max={maxAllocatable !== null ? maxAllocatable : undefined}
            className={inputCn(Boolean(errors.monthlySavingsTarget))}
          />
          {!form.monthlySavingsTarget && inferredMonthly && form.deadline && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mt-1">
              <span className="text-amber-500 text-base">💡</span>
              <p className="text-xs text-amber-700">
                To meet your deadline, you need to save{" "}
                <button type="button"
                  onClick={() => handleChange("monthlySavingsTarget", inferredMonthly)}
                  className="font-black text-[#6b7c3f] underline decoration-dotted">
                  BD {parseFloat(inferredMonthly).toLocaleString("en-BH", { minimumFractionDigits: 3 })}
                </button>
                /month. Tap to use.
              </p>
            </div>
          )}
        </FormField>

        {/* Priority */}
        <FormField label="Priority">
          <div className="flex gap-2">
            {GOAL_PRIORITIES.map((p) => (
              <button key={p.value} type="button"
                onClick={() => handleChange("priority", p.value)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                  form.priority === p.value ? p.color : "border-gray-100 text-gray-400 bg-white hover:border-gray-200"
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        </FormField>

        {/* Summary preview */}
        {showSummary && (
          <div className="bg-[#2c3347]/5 border border-[#2c3347]/10 rounded-xl p-4 text-sm text-gray-600">
            <p className="font-semibold text-gray-700 mb-2">📋 Goal Summary</p>
            <p>
              Save{" "}
              <strong className="text-[#6b7c3f]">BD {remaining.toFixed(3)}</strong> more for{" "}
              <strong>{form.name}</strong>
            </p>
            {(form.monthlySavingsTarget || inferredMonthly) && (
              <p className="mt-1">
                at <strong>BD {parseFloat(form.monthlySavingsTarget || inferredMonthly).toFixed(3)}/month</strong>{" "}
                by{" "}
                {new Date(monthToLastDay(form.deadline)).toLocaleDateString("en-GB", {
                  month: "short", year: "numeric",
                })}
              </p>
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
                <Spinner /> Saving...
              </>
            ) : editingGoal ? "Save Changes" : "Create Goal"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

export default GoalModal;