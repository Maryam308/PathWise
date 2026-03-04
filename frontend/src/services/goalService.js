const API_BASE = import.meta.env.VITE_BACKEND_URL;

/**
 * Helper function to format deadline to YYYY-MM
 */
const formatDeadline = (deadline) => {
  if (!deadline) return deadline;

  // If it's already a string
  if (typeof deadline === 'string') {
    // Handle ISO strings like "2034-12-31T00:00:00.000Z"
    if (deadline.includes('T')) {
      return deadline.split('T')[0].substring(0, 7);
    }
    // Handle YYYY-MM-DD format
    if (deadline.includes('-') && deadline.length >= 10) {
      return deadline.substring(0, 7);
    }
    // Handle YYYY-MM format (already correct)
    if (deadline.match(/^\d{4}-\d{2}$/)) {
      return deadline;
    }
  }

  // If it's a Date object
  if (deadline instanceof Date) {
    const year = deadline.getFullYear();
    const month = String(deadline.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  return deadline;
};

/**
 * All goal-related API calls.
 * Import this wherever you need goal operations:
 *   import { goalService } from "../services/goalService.js";
 */
export const goalService = {
  /**
   * Fetch the user's financial snapshot (disposable income, etc.)
   * This is needed when there are no goals to get the financial data.
   */
  getFinancialSnapshot: async (token) => {
    const res = await fetch(`${API_BASE}/api/goals/snapshot`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Failed to fetch financial snapshot");

    return {
      disposableIncome: parseFloat(data.disposableIncome || 0),
      totalMonthlyCommitment: parseFloat(data.totalMonthlySavings || 0),
      monthlySalary: parseFloat(data.salary || 0),
      totalMonthlyExpenses: parseFloat(data.totalExpenses || 0),
      savingsRatePercent: data.savingsRatePercent,
      warningLevel: data.warningLevel || "NONE",
      warningMessage: data.warningMessage || ""
    };
  },

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
    // Format the deadline before sending
    const formattedData = {
      ...data,
      deadline: formatDeadline(data.deadline)
    };

    const res = await fetch(`${API_BASE}/api/goals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(formattedData),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || "Failed to create goal");
    return body;
  },

  /**
   * Update an existing goal.
   */
  update: async (token, id, data) => {
    // Format the deadline before sending
    const formattedData = {
      ...data,
      deadline: formatDeadline(data.deadline)
    };

    const res = await fetch(`${API_BASE}/api/goals/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(formattedData),
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
    const res = await fetch(`${API_BASE}/api/simulations`, {
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

  /**
   * Fetch the authenticated user's monthly expense categories.
   * Used by SimulationModal to populate the spending-cut sliders.
   * Returns [{ category, amount, label }]
   */
  getExpenses: async (token) => {
    const res = await fetch(`${API_BASE}/api/expenses`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Failed to fetch expenses");
    }
    const data = await res.json().catch(() => []);
    return Array.isArray(data) ? data : [];
  },
};