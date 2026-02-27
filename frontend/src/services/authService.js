const BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api/auth`;


export const authService = {
  async register({ fullName, email, password }) {
    const res = await fetch(`${BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Registration failed");
    }

    return data; // { token, email, fullName, id }
  },

  async login({ email, password }) {
    const res = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Login failed");
    }

    return data; // { token, email, fullName, id }
  },
};