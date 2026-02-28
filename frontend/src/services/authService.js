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