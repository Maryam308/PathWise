// ─────────────────────────────────────────────────────────────────────────────
// utils/insightsUtils.js
// Feature-specific formatting helpers. Generic helpers stay in formatters.js.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a transaction date — handles ISO strings and Jackson arrays [y,m,d].
 * Returns "16 Sep 2025"
 */
export const formatTxnDate = (val) => {
  if (!val) return "—";
  if (Array.isArray(val)) {
    const [y, m, d] = val;
    return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }
  const datePart = String(val).split("T")[0];
  const [y, m, d] = datePart.split("-").map(Number);
  if (y && m && d) return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return datePart;
};

/** Same as formatTxnDate — used for report dates */
export const formatReportDate = formatTxnDate;

/**
 * Format card number into groups of 4: "1234567890123456" → "1234 5678 9012 3456"
 */
export const formatCardNumber = (raw = "") =>
  raw.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim();

/**
 * Mask card number for display — show only last 4 digits:
 * "1234567890123456" → "•••• •••• •••• 3456"
 */
export const maskCardNumber = (raw = "") => {
  const digits = String(raw).replace(/\D/g, "");
  const last4  = digits.slice(-4).padStart(4, "•");
  return `•••• •••• •••• ${last4}`;
};

/** Safe numeric coercion — returns fallback (0) if NaN */
export const safeNum = (v, fallback = 0) => {
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
};

/**
 * Client-side sort for transaction arrays.
 * sortKey: "date_desc" | "date_asc" | "amount_asc" | "amount_desc"
 */
export const sortTransactions = (txns, sortKey) => {
  if (!txns?.length) return txns;
  const arr = [...txns];
  switch (sortKey) {
    case "amount_asc":
      return arr.sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount));
    case "amount_desc":
      return arr.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
    case "date_asc":
      return arr.sort((a, b) => {
        const da = a.transactionDate; const db = b.transactionDate;
        if (Array.isArray(da) && Array.isArray(db)) {
          return new Date(...da.map((v,i) => i===1?v-1:v)) - new Date(...db.map((v,i) => i===1?v-1:v));
        }
        return String(da).localeCompare(String(db));
      });
    case "date_desc":
    default:
      return arr.sort((a, b) => {
        const da = a.transactionDate; const db = b.transactionDate;
        if (Array.isArray(da) && Array.isArray(db)) {
          return new Date(...db.map((v,i) => i===1?v-1:v)) - new Date(...da.map((v,i) => i===1?v-1:v));
        }
        return String(db).localeCompare(String(da));
      });
  }
};