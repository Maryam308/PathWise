import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authService } from "../services/authService.js";

/* ── OTP input (reusable 6-box) ─────────────────────────────────────────── */
const OtpInput = ({ value, onChange, disabled }) => {
  const inputRefs = useRef([]);
  const digits = value.split("").concat(Array(6).fill("")).slice(0, 6);

  const handleKeyDown = (e, i) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...digits];
      if (next[i]) { next[i] = ""; onChange(next.join("")); }
      else if (i > 0) { next[i - 1] = ""; onChange(next.join("")); inputRefs.current[i - 1]?.focus(); }
    } else if (e.key === "ArrowLeft" && i > 0) inputRefs.current[i - 1]?.focus();
    else if (e.key === "ArrowRight" && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handleInput = (e, i) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) return;
    if (raw.length > 1) {
      const pasted = raw.slice(0, 6).split("");
      const next = [...digits];
      pasted.forEach((ch, idx) => { if (idx < 6) next[idx] = ch; });
      onChange(next.join(""));
      inputRefs.current[Math.min(pasted.length, 5)]?.focus();
      return;
    }
    const next = [...digits];
    next[i] = raw;
    onChange(next.join(""));
    if (i < 5) inputRefs.current[i + 1]?.focus();
  };

  return (
    <div className="flex gap-3 justify-center my-2">
      {digits.map((d, i) => (
        <input key={i} ref={(el) => (inputRefs.current[i] = el)}
          type="text" inputMode="numeric" maxLength={1} value={d} disabled={disabled}
          onChange={(e) => handleInput(e, i)} onKeyDown={(e) => handleKeyDown(e, i)}
          onFocus={(e) => e.target.select()}
          className={`w-12 h-14 text-center text-2xl font-bold border-2 rounded-xl transition-all duration-200 outline-none
            ${disabled ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
              : d ? "border-[#6b7c3f] bg-[#6b7c3f]/5 text-gray-900"
              : "border-gray-200 bg-white text-gray-900 focus:border-[#6b7c3f] focus:bg-[#6b7c3f]/5"}`} />
      ))}
    </div>
  );
};

/* ── Password strength indicator ────────────────────────────────────────── */
const PasswordStrength = ({ password }) => {
  if (!password) return null;
  const checks = [
    { label: "8+ characters", pass: password.length >= 8 },
    { label: "Uppercase letter", pass: /[A-Z]/.test(password) },
    { label: "Number", pass: /[0-9]/.test(password) },
    { label: "Special character", pass: /[^a-zA-Z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.pass).length;
  const levels = ["", "Weak", "Fair", "Good", "Strong"];
  const colors = ["", "bg-red-400", "bg-amber-400", "bg-yellow-400", "bg-[#6b7c3f]"];
  const textColors = ["", "text-red-500", "text-amber-500", "text-yellow-600", "text-[#6b7c3f]"];

  return (
    <div className="flex flex-col gap-2 mt-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? colors[score] : "bg-gray-200"}`} />
        ))}
      </div>
      {score > 0 && <p className={`text-xs font-medium ${textColors[score]}`}>{levels[score]}</p>}
    </div>
  );
};

/* ── Shared helpers ─────────────────────────────────────────────────────── */
const ErrorBanner = ({ message }) => (
  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center shrink-0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    </div>
    <p className="text-red-600 text-sm font-medium">{message}</p>
  </div>
);

