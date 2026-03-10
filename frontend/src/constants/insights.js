export const TX_CATEGORIES = [
  { value: "FOOD & DINING", label: "Food & Dining", icon: "🍽️" },
  { value: "TRANSPORT", label: "Transport", icon: "🚗" },
  { value: "SHOPPING", label: "Shopping", icon: "🛍️" },
  { value: "ENTERTAINMENT", label: "Entertainment", icon: "🎬" },
  { value: "HEALTH", label: "Health", icon: "❤️" },
  { value: "UTILITIES", label: "Utilities", icon: "⚡" },
  { value: "EDUCATION", label: "Education", icon: "📚" },
  { value: "TRAVEL", label: "Travel", icon: "✈️" },
  { value: "SALARY", label: "Salary", icon: "💰" },
  { value: "INCOME", label: "Income", icon: "💵" },
  { value: "INVESTMENT", label: "Investment", icon: "📈" },
  { value: "TRANSFER", label: "Transfer", icon: "↔️" },
  { value: "REFUND", label: "Refund", icon: "↩️" },
  { value: "OTHER", label: "Other", icon: "💳" },
];


// Quick emoji lookup by category string
export const CATEGORY_ICON = Object.fromEntries(
  TX_CATEGORIES.map((c) => [c.value, c.icon])
);

// Tailwind classes for the category icon pill
export const CATEGORY_STYLE = {
  "FOOD & DINING": "bg-amber-100 text-amber-600",
  "TRANSPORT": "bg-blue-100 text-blue-600",
  "SHOPPING": "bg-purple-100 text-purple-600",
  "ENTERTAINMENT": "bg-pink-100 text-pink-600",
  "HEALTH": "bg-emerald-100 text-emerald-600",
  "UTILITIES": "bg-gray-200 text-gray-600",
  "EDUCATION": "bg-indigo-100 text-indigo-600",
  "TRAVEL": "bg-sky-100 text-sky-600",
  "SALARY": "bg-emerald-100 text-emerald-700",
  "INCOME": "bg-emerald-100 text-emerald-700",
  "INVESTMENT": "bg-emerald-100 text-emerald-700",
  "TRANSFER": "bg-blue-100 text-blue-600",
  "REFUND": "bg-teal-100 text-teal-600",
  "OTHER": "bg-gray-100 text-gray-500",
};

// Pie-chart colours — brand palette
export const PIE_COLORS = [
  "#2c3347", "#6b7c3f", "#a3b46a", "#3d4357",
  "#8d9e54", "#c5d48a", "#4a5568", "#68775e",
  "#10B981", "#3B82F6", "#F59E0B", "#EF4444",
];

// Bahrain banks — values must match BahrainBank enum in backend
export const BAHRAIN_BANKS = [
  { value: "NBB", label: "National Bank of Bahrain" },
  { value: "BBK", label: "Bank of Bahrain and Kuwait" },
  { value: "AHLI_UNITED", label: "Ahli United Bank" },
  { value: "ITHMAAR", label: "Ithmaar Bank" },
  { value: "KHALEEJI", label: "Khaleeji Commercial Bank" },
  { value: "AL_SALAM", label: "Al Salam Bank" },
  { value: "GULF_INTERNATIONAL", label: "Gulf International Bank" },
  { value: "CITIBANK", label: "Citibank Bahrain" },
  { value: "HSBC", label: "HSBC Bahrain" },
  { value: "STANDARD_CHARTERED", label: "Standard Chartered Bahrain" },
  { value: "BFC", label: "BFC Bank" },
  { value: "ARAB_BANKING", label: "Arab Banking Corporation" },
  { value: "FIRST_ABU_DHABI", label: "First Abu Dhabi Bank Bahrain" },
  { value: "BANK_ABC", label: "Bank ABC" },
];

// Month filter options
export const MONTH_OPTIONS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

// Sort options for transaction table
export const SORT_OPTIONS = [
  { value: "date_desc", label: "Newest First" },
  { value: "date_asc", label: "Oldest First" },
  { value: "amount_asc", label: "Amount: Low → High" },
  { value: "amount_desc", label: "Amount: High → Low" },
];

// Analytics time-range tabs (current month = 1, last 3 months = 3)
export const ANALYTICS_RANGES = [
  { value: 1, label: "This month" },
  { value: 3, label: "3 months" },
  { value: 6, label: "6 months" },
  { value: 12, label: "12 months" },
];

// Anomaly severity styles
export const ANOMALY_SEVERITY = {
  HIGH: { icon: "🚨", bg: "bg-red-50", border: "border-red-200", text: "text-red-700" },
  MEDIUM: { icon: "⚠️", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" },
  LOW: { icon: "ℹ️", bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
};

// Rows per page in My Card tab
export const TRANSACTIONS_PER_PAGE = 8;

// Rows shown on Dashboard home preview
export const DASHBOARD_RECENT_TX = 4;