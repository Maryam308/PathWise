const authHeaders = (token) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

const handleResponse = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
};

export const profileService = {
  /**
   * Get the authenticated user's profile with linked card and financial snapshot
   */
  getProfile: async (token) => {
    const res = await fetch("/api/profile", {
      headers: authHeaders(token),
    });
    return handleResponse(res);
  },

  /**
   * Update the authenticated user's full name.
   * Returns the updated user object from the backend.
   */
    updateName: async (token, fullName) => {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({ fullName }),
      });
      return handleResponse(res);
    },

  /**
   * Fetch the authenticated user's monthly expense categories.
   * Returns [{ id, category, label, amount }]
   */
  getExpenses: async (token) => {
    const res = await fetch("/api/expenses", {
      headers: authHeaders(token),
    });
    const data = await handleResponse(res);
    return Array.isArray(data) ? data : [];
  },

  /**
   * Replace all monthly expenses for the authenticated user.
   * @param {Array<{ category: string, label: string|null, amount: number }>} expenses
   */
  updateExpenses: async (token, expenses) => {
    const res = await fetch("/api/expenses", {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify(expenses),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Failed to update expenses");
    }
  },

  /**
   * Update the authenticated user's profile fields
   */
  updateProfile: async (token, profileData) => {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify(profileData),
    });
    return handleResponse(res);
  },
};