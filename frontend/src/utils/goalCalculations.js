/**
 * Pure financial calculation helpers for the goals feature.
 * No React, no side effects — all functions are deterministic.
 */

/** Today's date as YYYY-MM-DD string */
export const todayStr = () => new Date().toISOString().split("T")[0];

/** True if the given YYYY-MM-DD string is in the future */
export const isFutureDate = (d) => d > todayStr();

/**
 * How many whole months from now until the given date string.
 * Returns null if the date is in the past or not provided.
 */
export const monthsUntil = (dateStr) => {
  if (!dateStr) return null;
  const months = Math.round(
    (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24 * 30.44)
  );
  return months > 0 ? months : null;
};

/**
 * Calculate the projected completion date given target, saved, and monthly rate.
 * Returns a "YYYY-MM" string or null.
 */
export const calcDeadline = (targetAmount, savedAmount, monthlyRate) => {
  const rem  = (parseFloat(targetAmount) || 0) - (parseFloat(savedAmount) || 0);
  const rate = parseFloat(monthlyRate) || 0;
  if (rem <= 0 || rate <= 0) return null;
  const months = Math.ceil(rem / rate);
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * Infer the required monthly savings from target, saved amount, and deadline.
 * Returns a string with 3 decimal places, or null.
 */
export const calcMonthlyNeeded = (target, saved, deadline) => {
  const months = monthsUntil(deadline);
  const rem    = parseFloat(target) - parseFloat(saved || 0);
  if (!months || rem <= 0) return null;
  return (rem / months).toFixed(3);
};

/**
 * Convert a YYYY-MM month string to the last day of that month (YYYY-MM-DD).
 * Used when sending form values to the backend.
 */
export const monthToLastDay = (ym) => {
  if (!ym) return "";
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${last}`;
};

/**
 * Convert a YYYY-MM-DD or YYYY-MM date string to YYYY-MM for a month input.
 */
export const dateToMonth = (d) => {
  if (!d) return "";
  return String(d).slice(0, 7);
};

/**
 * The earliest valid month for a deadline input (next month from today).
 */
export const minDeadlineMonth = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * Parse natural-language or standard date strings into a YYYY-MM-DD value
 * (last day of the resolved month). Used by the AI coach wizard.
 * Returns null if the input cannot be parsed.
 */
export const parseDateInput = (raw) => {
  const t  = raw.trim();
  const tl = t.toLowerCase();
  const lastOfMonth = (y, m) =>
    `${y}-${String(m).padStart(2, "0")}-${new Date(y, m, 0).getDate()}`;
  const thisYear   = new Date().getFullYear();
  const monthNames = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

  // YYYY-MM or YYYY-MM-DD
  const iso = t.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (iso) {
    const y = parseInt(iso[1], 10), m = parseInt(iso[2], 10);
    if (m >= 1 && m <= 12) return lastOfMonth(y, m);
  }
  // MM-YYYY or MM/YYYY
  const slashOrDash = t.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (slashOrDash) {
    const m = parseInt(slashOrDash[1], 10), y = parseInt(slashOrDash[2], 10);
    if (m >= 1 && m <= 12) return lastOfMonth(y, m);
  }
  // "Month YYYY"
  const nm = tl.match(/\b([a-z]+)\s+(\d{4})\b/);
  if (nm) {
    const mIdx = monthNames.indexOf(nm[1].slice(0, 3));
    const y    = parseInt(nm[2], 10);
    if (mIdx >= 0) return lastOfMonth(y, mIdx + 1);
  }
  // Year-only — with optional quarter keywords
  const yr = tl.match(/\b(\d{4})\b/);
  if (yr) {
    const y = parseInt(yr[1], 10);
    if (y >= thisYear - 10 && y <= thisYear + 30) {
      let month = 12;
      if (/\b(q1|first quarter|beginning|start|early)\b/.test(tl))  month = 3;
      else if (/\b(q2|second quarter|mid-year|middle)\b/.test(tl))  month = 6;
      else if (/\b(q3|third quarter)\b/.test(tl))                   month = 9;
      return lastOfMonth(y, month);
    }
  }
  return null;
};