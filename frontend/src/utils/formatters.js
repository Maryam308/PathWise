/**
 * Shared formatting utilities used across the goals feature.
 * Centralised here to avoid duplication across GoalCard, GoalsHeader,
 * SimulationModal, ProjectionModal, AICoachWidget, etc.
 */

/**
 * Format a BD amount to Bahraini locale with 3 decimal places.
 * e.g. 1234.5 → "BD 1,234.500"
 */
export const formatBD = (v) =>
  v != null
    ? `BD ${parseFloat(v).toLocaleString("en-BH", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      })}`
    : "—";

/**
 * Format a BD amount without the "BD" prefix — useful inside labels.
 * e.g. 1234.5 → "1,234.500"
 */
export const formatBDAmount = (v) =>
  v != null
    ? parseFloat(v).toLocaleString("en-BH", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      })
    : "—";

/**
 * Short form for large amounts.
 * e.g. 1234 → "BD 1.2K",  500 → "BD 500"
 */
export const formatBDShort = (v) => {
  const n = parseFloat(v) || 0;
  return n >= 1000
    ? `BD ${(n / 1000).toFixed(1)}K`
    : `BD ${n.toLocaleString("en-BH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

/**
 * Parse a date value (string "YYYY-MM-DD", "YYYY-MM", or Jackson array [y,m,d])
 * into a local-time Date object, avoiding UTC timezone shift.
 *
 * Problem: new Date("2027-11-04") is parsed as UTC midnight, then displayed in
 * local time — in UTC+3 (Bahrain) that becomes Nov 3. This helper avoids that.
 */
export const parseLocalDate = (d) => {
  if (!d) return null;
  if (Array.isArray(d)) {
    // Jackson serialises LocalDate as [year, month, day] — month is 1-based
    const [y, m, day] = d;
    return new Date(y, m - 1, day);
  }
  const parts = String(d).split("-").map(Number);
  if (parts.length >= 3) return new Date(parts[0], parts[1] - 1, parts[2]);
  if (parts.length === 2) return new Date(parts[0], parts[1] - 1, 1);
  return null;
};

/**
 * Format a deadline value to "Nov 2027" style.
 * Accepts YYYY-MM-DD strings, YYYY-MM strings, or Jackson [y,m,d] arrays.
 */
export const formatDeadline = (d, options = { month: "short", year: "numeric" }) => {
  const date = parseLocalDate(d);
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", options);
};

/**
 * Convert a deadline value to a sortable millisecond timestamp.
 * Safe to use in Array.sort() comparisons.
 */
export const deadlineMs = (d) => {
  if (!d) return Infinity;
  const date = parseLocalDate(d);
  return date ? date.getTime() : Infinity;
};

/**
 * Format a timestamp string to HH:MM.
 */
export const formatTime = (ts) =>
  ts
    ? new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : "";