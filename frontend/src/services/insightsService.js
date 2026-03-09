const authHeaders = (token) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

const handleResponse = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
};

export const insightsService = {

  // ── Analytics ──────────────────────────────────────────────────────────────
  // GET /api/analytics?months=N
  // Returns: { totalBalance, totalIncome, totalExpenses,
  //            spendingByCategory, monthlyBreakdown, dailySpending }
  getAnalytics: (token, months = 3) =>
    fetch(`/api/analytics?months=${months}`, {
      headers: authHeaders(token),
    }).then(handleResponse),

  // ── Transactions ───────────────────────────────────────────────────────────
  // GET /api/plaid/transactions?page=&size=&search=&category=&month=&year=&sortBy=&sortDir=
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
    return fetch(`/api/plaid/transactions?${q}`, {
      headers: authHeaders(token),
    }).then(handleResponse);
  },

  // ── Reports ────────────────────────────────────────────────────────────────
  getReports: async (token) => {
    const data = await fetch("/api/reports", {
      headers: authHeaders(token),
    }).then(handleResponse);
    return Array.isArray(data) ? data : [];
  },

  getReport: (token, id) =>
    fetch(`/api/reports/${id}`, {
      headers: authHeaders(token),
    }).then(handleResponse),

  generateReport: (token) =>
    fetch("/api/reports/generate", {
      method: "POST",
      headers: authHeaders(token),
    }).then(handleResponse),

  // ── Anomalies ──────────────────────────────────────────────────────────────
  getAnomalies: async (token) => {
    const data = await fetch("/api/anomalies", {
      headers: authHeaders(token),
    }).then(handleResponse);
    return Array.isArray(data) ? data : [];
  },

  dismissAnomaly: (token, id) =>
    fetch(`/api/anomalies/${id}/dismiss`, {
      method: "PATCH",
      headers: authHeaders(token),
    }).then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); }),

  // ── Plaid / Card ──────────────────────────────────────────────────────────
  // POST /api/plaid/link-card
  // Body: { cardHolderName, cardNumber, lastFourDigits, expiryMonth, expiryYear, bank }
  linkCard: (token, cardData) =>
    fetch("/api/plaid/link-card", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(cardData),
    }).then(handleResponse),

  syncTransactions: (token) =>
    fetch("/api/plaid/sync", {
      method: "POST",
      headers: authHeaders(token),
    }).then(handleResponse),

  // GET /api/plaid/accounts
  getAccounts: async (token) => {
    const data = await fetch("/api/plaid/accounts", {
      headers: authHeaders(token),
    }).then(handleResponse);
    return Array.isArray(data) ? data : [];
  },
};