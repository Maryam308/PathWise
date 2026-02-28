const API_BASE = import.meta.env.VITE_BACKEND_URL;

/* ================= AUTH ================= */

export const authService = {
  async register({ fullName, email, password, monthlySalary, phone }) {
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
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || data.error || "Registration failed");
    }

    return data;
  },

  async login({ email, password }) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || data.error || "Login failed");
    }

    return data;
  },
};

/* ================= GOALS ================= */

export const goalService = {
  getAll: async (token) => {
    const res = await fetch(`${API_BASE}/api/goals`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to fetch goals");
    return res.json();
  },

  create: async (token, data) => {
    const res = await fetch(`${API_BASE}/api/goals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create goal");
    return res.json();
  },

  update: async (token, id, data) => {
    const res = await fetch(`${API_BASE}/api/goals/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update goal");
    return res.json();
  },

  remove: async (token, id) => {
    const res = await fetch(`${API_BASE}/api/goals/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to delete goal");
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
};