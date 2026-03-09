import { apiFetch } from "./apiClient.js";

const formatDeadline = (deadline) => {
  if (!deadline) return deadline;
  if (typeof deadline === 'string') {
    if (deadline.includes('T')) return deadline.split('T')[0].substring(0, 7);
    if (deadline.includes('-') && deadline.length >= 10) return deadline.substring(0, 7);
    if (deadline.match(/^\d{4}-\d{2}$/)) return deadline;
  }
  if (deadline instanceof Date) {
    const year = deadline.getFullYear();
    const month = String(deadline.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
  return deadline;
};

export const goalService = {

  getFinancialSnapshot: async (token) => {
    const res = await apiFetch("/api/goals/snapshot", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res) return;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Failed to fetch financial snapshot");
    return {
      disposableIncome:        parseFloat(data.disposableIncome || 0),
      totalMonthlyCommitment:  parseFloat(data.totalMonthlySavings || 0),
      monthlySalary:           parseFloat(data.salary || 0),
      totalMonthlyExpenses:    parseFloat(data.totalExpenses || 0),
      savingsRatePercent:      data.savingsRatePercent,
      warningLevel:            data.warningLevel || "NONE",
      warningMessage:          data.warningMessage || "",
    };
  },

  getAll: async (token) => {
    const res = await apiFetch("/api/goals", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res) return;
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Failed to fetch goals");
    }
    return res.json();
  },

  getById: async (token, id) => {
    const res = await apiFetch(`/api/goals/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res) return;
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Failed to fetch goal");
    }
    return res.json();
  },

  create: async (token, data) => {
    const res = await apiFetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...data, deadline: formatDeadline(data.deadline) }),
    });
    if (!res) return;
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || "Failed to create goal");
    return body;
  },

  update: async (token, id, data) => {
    const res = await apiFetch(`/api/goals/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...data, deadline: formatDeadline(data.deadline) }),
    });
    if (!res) return;
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || "Failed to update goal");
    return body;
  },

  remove: async (token, id) => {
    const res = await apiFetch(`/api/goals/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res) return;
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Failed to delete goal");
    }
  },

  getProjection: async (token, goalId, monthlySavingsRate) => {
    const res = await apiFetch(`/api/goals/${goalId}/projection`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ monthlySavingsRate }),
    });
    if (!res) return;
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || "Failed to fetch projection");
    return body;
  },

  simulate: async (token, data) => {
    const res = await apiFetch("/api/simulations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    if (!res) return;
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || "Failed to run simulation");
    return body;
  },

  getExpenses: async (token) => {
    const res = await apiFetch("/api/expenses", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res) return [];
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Failed to fetch expenses");
    }
    const data = await res.json().catch(() => []);
    return Array.isArray(data) ? data : [];
  },
};