import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { profileService } from "../../services/profileService.js";

const EXPENSE_CATEGORIES = [
  { value: "HOUSING",       label: "Housing",       icon: "🏠" },
  { value: "TRANSPORT",     label: "Transport",     icon: "🚗" },
  { value: "FOOD",          label: "Food",          icon: "🛒" },
  { value: "UTILITIES",     label: "Utilities",     icon: "⚡" },
  { value: "SUBSCRIPTIONS", label: "Subscriptions", icon: "📱" },
  { value: "HEALTHCARE",    label: "Healthcare",    icon: "❤️" },
  { value: "FAMILY",        label: "Family",        icon: "👨‍👩‍👧" },
  { value: "INSURANCE",     label: "Insurance",     icon: "🛡️" },
  { value: "EDUCATION",     label: "Education",     icon: "📚" },
  { value: "OTHER",         label: "Other",         icon: "📦" },
];

const META = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.value, c]));

const formatBD = (v) =>
  v != null
    ? `BD ${parseFloat(v).toLocaleString("en-BH", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      })}`
    : "—";

// ── Toggle switch ─────────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0 focus:outline-none ${
      checked ? "bg-[#6b7c3f]" : "bg-gray-200"
    }`}
  >
    <div
      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
        checked ? "translate-x-4" : "translate-x-0.5"
      }`}
    />
  </button>
);

