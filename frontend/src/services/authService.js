const API_BASE = import.meta.env.VITE_BACKEND_URL;

/* ================= AUTH ================= */

export const authService = {
  async register({ fullName, email, password, monthlySalary, phone, monthlyExpenses }) {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        email,
        password,
        monthlySalary: monthlySalary || 0,
        phone: phone || "",
        preferredCurrency: "BHD",
        monthlyExpenses: monthlyExpenses || [],
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Registration failed");
    return data;
  },

  async login({ email, password }) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Login failed");
    return data;
  },
};

/* ================= PROFILE ================= */

export const profileService = {
  getProfile: async (token) => {
    const res = await fetch(`${API_BASE}/api/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to fetch profile");
    return res.json();
  },

  updateProfile: async (token, data) => {
    const res = await fetch(`${API_BASE}/api/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || "Failed to update profile");
    return body;
  },
};

/* ================= EXPENSES ================= */

export const expenseService = {
  /**
   * Fetch the authenticated user's monthly expenses.
   * Returns: [{ id, category, label, amount }]
   * Primary:  GET /api/expenses
   * Fallback: GET /api/profile → profile.monthlyExpenses (if endpoint doesn't exist yet)
   */
  getAll: async (token) => {
    // Primary endpoint
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/expenses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) return res.json();
      // If 404 (endpoint not deployed yet), fall through to profile fallback
      if (res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Failed to fetch expenses (${res.status})`);
      }
    } catch (err) {
      if (!err.message?.includes("404") && !err.message?.includes("fetch")) throw err;
      // Network error or 404 → try profile fallback
    }

    // Fallback: extract expenses from profile response
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const profile = await res.json();
      // Profile may embed expenses as monthlyExpenses or expenses array
      return profile.monthlyExpenses || profile.expenses || [];
    } catch {
      return []; // non-fatal — SimulationModal handles empty array gracefully
    }
  },
};