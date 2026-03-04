const API_BASE = import.meta.env.VITE_BACKEND_URL;

/**
 * All profile-related API calls.
 * Import: import { profileService } from "../services/profileService.js";
 */
export const profileService = {
  /**
   * Update the authenticated user's full name.
   * Returns the updated user object from the backend.
   */
  updateName: async (token, fullName) => {
    const res = await fetch(`${API_BASE}/api/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fullName }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || "Failed to update name");
    return body;
  },

  /**
   * Fetch the authenticated user's monthly expense categories.
   * Returns [{ id, category, label, amount }]
   */
  getExpenses: async (token) => {
    const res = await fetch(`${API_BASE}/api/expenses`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(data.message || "Failed to fetch expenses");
    return Array.isArray(data) ? data : [];
  },

  /**
   * Replace all monthly expenses for the authenticated user.
   * @param {Array<{ category: string, label: string|null, amount: number }>} expenses
   */
  updateExpenses: async (token, expenses) => {
    const res = await fetch(`${API_BASE}/api/expenses`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(expenses),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Failed to update expenses");
    }
  },
};