// ── Main component ────────────────────────────────────────────────────────────
const ExpensesSection = () => {
  const { token } = useAuth();

  const [expenses, setExpenses] = useState([]);
  const [editing,  setEditing]  = useState(false);
  const [draft,    setDraft]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);
  const [success,  setSuccess]  = useState(false);
  const [monthlySalary, setMonthlySalary] = useState(null);

  // ── Load profile to get monthly salary ─────────────────────────────────────
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profile = await profileService.getProfile(token);
        setMonthlySalary(profile.monthlySalary);
      } catch (err) {
        console.error("Failed to fetch profile:", err);
      }
    };
    fetchProfile();
  }, [token]);

  // ── Load expenses ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    profileService.getExpenses(token)
      .then((data) => { if (!cancelled) setExpenses(data); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  // ── Start editing ───────────────────────────────────────────────────────────
  const startEdit = () => {
    const byCategory = Object.fromEntries(expenses.map((e) => [e.category, e]));
    setDraft(
      EXPENSE_CATEGORIES.map((cat) => ({
        category: cat.value,
        label:    byCategory[cat.value]?.label  ?? "",
        amount:   byCategory[cat.value]?.amount != null ? String(byCategory[cat.value].amount) : "",
        enabled:  byCategory[cat.value] != null,
      }))
    );
    setEditing(true);
    setError(null);
    setSuccess(false);
  };

  const cancelEdit = () => { setEditing(false); setError(null); };

  // ── Save with validation ───────────────────────────────────────────────────
  const handleSave = async () => {
    const enabledExpenses = draft.filter((r) => r.enabled && parseFloat(r.amount) > 0);

    // Check for duplicate categories
    const categories = enabledExpenses.map(e => e.category);
    const uniqueCategories = new Set(categories);
    if (uniqueCategories.size !== categories.length) {
      setError("Cannot have multiple expenses with the same category");
      return;
    }

    // Calculate total expenses
    const totalExpenses = enabledExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    // Validate against monthly salary
    if (monthlySalary && totalExpenses > parseFloat(monthlySalary)) {
      setError(`Total expenses (BD ${totalExpenses.toFixed(3)}) cannot exceed monthly salary (BD ${parseFloat(monthlySalary).toFixed(3)})`);
      return;
    }

    const payload = enabledExpenses.map((r) => ({
      category: r.category,
      label:    r.label.trim() || null,
      amount:   parseFloat(r.amount),
    }));

    setSaving(true);
    setError(null);
    try {
      await profileService.updateExpenses(token, payload);
      const fresh = await profileService.getExpenses(token);
      setExpenses(fresh);
      setEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || "Failed to save expenses.");
    } finally {
      setSaving(false);
    }
  };

  const updateDraft = (idx, field, value) =>
    setDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));

  const totalMonthly = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mt-2">
        <div className="h-4 w-36 bg-gray-100 rounded animate-pulse mb-4" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-13 bg-gray-50 rounded-xl mb-2 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-2">

      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Monthly Expenses</h3>
          {!editing && expenses.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              Total:{" "}
              <span className="font-semibold text-gray-600">{formatBD(totalMonthly)}/mo</span>
            </p>
          )}
        </div>
        {!editing ? (
          <button
            onClick={startEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#6b7c3f] bg-[#6b7c3f]/8 hover:bg-[#6b7c3f]/15 rounded-lg transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={cancelEdit}
              className="px-3 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-bold text-white bg-[#6b7c3f] hover:bg-[#5a6a33] disabled:bg-gray-300 rounded-lg transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>

      {/* Success message */}
      {success && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5 text-xs text-emerald-700 font-medium mb-3">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Expenses updated successfully!
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl mb-3">
          ⚠ {error}
        </p>
      )}

      {/* ── VIEW MODE ────────────────────────────────────────────────────────── */}
      {!editing && (
        <>
          {expenses.length === 0 ? (
            <div className="bg-gray-50 rounded-xl px-4 py-8 text-center border border-dashed border-gray-200">
              <p className="text-sm text-gray-400 mb-2">No monthly expenses set up yet.</p>
              <button
                onClick={startEdit}
                className="text-sm font-semibold text-[#6b7c3f] underline decoration-dotted hover:text-[#5a6a33] transition-colors"
              >
                Add your monthly expenses
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {expenses.map((exp) => {
                const meta = META[exp.category] || { label: exp.category, icon: "📦" };
                return (
                  <div
                    key={exp.category}
                    className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3"
                  >
                    <span className="text-lg">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-700">{meta.label}</p>
                      {exp.label && (
                        <p className="text-xs text-gray-400 truncate">{exp.label}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold text-gray-900">
                        {formatBD(exp.amount)}
                      </span>
                      <span className="text-xs text-gray-400">/mo</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── EDIT MODE ────────────────────────────────────────────────────────── */}
      {editing && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-400 mb-1">
            Toggle on categories you have expenses for, then enter the monthly amount.
          </p>
          {draft.map((row, idx) => {
            const meta = META[row.category];
            return (
              <div
                key={row.category}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-150 ${
                  row.enabled
                    ? "bg-[#6b7c3f]/5 border border-[#6b7c3f]/15"
                    : "bg-gray-50 opacity-55"
                }`}
              >
                <Toggle
                  checked={row.enabled}
                  onChange={() => updateDraft(idx, "enabled", !row.enabled)}
                />
                <span className="text-lg shrink-0">{meta.icon}</span>
                <span className="text-sm font-semibold text-gray-700 w-24 shrink-0">
                  {meta.label}
                </span>

                {row.enabled && (
                  <>
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) => updateDraft(idx, "label", e.target.value)}
                      placeholder="Label (optional)"
                      className="flex-1 min-w-0 text-xs border border-gray-200 bg-white rounded-lg px-2.5 py-1.5 outline-none focus:border-[#6b7c3f] focus:ring-1 focus:ring-[#6b7c3f]/20 transition-all placeholder-gray-300"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-gray-400 font-medium">BD</span>
                      <input
                        type="number"
                        value={row.amount}
                        onChange={(e) => updateDraft(idx, "amount", e.target.value)}
                        placeholder="0.000"
                        step="0.001"
                        min="0"
                        className="w-24 text-sm font-semibold text-right border border-gray-200 bg-white rounded-lg px-2 py-1.5 outline-none focus:border-[#6b7c3f] focus:ring-1 focus:ring-[#6b7c3f]/20 transition-all"
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ExpensesSection;