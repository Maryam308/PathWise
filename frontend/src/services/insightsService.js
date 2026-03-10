// ─────────────────────────────────────────────────────────────────────────────
// services/insightsService.js
// API service for all insights-related operations including:
// - Analytics
// - Transactions
// - Reports
// - Anomalies
// - Plaid card operations
// ─────────────────────────────────────────────────────────────────────────────

const BASE = import.meta.env.VITE_BACKEND_URL;

/**
 * Creates authorization headers with Bearer token.
 * @param {string} token - JWT authentication token
 * @returns {Object} Headers object with Authorization
 */
const authHeaders = (token) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

/**
 * Handles API response, throwing errors for non-OK responses.
 * @param {Response} res - Fetch Response object
 * @returns {Promise<Object>} Parsed JSON response
 */
const handleResponse = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
};

export const insightsService = {

  // ── Analytics ──────────────────────────────────────────────────────────────
  /**
   * Fetches analytics data for the specified number of months.
   * @param {string} token - JWT token
   * @param {number} months - Number of months to analyze
   * @returns {Promise<Object>} Analytics data
   */
  getAnalytics: (token, months = 3) =>
    fetch(`${BASE}/api/analytics?months=${months}`, {
      headers: authHeaders(token),
    }).then(handleResponse),

  // ── Transactions ───────────────────────────────────────────────────────────
  /**
   * Fetches paginated transactions with optional filters.
   * @param {string} token - JWT token
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Paginated transactions
   */
  getTransactions: (token, params = {}) => {
    const q = new URLSearchParams();
    if (params.page     != null) q.set("page",     params.page);
    if (params.size     != null) q.set("size",     params.size);
    if (params.search)           q.set("search",   params.search);
    if (params.category)         q.set("category", params.category);
    if (params.month    != null) q.set("month",    params.month);
    if (params.year     != null) q.set("year",     params.year);
    if (params.sortBy)           q.set("sortBy",   params.sortBy);
    if (params.sortDir)          q.set("sortDir",  params.sortDir);
    return fetch(`${BASE}/api/plaid/transactions?${q}`, {
      headers: authHeaders(token),
    }).then(handleResponse);
  },

  // ── Reports ────────────────────────────────────────────────────────────────
  /**
   * Fetches list of all reports.
   * @param {string} token - JWT token
   * @returns {Promise<Array>} List of reports
   */
  getReports: async (token) => {
    const data = await fetch(`${BASE}/api/reports`, {
      headers: authHeaders(token),
    }).then(handleResponse);
    return Array.isArray(data) ? data : [];
  },

  /**
   * Fetches a single report by ID.
   * @param {string} token - JWT token
   * @param {string} id - Report ID
   * @returns {Promise<Object>} Report data
   */
  getReport: (token, id) =>
    fetch(`${BASE}/api/reports/${id}`, {
      headers: authHeaders(token),
    }).then(handleResponse),

  /**
   * Generates a new financial report.
   * @param {string} token - JWT token
   * @returns {Promise<Object>} Generated report
   */
  generateReport: (token) =>
    fetch(`${BASE}/api/reports/generate`, {
      method: "POST",
      headers: authHeaders(token),
    }).then(handleResponse),

  // ── Anomalies ──────────────────────────────────────────────────────────────
  /**
   * Fetches all anomalies for the current user.
   * @param {string} token - JWT token
   * @returns {Promise<Array>} List of anomalies
   */
  getAnomalies: async (token) => {
    const data = await fetch(`${BASE}/api/anomalies`, {
      headers: authHeaders(token),
    }).then(handleResponse);
    return Array.isArray(data) ? data : [];
  },

  /**
   * Dismisses an anomaly by ID.
   * @param {string} token - JWT token
   * @param {string} id - Anomaly ID
   * @returns {Promise<void>}
   */
  dismissAnomaly: (token, id) =>
    fetch(`${BASE}/api/anomalies/${id}/dismiss`, {
      method: "PATCH",
      headers: authHeaders(token),
    }).then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); }),

  // ── Plaid / Card ──────────────────────────────────────────────────────────
  /**
   * Links a new card for the user.
   * @param {string} token - JWT token
   * @param {Object} cardData - Card details
   * @returns {Promise<Object>} Result of linking
   */
  linkCard: (token, cardData) =>
    fetch(`${BASE}/api/plaid/link-card`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(cardData),
    }).then(handleResponse),

  /**
   * Manually triggers transaction sync.
   * @param {string} token - JWT token
   * @returns {Promise<Object>} Sync result
   */
  syncTransactions: (token) =>
    fetch(`${BASE}/api/plaid/sync`, {
      method: "POST",
      headers: authHeaders(token),
    }).then(handleResponse),

  /**
   * Fetches all linked accounts for the user.
   * @param {string} token - JWT token
   * @returns {Promise<Array>} List of accounts
   */
  getAccounts: async (token) => {
    const data = await fetch(`${BASE}/api/plaid/accounts`, {
      headers: authHeaders(token),
    }).then(handleResponse);
    return Array.isArray(data) ? data : [];
  },
};