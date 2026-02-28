const API_BASE = import.meta.env.VITE_BACKEND_URL;

/**
 * All goal-related API calls.
 * Import this wherever you need goal operations:
 *   import { goalService } from "../services/goalService.js";
 */
export const goalService = {
  /**
   * Fetch all goals for the authenticated user.
   */
  getAll: async (token) => {
    const res = await fetch(`${API_BASE}/api/goals`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Failed to fetch goals");
    }
    return res.json();
  },

  /**
   * Fetch a single goal by ID.
   */
  getById: async (token, id) => {
    const res = await fetch(`${API_BASE}/api/goals/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Failed to fetch goal");
    }
    return res.json();
  },

  /**
   * Create a new goal.
   * @param {string} token
   * @param {{ name, category, targetAmount, savedAmount, monthlySavingsTarget, currency, deadline, priority }} data
   */
  create: async (token, data) => {
    const res = await fetch(`${API_BASE}/api/goals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || "Failed to create goal");
    return body;
  },

  /**
   * Update an existing goal.
   */
  update: async (token, id, data) => {
    const res = await fetch(`${API_BASE}/api/goals/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || "Failed to update goal");
    return body;
  },

  /**
   * Delete a goal by ID.
   */
  remove: async (token, id) => {
    const res = await fetch(`${API_BASE}/api/goals/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Failed to delete goal");
    }
  },

  /**
   * Get a savings projection for a goal at a given monthly rate.
   * @param {string} token
   * @param {string} goalId
   * @param {number} monthlySavingsRate  — BD amount per month
   */
  getProjection: async (token, goalId, monthlySavingsRate) => {
    const res = await fetch(`${API_BASE}/api/goals/${goalId}/projection`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ monthlySavingsRate }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || "Failed to fetch projection");
    return body;
  },

  /**
   * Run a spending simulation for a goal.
   * @param {string} token
   * @param {{ goalId, currentMonthlySavingsTarget, spendingAdjustments }} data
   */
  simulate: async (token, data) => {
    const res = await fetch(`${API_BASE}/api/goals/simulate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || "Failed to run simulation");
    return body;
  },
};