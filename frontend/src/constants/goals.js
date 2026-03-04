/**
 * Shared constants for the goals feature.
 * Single source of truth — previously duplicated in GoalModal, GoalCard,
 * AICoachWidget, and SimulationModal.
 */

export const GOAL_CATEGORIES = [
  { value: "HOUSE",          label: "House",          icon: "🏠" },
  { value: "CAR",            label: "Car",            icon: "🚗" },
  { value: "EDUCATION",      label: "Education",      icon: "📚" },
  { value: "TRAVEL",         label: "Travel",         icon: "✈️" },
  { value: "EMERGENCY_FUND", label: "Emergency Fund", icon: "🛡️" },
  { value: "BUSINESS",       label: "Business",       icon: "💼" },
  { value: "CUSTOM",         label: "Custom",         icon: "🎯" },
];

/** Quick lookup: category value → icon */
export const CATEGORY_ICON = Object.fromEntries(
  GOAL_CATEGORIES.map((c) => [c.value, c.icon])
);

export const GOAL_PRIORITIES = [
  { value: "HIGH",   label: "High",   color: "text-red-600 bg-red-50 border-red-200" },
  { value: "MEDIUM", label: "Medium", color: "text-orange-600 bg-orange-50 border-orange-200" },
  { value: "LOW",    label: "Low",    color: "text-gray-600 bg-gray-50 border-gray-200" },
];

export const PRIORITY_BADGE = {
  HIGH:   { label: "High",   bg: "bg-red-50",    text: "text-red-600" },
  MEDIUM: { label: "Medium", bg: "bg-orange-50", text: "text-orange-600" },
  LOW:    { label: "Low",    bg: "bg-gray-100",  text: "text-gray-500" },
};

export const STATUS_CONFIG = {
  ON_TRACK: {
    label: "On Track",
    bg:  "bg-emerald-50",
    text: "text-emerald-700",
    dot:  "bg-emerald-500",
    bar:  "bg-emerald-500",
  },
  AT_RISK: {
    label: "At Risk",
    bg:  "bg-amber-50",
    text: "text-amber-700",
    dot:  "bg-amber-500",
    bar:  "bg-amber-500",
  },
  COMPLETED: {
    label: "Completed",
    bg:  "bg-blue-50",
    text: "text-blue-700",
    dot:  "bg-blue-500",
    bar:  "bg-[#6b7c3f]",
  },
};

/** Expense category display metadata — used by SimulationModal */
export const EXPENSE_CATEGORY_META = {
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

/** Wizard step names — used by AICoachWidget */
export const WIZARD_STEPS = {
  IDLE:     "IDLE",
  NAME:     "NAME",
  CATEGORY: "CATEGORY",
  TARGET:   "TARGET",
  SAVED:    "SAVED",
  DEADLINE: "DEADLINE",
  MONTHLY:  "MONTHLY",
  PRIORITY: "PRIORITY",
  CONFIRM:  "CONFIRM",
};

/** Word lists for the AI coach wizard */
export const MONTHLY_AFFIRMATIVES = [
  "yes", "y", "ok", "okay", "sure", "yep", "yup",
  "sounds good", "go ahead", "use it", "use that",
  "that works", "perfect", "great", "correct",
];
export const MONTHLY_NEGATIVES = ["skip", "no", "nope", "don't", "dont", "pass"];
export const CONFIRM_WORDS = [
  "confirm", "yes", "create", "ok", "okay", "looks good", "correct",
  "perfect", "done", "yep", "yup", "sure", "go", "go ahead",
  "do it", "submit", "save",
];

export const WIZARD_QUICK_PROMPTS = [
  "📊 How am I doing?",
  "🎯 Create a new goal",
  "💡 How can I save faster?",
  "📅 Weekly check-in",
];

export const GOAL_FILTER_OPTIONS = [
  { key: "ALL",           label: "All goals" },
  { key: "ON_TRACK",      label: "On Track" },
  { key: "AT_RISK",       label: "At Risk" },
  { key: "COMPLETED",     label: "Completed" },
  { key: "BY_DEADLINE",   label: "By Deadline" },
  { key: "HIGH_PRIORITY", label: "High Priority" },
];

export const ITEMS_PER_PAGE = 9;