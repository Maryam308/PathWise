import { apiFetch } from "./apiClient.js";

const authHeaders = (token) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

const handleResponse = async (res) => {
  if (!res) return;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
};

export const insightsService = {

  getAnalytics: (token, months = 3) =>
    apiFetch(`/api/analytics?months=${months}`, {
      headers: authHeaders(token),
    }).then(handleResponse),

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
    return apiFetch(`/api/plaid/transactions?${q}`, {
      headers: authHeaders(token),
    }).then(handleResponse);
  },

  getReports: async (token) => {
    const data = await apiFetch("/api/reports", {
      headers: authHeaders(token),
    }).then(handleResponse);
    return Array.isArray(data) ? data : [];
  },

  getReport: (token, id) =>
    apiFetch(`/api/reports/${id}`, {
      headers: authHeaders(token),
    }).then(handleResponse),

  generateReport: (token) =>
    apiFetch("/api/reports/generate", {
      method: "POST",
      headers: authHeaders(token),
    }).then(handleResponse),

  getAnomalies: async (token) => {
    const data = await apiFetch("/api/anomalies", {
      headers: authHeaders(token),
    }).then(handleResponse);
    return Array.isArray(data) ? data : [];
  },

  dismissAnomaly: (token, id) =>
    apiFetch(`/api/anomalies/${id}/dismiss`, {
      method: "PATCH",
      headers: authHeaders(token),
    }).then((res) => { if (res && !res.ok) throw new Error(`HTTP ${res.status}`); }),

  linkCard: (token, cardData) =>
    apiFetch("/api/plaid/link-card", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(cardData),
    }).then(handleResponse),

  syncTransactions: (token) =>
    apiFetch("/api/plaid/sync", {
      method: "POST",
      headers: authHeaders(token),
    }).then(handleResponse),

  getAccounts: async (token) => {
    const data = await apiFetch("/api/plaid/accounts", {
      headers: authHeaders(token),
    }).then(handleResponse);
    return Array.isArray(data) ? data : [];
  },
};