const PasswordInput = ({ label, name, value, onChange, placeholder, autoComplete }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full px-4 py-3 pr-11 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#6b7c3f] focus:ring-2 focus:ring-[#6b7c3f]/10 transition-all"
        />
        <button type="button" onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
          {show ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════════
   FORGOT PASSWORD PAGE
   3 stages: email → verify code → new password → success
   ════════════════════════════════════════════════════════════════════════════ */
const ForgotPassword = () => {
  const navigate = useNavigate();

  // stage: "email" | "code" | "password" | "success"
  const [stage, setStage] = useState("email");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [otpError, setOtpError] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [countdown, setCountdown] = useState(900);

  // Countdown tick
  useState(() => {
    if (stage !== "code") return;
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  });

  const mm = String(Math.floor(countdown / 60)).padStart(2, "0");
  const ss = String(countdown % 60).padStart(2, "0");

  /* ── Stage 1: send reset email ── */
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) { setEmailError("Email address is required"); return; }
    if (!emailRegex.test(email)) { setEmailError("Invalid email format"); return; }
    setEmailError("");
    setLoading(true);
    try {
      await authService.forgotPassword({ email });
      // Always advance to code stage — never confirm/deny email existence
      setCountdown(900);
      setStage("code");
    } catch (err) {
      // Only show error for genuine server failures, not 404 (email not found)
      setEmailError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Stage 2: verify code ── */
  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    if (otpValue.length !== 6) { setOtpError("Please enter all 6 digits"); return; }
    setOtpError("");
    setLoading(true);
    try {
      const data = await authService.verifyResetCode({ email, code: otpValue });
      setResetToken(data.resetToken);
      setStage("password");
    } catch (err) {
      setOtpError(err.message || "Invalid or expired code. Please try again.");
      setOtpValue("");
    } finally {
      setLoading(false);
    }
  };

  /* ── Resend code ── */
  const handleResend = async () => {
    setResendLoading(true);
    setResendSuccess(false);
    try {
      await authService.forgotPassword({ email });
      setOtpValue(""); setOtpError(""); setCountdown(900); setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 4000);
    } catch {
      setOtpError("Failed to resend. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  /* ── Stage 3: set new password ── */
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword) { setPasswordError("Password is required"); return; }
    if (newPassword.length < 6) { setPasswordError("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { setPasswordError("Passwords do not match"); return; }
    setPasswordError("");
    setLoading(true);
    try {
      await authService.resetPassword({ resetToken, newPassword });
      setStage("success");
    } catch (err) {
      setPasswordError(err.message || "Failed to reset password. Please start over.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#2c2c2c] relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full opacity-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="absolute border border-white rounded-full"
                style={{ width: `${(i+1)*140}px`, height: `${(i+1)*140}px`, top: "40%", left: "40%", transform: "translate(-50%, -50%)" }} />
            ))}
          </div>
          <div className="absolute bottom-20 left-0 w-72 h-72 bg-[#6b7c3f] opacity-15 rounded-full blur-3xl" />
          <div className="absolute top-10 right-10 w-40 h-40 bg-[#6b7c3f] opacity-10 rounded-full blur-2xl" />
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <div className="w-9 h-9 bg-[#6b7c3f] rounded-lg flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3 17L9 11L13 15L21 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M17 7H21V11" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-white font-bold text-xl tracking-tight">PathWise</span>
        </div>

        <div className="relative z-10 flex flex-col gap-6">
          <h2 className="text-4xl font-black text-white leading-tight">
            {stage === "success" ? "You're all set!" : "Secure account recovery"}
          </h2>
          <p className="text-gray-400 leading-relaxed">
            {stage === "success"
              ? "Your password has been reset. Log in with your new password to continue your financial journey."
              : "We use a secure verification code sent to your email to confirm your identity before allowing a password change."}
          </p>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mt-2">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-4 font-medium">How it works</p>
            {[
              { num: "1", text: "Enter your registered email address" },
              { num: "2", text: "Check your inbox for a 6-digit code" },
              { num: "3", text: "Enter the code to verify it's really you" },
              { num: "4", text: "Set your new password" },
            ].map(({ num, text }) => (
              <div key={num} className={`flex items-center gap-3 mb-3 last:mb-0 transition-all duration-300 ${
                (stage === "email" && num === "1") || (stage === "code" && num === "2") ||
                (stage === "code" && num === "3") || (stage === "password" && num === "4") ||
                stage === "success" ? "opacity-100" : "opacity-40"}`}>
                <div className="w-6 h-6 rounded-full bg-[#6b7c3f]/30 border border-[#6b7c3f]/50 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-[#a3b46a]">{num}</span>
                </div>
                <p className="text-gray-300 text-sm">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-gray-500 text-sm italic">"Security is not a product, but a process."</p>
          <p className="text-gray-600 text-xs mt-1">— Bruce Schneier</p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-[#6b7c3f] rounded-lg flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M3 17L9 11L13 15L21 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-lg">PathWise</span>
          </div>

          {/* Back to login link */}
          {stage !== "success" && (
            <Link to="/login" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-8 transition-colors group">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:-translate-x-0.5 transition-transform">
                <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back to login
            </Link>
          )}

          {/* ── STAGE: email ── */}
          {stage === "email" && (
            <>
              <div className="mb-8">
                <div className="w-12 h-12 bg-[#6b7c3f]/10 rounded-2xl flex items-center justify-center mb-4">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b7c3f" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                </div>
                <h1 className="text-3xl font-black text-gray-900 mb-2">Forgot password?</h1>
                <p className="text-gray-500 text-sm">Enter the email address linked to your account and we'll send you a verification code.</p>
              </div>
              {emailError && <ErrorBanner message={emailError} />}
              <form onSubmit={handleEmailSubmit} className="flex flex-col gap-5" noValidate>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-gray-700">Email address</label>
                  <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                    placeholder="you@example.com" autoComplete="email"
                    className={`w-full px-4 py-3 border rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition-all
                      ${emailError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-gray-200 focus:border-[#6b7c3f] focus:ring-[#6b7c3f]/10"}`} />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3.5 bg-[#6b7c3f] hover:bg-[#5a6a33] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2">
                  {loading ? (
                    <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/><path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/></svg>Sending code...</>
                  ) : "Send verification code"}
                </button>
              </form>
            </>
          )}

          {/* ── STAGE: code ── */}
          {stage === "code" && (
            <>
              <div className="mb-8">
                <div className="w-12 h-12 bg-[#6b7c3f]/10 rounded-2xl flex items-center justify-center mb-4">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b7c3f" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <h1 className="text-3xl font-black text-gray-900 mb-2">Check your email</h1>
                <p className="text-gray-500 text-sm">
                  We sent a 6-digit code to{" "}
                  <span className="font-semibold text-gray-700">{email}</span>
                </p>
              </div>

              {otpError && <ErrorBanner message={otpError} />}
              {resendSuccess && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <p className="text-green-700 text-sm font-medium">New code sent! Check your inbox.</p>
                </div>
              )}

              <form onSubmit={handleCodeSubmit} className="flex flex-col gap-6" noValidate>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-gray-700 text-center">Verification code</label>
                  <OtpInput value={otpValue} onChange={setOtpValue} disabled={loading} />
                </div>
                <div className="flex items-center justify-center gap-2 text-sm">
                  {countdown <= 0 ? (
                    <p className="text-red-500 font-medium">Code expired — request a new one below</p>
                  ) : (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" strokeLinecap="round"/></svg><span className="text-gray-500">Expires in </span><span className="font-mono font-semibold text-gray-700">{mm}:{ss}</span></>
                  )}
                </div>
                <button type="submit" disabled={loading || otpValue.length !== 6}
                  className="w-full py-3.5 bg-[#6b7c3f] hover:bg-[#5a6a33] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2">
                  {loading ? (<><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/><path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/></svg>Verifying...</>) : "Verify code"}
                </button>
                <div className="text-center text-sm text-gray-500">
                  Didn't receive it?{" "}
                  <button type="button" onClick={handleResend} disabled={resendLoading}
                    className="text-[#6b7c3f] font-semibold hover:underline disabled:text-gray-400 disabled:cursor-not-allowed">
                    {resendLoading ? "Sending..." : "Resend code"}
                  </button>
                </div>
                <p className="text-center text-xs text-gray-400">
                  Wrong email?{" "}
                  <button type="button" onClick={() => { setStage("email"); setOtpValue(""); setOtpError(""); }}
                    className="text-[#6b7c3f] font-semibold hover:underline">Change email</button>
                </p>
              </form>
            </>
          )}

          {/* ── STAGE: password ── */}
          {stage === "password" && (
            <>
              <div className="mb-8">
                <div className="w-12 h-12 bg-[#6b7c3f]/10 rounded-2xl flex items-center justify-center mb-4">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b7c3f" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <h1 className="text-3xl font-black text-gray-900 mb-2">Set new password</h1>
                <p className="text-gray-500 text-sm">Choose a strong password for your account. You'll use it to log in going forward.</p>
              </div>

              {passwordError && <ErrorBanner message={passwordError} />}

              <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-5" noValidate>
                <div className="flex flex-col gap-1.5">
                  <PasswordInput label="New password" name="newPassword" value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setPasswordError(""); }}
                    placeholder="Min. 6 characters" autoComplete="new-password" />
                  <PasswordStrength password={newPassword} />
                </div>
                <PasswordInput label="Confirm new password" name="confirmPassword" value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(""); }}
                  placeholder="Repeat your new password" autoComplete="new-password" />

                <button type="submit" disabled={loading}
                  className="w-full py-3.5 bg-[#6b7c3f] hover:bg-[#5a6a33] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 mt-1">
                  {loading ? (<><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/><path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/></svg>Saving...</>) : "Reset password"}
                </button>
              </form>
            </>
          )}

          {/* ── STAGE: success ── */}
          {stage === "success" && (
            <div className="flex flex-col items-center text-center gap-6">
              <div className="w-20 h-20 bg-[#6b7c3f]/10 rounded-full flex items-center justify-center">
                <div className="w-14 h-14 bg-[#6b7c3f] rounded-full flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-black text-gray-900 mb-2">Password reset!</h1>
                <p className="text-gray-500 text-sm leading-relaxed">Your password has been successfully reset. You can now log in with your new password.</p>
              </div>
              <button onClick={() => navigate("/login")}
                className="w-full py-3.5 bg-[#6b7c3f] hover:bg-[#5a6a33] text-white font-bold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2">
                Continue to login
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;