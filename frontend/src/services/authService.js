/* ═══════════════════════════════════════════════════════════════════════════
   AUTH SERVICE — API CONTRACT REFERENCE
   ═══════════════════════════════════════════════════════════════════════════

   POST /api/auth/register
     Body:    { fullName, email, password, monthlySalary, phone, monthlyExpenses, preferredCurrency }
     Returns: { message: "Verification email sent" }   ← NO token yet
     Action:  Creates user with emailVerified=false, sends 6-digit OTP, 15-min expiry

   POST /api/auth/verify-email
     Body:    { email, code }
     Returns: { token, user: { id, fullName, email } }
     Action:  Validates OTP, sets emailVerified=true, returns JWT

   POST /api/auth/resend-verification
     Body:    { email }
     Returns: { message: "Verification email sent" }

   POST /api/auth/login
     Body:    { email, password }
     Returns: { token, user }
     Error:   emailVerified=false → 403 { error: "EMAIL_NOT_VERIFIED" }

   POST /api/auth/forgot-password
     Body:    { email }
     Returns: { message: "Reset email sent" }  ← Always 200, never leak existence

   POST /api/auth/verify-reset-code
     Body:    { email, code }
     Returns: { resetToken }  ← UUID, 10-min TTL, single-use

   POST /api/auth/reset-password
     Body:    { resetToken, newPassword }
     Returns: { message: "Password updated" }
   ═══════════════════════════════════════════════════════════════════════════ */

export const authService = {

  async register({ fullName, email, password, monthlySalary, phone, monthlyExpenses }) {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password, monthlySalary: monthlySalary || 0, phone: phone || "", preferredCurrency: "BHD", monthlyExpenses: monthlyExpenses || [] }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Registration failed");
    return data;
  },

  async verifyEmail({ email, code }) {
    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Verification failed");
    return data;
  },

  async resendVerification({ email }) {
    const res = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Failed to resend code");
    return data;
  },

  async login({ email, password }) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 403 && data.error === "EMAIL_NOT_VERIFIED") {
        const err = new Error(data.message || "Email not verified");
        err.code = "EMAIL_NOT_VERIFIED";
        throw err;
      }
      throw new Error(data.message || data.error || "Login failed");
    }
    return data;
  },

  async forgotPassword({ email }) {
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok && res.status !== 404) throw new Error(data.message || data.error || "Request failed");
    return data;
  },

  async verifyResetCode({ email, code }) {
    const res = await fetch("/api/auth/verify-reset-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Invalid or expired code");
    return data;
  },

  async resetPassword({ resetToken, newPassword }) {
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetToken, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Password reset failed");
    return data;
  },
};

export const profileService = {
  getProfile: async (token) => {
    const res = await fetch("/api/profile", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error("Failed to fetch profile");
    return res.json();
  },
  updateProfile: async (token, data) => {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || "Failed to update profile");
    return body;
  },
};

export const expenseService = {
  getAll: async (token) => {
    try {
      const res = await fetch("/api/expenses", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) return res.json();
      if (res.status !== 404) { const d = await res.json().catch(() => ({})); throw new Error(d.message || `Failed to fetch expenses (${res.status})`); }
    } catch (err) { if (!err.message?.includes("404") && !err.message?.includes("fetch")) throw err; }
    try {
      const res = await fetch("/api/profile", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      const profile = await res.json();
      return profile.monthlyExpenses || profile.expenses || [];
    } catch { return []; }
  },
};