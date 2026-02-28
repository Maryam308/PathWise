import { useState, useEffect } from "react";

// Values must match backend GoalCategory enum exactly:
// HOUSE, CAR, EDUCATION, TRAVEL, EMERGENCY_FUND, BUSINESS, CUSTOM
const CATEGORIES = [
  { value: "HOUSE",         label: "House",          icon: "🏠" },
  { value: "CAR",           label: "Car",            icon: "🚗" },
  { value: "EDUCATION",     label: "Education",      icon: "📚" },
  { value: "TRAVEL",        label: "Travel",         icon: "✈️" },
  { value: "EMERGENCY_FUND",label: "Emergency Fund", icon: "🛡️" },
  { value: "BUSINESS",      label: "Business",       icon: "💼" },
  { value: "CUSTOM",        label: "Custom",         icon: "🎯" },
];

const PRIORITIES = [
  { value: "HIGH", label: "High", color: "text-red-600 bg-red-50 border-red-200" },
  { value: "MEDIUM", label: "Medium", color: "text-orange-600 bg-orange-50 border-orange-200" },
  { value: "LOW", label: "Low", color: "text-gray-600 bg-gray-50 border-gray-200" },
];

const EMPTY = {
  name: "",
  category: "CUSTOM",
  targetAmount: "",
  savedAmount: "",
  monthlySavingsTarget: "",
  currency: "BHD",
  deadline: "",
  priority: "MEDIUM",
};

const GoalModal = ({ isOpen, onClose, onSubmit, editingGoal, loading, serverError }) => {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (editingGoal) {
      setForm({
        name: editingGoal.name || "",
        category: editingGoal.category || "OTHER",
        targetAmount: editingGoal.targetAmount || "",
        savedAmount: editingGoal.savedAmount || "",
        monthlySavingsTarget: editingGoal.monthlySavingsTarget || "",
        currency: editingGoal.currency || "BHD",
        deadline: editingGoal.deadline || "",
        priority: editingGoal.priority || "MEDIUM",
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
  }, [editingGoal, isOpen]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Goal name is required";
    if (!form.targetAmount || isNaN(form.targetAmount) || parseFloat(form.targetAmount) <= 0)
      e.targetAmount = "Enter a valid target amount";
    if (!form.deadline) e.deadline = "Deadline is required";
    if (form.savedAmount && isNaN(form.savedAmount)) e.savedAmount = "Must be a number";
    if (form.monthlySavingsTarget && isNaN(form.monthlySavingsTarget)) e.monthlySavingsTarget = "Must be a number";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      ...form,
      targetAmount: parseFloat(form.targetAmount),
      savedAmount: parseFloat(form.savedAmount) || 0,
      monthlySavingsTarget: form.monthlySavingsTarget ? parseFloat(form.monthlySavingsTarget) : null,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-0">
          <div>
            <h2 className="text-xl font-black text-gray-900">
              {editingGoal ? "Edit Goal" : "New Goal"}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {editingGoal ? "Update your goal details" : "Set a new financial milestone"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          {serverError && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 font-medium">
              {serverError}
            </div>
          )}

          {/* Goal name */}
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">Goal Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="e.g. Buy an Apartment"
              className={`w-full px-4 py-3 rounded-xl border text-sm font-medium placeholder-gray-300 outline-none transition-all ${errors.name ? "border-red-300 bg-red-50" : "border-gray-200 focus:border-[#6b7c3f] focus:ring-2 focus:ring-[#6b7c3f]/10"}`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">Category</label>
            <div className="grid grid-cols-5 gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => handleChange("category", cat.value)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-xs transition-all ${
                    form.category === cat.value
                      ? "border-[#6b7c3f] bg-[#6b7c3f]/5 text-[#6b7c3f] font-semibold"
                      : "border-gray-100 text-gray-500 hover:border-gray-200"
                  }`}
                >
                  <span className="text-lg">{cat.icon}</span>
                  <span className="truncate w-full text-center">{cat.label.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">Target Amount (BD)</label>
              <input
                type="number"
                value={form.targetAmount}
                onChange={(e) => handleChange("targetAmount", e.target.value)}
                placeholder="50,000.000"
                step="0.001"
                min="0"
                className={`w-full px-4 py-3 rounded-xl border text-sm font-medium placeholder-gray-300 outline-none transition-all ${errors.targetAmount ? "border-red-300 bg-red-50" : "border-gray-200 focus:border-[#6b7c3f] focus:ring-2 focus:ring-[#6b7c3f]/10"}`}
              />
              {errors.targetAmount && <p className="text-xs text-red-500 mt-1">{errors.targetAmount}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">Already Saved (BD)</label>
              <input
                type="number"
                value={form.savedAmount}
                onChange={(e) => handleChange("savedAmount", e.target.value)}
                placeholder="0.000"
                step="0.001"
                min="0"
                className={`w-full px-4 py-3 rounded-xl border text-sm font-medium placeholder-gray-300 outline-none transition-all ${errors.savedAmount ? "border-red-300 bg-red-50" : "border-gray-200 focus:border-[#6b7c3f] focus:ring-2 focus:ring-[#6b7c3f]/10"}`}
              />
              {errors.savedAmount && <p className="text-xs text-red-500 mt-1">{errors.savedAmount}</p>}
            </div>
          </div>

          {/* Monthly target & deadline */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">Monthly Target (BD)</label>
              <input
                type="number"
                value={form.monthlySavingsTarget}
                onChange={(e) => handleChange("monthlySavingsTarget", e.target.value)}
                placeholder="Optional"
                step="0.001"
                min="0"
                className={`w-full px-4 py-3 rounded-xl border text-sm font-medium placeholder-gray-300 outline-none transition-all ${errors.monthlySavingsTarget ? "border-red-300 bg-red-50" : "border-gray-200 focus:border-[#6b7c3f] focus:ring-2 focus:ring-[#6b7c3f]/10"}`}
              />
              {errors.monthlySavingsTarget && <p className="text-xs text-red-500 mt-1">{errors.monthlySavingsTarget}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">Deadline</label>
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => handleChange("deadline", e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none transition-all ${errors.deadline ? "border-red-300 bg-red-50" : "border-gray-200 focus:border-[#6b7c3f] focus:ring-2 focus:ring-[#6b7c3f]/10"}`}
              />
              {errors.deadline && <p className="text-xs text-red-500 mt-1">{errors.deadline}</p>}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">Priority</label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => handleChange("priority", p.value)}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                    form.priority === p.value ? p.color : "border-gray-100 text-gray-400 bg-white hover:border-gray-200"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3.5 bg-[#6b7c3f] hover:bg-[#5a6a33] disabled:bg-gray-200 text-white font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                    <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
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