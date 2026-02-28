export const GOAL_CATEGORIES = [
  "SAVINGS",
  "TRAVEL",
  "EDUCATION",
  "VEHICLE",
  "PROPERTY",
  "EMERGENCY",
  "OTHER",
];

export const GOAL_PRIORITIES = ["LOW", "MEDIUM", "HIGH"];

export const EXPENSE_CATEGORIES = [
  { key: "HOUSING", label: "Housing", icon: "🏠" },
  { key: "TRANSPORT", label: "Transport", icon: "🚗" },
  { key: "UTILITIES", label: "Utilities", icon: "💡" },
  { key: "FOOD", label: "Food", icon: "🛒" },
  { key: "HEALTHCARE", label: "Healthcare", icon: "🏥" },
  { key: "EDUCATION", label: "Education", icon: "🎓" },
  { key: "SUBSCRIPTIONS", label: "Subscriptions", icon: "📱" },
  { key: "FAMILY", label: "Family", icon: "👨‍👩‍👧" },
  { key: "INSURANCE", label: "Insurance", icon: "🛡️" },
  { key: "OTHER", label: "Other", icon: "📦" },
];

export const STATUS = {
  ON_TRACK: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-400",
    label: "On Track",
  },
  AT_RISK: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-400",
    label: "At Risk",
  },
  COMPLETED: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-400",
    label: "Completed",
  },
};

export const fmt = (n) =>
  n != null ? `BD ${parseFloat(n).toFixed(3)}` : "—";

export const pctFmt = (n) =>
  n != null ? `${parseFloat(n).toFixed(1)}%` : "—";