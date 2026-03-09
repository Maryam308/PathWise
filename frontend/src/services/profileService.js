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

export const profileService = {

  getProfile: async (token) => {
    const res = await apiFetch("/api/profile", { headers: authHeaders(token) });
    return handleResponse(res);
  },

  updateName: async (token, fullName) => {
    const res = await apiFetch("/api/profile", {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify({ fullName }),
    });
    return handleResponse(res);
  },

  getExpenses: async (token) => {
    const res = await apiFetch("/api/expenses", { headers: authHeaders(token) });
    const data = await handleResponse(res);
    return Array.isArray(data) ? data : [];
  },

  updateExpenses: async (token, expenses) => {
    const res = await apiFetch("/api/expenses", {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify(expenses),
    });
    if (!res) return;
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Failed to update expenses");
    }
  },

  updateProfile: async (token, profileData) => {
    const res = await apiFetch("/api/profile", {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify(profileData),
    });
    return handleResponse(res);
  },
};