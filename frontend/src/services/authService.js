const BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api/auth`;

export const authService = {
  async register({ fullName, email, password, monthlySalary }) {
    const res = await fetch(`${BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        email,
        password,
        monthlySalary: monthlySalary || 0,
        preferredCurrency: "BHD"
      }),
    });

    let data;
    const contentType = res.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      console.error('Non-JSON response:', text);
      throw new Error(`Server error: ${res.status}`);
    }

    if (!res.ok) {
      throw new Error(data.message || data.error || "Registration failed");
    }

    return data;
  },

  async login({ email, password }) {
    const res = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    let data;
    const contentType = res.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      console.error('Non-JSON response:', text);
      throw new Error(`Server error: ${res.status}`);
    }

    if (!res.ok) {
      throw new Error(data.message || data.error || "Login failed");
    }

    return data;
  },
};