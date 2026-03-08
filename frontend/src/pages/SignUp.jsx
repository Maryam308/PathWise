import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { authService } from "../services/authService.js";
import { useAuthForm } from "../hooks/useAuthForm.js";
import InputField from "../components/auth/InputField.jsx";

const EXPENSE_CATEGORIES = [
  { value: "HOUSING",       label: "Rent / Mortgage", icon: "🏠" },
  { value: "TRANSPORT",     label: "Transport",        icon: "🚗" },
  { value: "FOOD",          label: "Groceries & Food", icon: "🛒" },
  { value: "UTILITIES",     label: "Utilities",        icon: "⚡" },
  { value: "INSURANCE",     label: "Insurance",        icon: "🛡️" },
  { value: "SUBSCRIPTIONS", label: "Subscriptions",    icon: "📱" },
  { value: "EDUCATION",     label: "Education",        icon: "📚" },
  { value: "HEALTHCARE",    label: "Healthcare",       icon: "❤️" },
  { value: "FAMILY",        label: "Family",           icon: "👨‍👩‍👧" },
  { value: "OTHER",         label: "Other",            icon: "📦" },
];

const rules = {
  fullName: [
    (v) => (!v ? "Full name is required" : null),
    (v) => (v.length < 3 || v.length > 50 ? "Full name must be between 3 and 50 characters" : null),
    (v) => (!/^[a-zA-Z]+(?:\s[a-zA-Z]+)+$/.test(v) ? "Must include first and last name (letters only)" : null),
  ],
  email: [
    (v) => (!v ? "Email is required" : null),
    (v) => (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "Invalid email format" : null),
  ],
  phone: [
    (v) => (!v ? "Phone number is required" : null),
    (v) => (!/^[0-9]{8}$/.test(v) ? "Phone number must be exactly 8 digits" : null),
  ],
  monthlySalary: [
    (v) => {
      if (!v && v !== 0) return "Monthly salary is required";
      if (isNaN(v) || v === "") return "Monthly salary must be a number";
      if (v < 0) return "Monthly salary cannot be negative";
      return null;
    },
  ],
  password: [
    (v) => (!v ? "Password is required" : null),
    (v) => (v.length < 6 ? "Password must be at least 6 characters" : null),
  ],
  confirmPassword: [
    (v) => (!v ? "Please confirm your password" : null),
    (v, all) => (v !== all.password ? "Passwords do not match" : null),
  ],
};

const StepIndicator = ({ currentStep, steps }) => (
  <div className="flex items-center gap-2 mb-8">
    {steps.map((step, i) => (
      <div key={i} className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
          i < currentStep ? "bg-[#6b7c3f] text-white"
          : i === currentStep ? "bg-[#6b7c3f] text-white ring-4 ring-[#6b7c3f]/20"
          : "bg-gray-100 text-gray-400"}`}>
          {i < currentStep ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : i + 1}
        </div>
        <span className={`text-xs font-medium ${i === currentStep ? "text-gray-800" : "text-gray-400"}`}>{step}</span>
        {i < steps.length - 1 && <div className={`w-6 h-px mx-1 ${i < currentStep ? "bg-[#6b7c3f]" : "bg-gray-200"}`} />}
      </div>
    ))}
  </div>
);

const ExpenseRow = ({ expense, index, onUpdate, onRemove }) => (
  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100 group">
    <span className="text-lg">{EXPENSE_CATEGORIES.find((c) => c.value === expense.category)?.icon || "📦"}</span>
    <div className="flex-1 min-w-0">
      <select value={expense.category} onChange={(e) => onUpdate(index, "category", e.target.value)}
        className="w-full text-sm font-medium text-gray-700 bg-transparent border-none outline-none cursor-pointer">
        {EXPENSE_CATEGORIES.map((cat) => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
      </select>
      <input type="text" placeholder="Label (optional)" value={expense.label}
        onChange={(e) => onUpdate(index, "label", e.target.value)}
        className="w-full text-xs text-gray-400 bg-transparent border-none outline-none placeholder-gray-300 mt-0.5" />
    </div>
    <div className="flex items-center gap-1 shrink-0">
      <span className="text-xs text-gray-400 font-medium">BD</span>
      <input type="number" placeholder="0.000" value={expense.amount}
        onChange={(e) => onUpdate(index, "amount", e.target.value)}
        step="0.001" min="0"
        className="w-20 text-sm font-semibold text-gray-700 bg-transparent border-none outline-none text-right" />
    </div>
    <button type="button" onClick={() => onRemove(index)}
      className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400 rounded-full hover:bg-red-50">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
      </svg>
    </button>
  </div>
);

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

const useCountdown = (seconds) => {
  const [timeLeft, setTimeLeft] = useState(seconds);
  const [active, setActive] = useState(true);
  useEffect(() => {
    if (!active || timeLeft <= 0) { setActive(false); return; }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, active]);
  const reset = (s = seconds) => { setTimeLeft(s); setActive(true); };
  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");
  return { timeLeft, expired: timeLeft <= 0, label: `${mm}:${ss}`, reset };
};

const ErrorBanner = ({ message }) => (
  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center shrink-0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    </div>
    <p className="text-red-600 text-sm font-medium">{message}</p>
  </div>
);

const LeftPanel = ({ step, salary, totalExpenses, disposable, registeredEmail }) => {
  const content = {
    0: { heading: "Start your path to financial clarity", sub: "Join thousands of people who use PathWise to track goals, manage spending, and build a better financial future." },
    1: { heading: "Tell us about your finances", sub: "Adding your fixed expenses helps PathWise calculate your real disposable income — so your savings goals are always grounded in reality." },
    2: { heading: "One last step", sub: `We sent a 6-digit verification code to ${registeredEmail}. Enter it to activate your account.` },
  };
  return (
    <div className="hidden lg:flex lg:w-1/2 bg-[#2c2c2c] relative overflow-hidden flex-col justify-between p-12">
      <div className="absolute inset-0">
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#6b7c3f] opacity-20 rounded-full blur-3xl" />
        <div className="absolute top-10 right-10 w-48 h-48 bg-[#6b7c3f] opacity-10 rounded-full blur-2xl" />
        <div className="absolute top-0 left-0 w-full h-full opacity-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="absolute border border-white rounded-full"
              style={{ width: `${(i+1)*140}px`, height: `${(i+1)*140}px`, bottom: "-20%", left: "20%", transform: "translate(-50%, 50%)" }} />
          ))}
        </div>
      </div>
      <div className="relative z-10 flex items-center gap-2">
        <div className="w-9 h-9 bg-[#6b7c3f] rounded-lg flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M3 17L9 11L13 15L21 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M17 7H21V11" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="text-white font-bold text-xl tracking-tight">PathWise</span>
      </div>
      <div className="relative z-10 flex flex-col gap-6">
        <h2 className="text-4xl font-black text-white leading-tight">{content[step].heading}</h2>
        <p className="text-gray-400 leading-relaxed">{content[step].sub}</p>
        {step === 1 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mt-2">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-3 font-medium">Your snapshot</p>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm"><span className="text-gray-400">Monthly salary</span><span className="text-white font-semibold">BD {salary.toFixed(3)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-400">Fixed expenses</span><span className="text-red-400 font-semibold">− BD {totalExpenses.toFixed(3)}</span></div>
              <div className="h-px bg-white/10 my-1" />
              <div className="flex justify-between text-sm"><span className="text-gray-300 font-medium">Disposable income</span><span className={`font-bold ${disposable >= 0 ? "text-[#a3b46a]" : "text-red-400"}`}>BD {disposable.toFixed(3)}</span></div>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mt-2">
            <div className="flex flex-col gap-3">
              {[["✉️","Check your inbox (and spam folder)"],["🔢","Enter the 6-digit code within 15 minutes"],["🔒","Each code can only be used once"]].map(([icon, text]) => (
                <div key={text} className="flex items-center gap-3"><span className="text-lg">{icon}</span><p className="text-gray-300 text-sm">{text}</p></div>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3 mt-2">
          {["Set and track financial goals","Get personalized spending insights","Visualize your financial health","Secure and private — always"].map((feature) => (
            <div key={feature} className="flex items-center gap-3">
              <div className="w-5 h-5 bg-[#6b7c3f] rounded-full flex items-center justify-center shrink-0">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <p className="text-gray-300 text-sm">{feature}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="relative z-10">
        <p className="text-gray-500 text-sm italic">"A journey of a thousand miles begins with a single step."</p>
        <p className="text-gray-600 text-xs mt-1">— Lao Tzu</p>
      </div>
    </div>
  );
};

const SignUp = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState(0);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [expenses, setExpenses] = useState([]);
  const [otpValue, setOtpValue] = useState("");
  const [otpError, setOtpError] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const countdown = useCountdown(900);

  const { values, errors, loading, serverError, setLoading, setServerError, handleChange, validate } =
    useAuthForm({ fullName: "", email: "", phone: "", monthlySalary: "", password: "", confirmPassword: "" });

  const step0Rules = { fullName: rules.fullName, email: rules.email, phone: rules.phone };
  const step1Rules = { monthlySalary: rules.monthlySalary, password: rules.password, confirmPassword: rules.confirmPassword };

  const handleNext = () => { if (validate(step0Rules)) setStep(1); };

  const addExpense = () => setExpenses((p) => [...p, { category: EXPENSE_CATEGORIES[0].value, label: "", amount: "" }]);
  const updateExpense = (i, f, v) => setExpenses((p) => p.map((e, idx) => idx === i ? { ...e, [f]: v } : e));
  const removeExpense = (i) => setExpenses((p) => p.filter((_, idx) => idx !== i));

  const totalExpenses = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const salary = parseFloat(values.monthlySalary) || 0;
  const disposable = salary - totalExpenses;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate(step1Rules)) return;
    const cats = expenses.map((e) => e.category);
    if (new Set(cats).size !== cats.length) { setServerError("Cannot have multiple expenses with the same category"); return; }
    if (totalExpenses > salary) { setServerError(`Total expenses (BD ${totalExpenses.toFixed(3)}) cannot exceed monthly salary (BD ${salary.toFixed(3)})`); return; }
    setLoading(true);
    try {
      const monthlyExpenses = expenses.filter((e) => e.amount && parseFloat(e.amount) > 0)
        .map((e) => ({ category: e.category, label: e.label || null, amount: parseFloat(e.amount) }));
      await authService.register({ fullName: values.fullName, email: values.email, phone: values.phone, password: values.password, monthlySalary: parseFloat(values.monthlySalary) || 0, monthlyExpenses });
      setRegisteredEmail(values.email);
      countdown.reset(900);
      setStep(2);
    } catch (err) { setServerError(err.message); }
    finally { setLoading(false); }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (otpValue.length !== 6) { setOtpError("Please enter all 6 digits"); return; }
    setOtpError("");
    setLoading(true);
    try {
      const data = await authService.verifyEmail({ email: registeredEmail, code: otpValue });
      login(data);
      navigate("/dashboard");
    } catch (err) { setOtpError(err.message); setOtpValue(""); }
    finally { setLoading(false); }
  };

  const handleResend = async () => {
    setResendLoading(true);
    setResendSuccess(false);
    try {
      await authService.resendVerification({ email: registeredEmail });
      setOtpValue(""); setOtpError(""); countdown.reset(900); setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 4000);
    } catch (err) { setOtpError(err.message); }
    finally { setResendLoading(false); }
  };

  const STEPS = ["Personal Info", "Financial Setup", "Verify Email"];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <LeftPanel step={step} salary={salary} totalExpenses={totalExpenses} disposable={disposable} registeredEmail={registeredEmail} />

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-[#6b7c3f] rounded-lg flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M3 17L9 11L13 15L21 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-lg">PathWise</span>
          </div>

          <StepIndicator currentStep={step} steps={STEPS} />

          {/* ── STEP 0 ── */}
          {step === 0 && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-black text-gray-900 mb-2">Create account</h1>
                <p className="text-gray-500 text-sm">Already have an account?{" "}<Link to="/login" className="text-[#6b7c3f] font-semibold hover:underline">Log in</Link></p>
              </div>
              {serverError && <ErrorBanner message={serverError} />}
              <div className="flex flex-col gap-5">
                <InputField label="Full name" name="fullName" type="text" value={values.fullName} onChange={handleChange} error={errors.fullName} placeholder="Jane Doe" autoComplete="name" />
                <InputField label="Email address" name="email" type="email" value={values.email} onChange={handleChange} error={errors.email} placeholder="you@example.com" autoComplete="email" />
                <InputField label="Phone Number" name="phone" type="tel" value={values.phone} onChange={handleChange} error={errors.phone} placeholder="12345678" autoComplete="tel" />
                <button type="button" onClick={handleNext} className="w-full py-3.5 bg-[#6b7c3f] hover:bg-[#5a6a33] text-white font-bold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 mt-1">
                  Continue
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>
            </>
          )}

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-black text-gray-900 mb-2">Your finances</h1>
                <p className="text-gray-500 text-sm">Add your salary and fixed monthly expenses to get accurate savings projections.</p>
              </div>
              {serverError && <ErrorBanner message={serverError} />}
              <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
                <InputField label="Monthly Salary (BHD)" name="monthlySalary" type="number" value={values.monthlySalary} onChange={handleChange} error={errors.monthlySalary} placeholder="0.000" step="0.001" min="0" />
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Fixed Monthly Expenses</p>
                      <p className="text-xs text-gray-400">Optional — helps calculate disposable income</p>
                    </div>
                    <button type="button" onClick={addExpense} className="flex items-center gap-1.5 text-xs font-semibold text-[#6b7c3f] hover:text-[#5a6a33] bg-[#6b7c3f]/10 hover:bg-[#6b7c3f]/20 px-3 py-1.5 rounded-lg transition-colors">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
                      Add
                    </button>
                  </div>
                  {expenses.length === 0 ? (
                    <div onClick={addExpense} className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-[#6b7c3f]/40 hover:bg-[#6b7c3f]/5 transition-all duration-200 group">
                      <div className="w-10 h-10 bg-gray-100 group-hover:bg-[#6b7c3f]/10 rounded-full flex items-center justify-center mx-auto mb-2 transition-colors">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
                      </div>
                      <p className="text-sm text-gray-400 group-hover:text-gray-500">Click to add your first expense</p>
                      <p className="text-xs text-gray-300 mt-0.5">Rent, transport, utilities, etc.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                      {expenses.map((expense, i) => <ExpenseRow key={i} expense={expense} index={i} onUpdate={updateExpense} onRemove={removeExpense} />)}
                    </div>
                  )}
                  {expenses.length > 0 && (
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl border border-gray-100">
                      <span className="text-xs text-gray-500 font-medium">Disposable income after expenses</span>
                      <span className={`text-sm font-bold ${disposable >= 0 ? "text-[#6b7c3f]" : "text-red-500"}`}>BD {disposable.toFixed(3)}</span>
                    </div>
                  )}
                </div>
                <InputField label="Password" name="password" type="password" value={values.password} onChange={handleChange} error={errors.password} placeholder="Min. 6 characters" autoComplete="new-password" />
                <InputField label="Confirm password" name="confirmPassword" type="password" value={values.confirmPassword} onChange={handleChange} error={errors.confirmPassword} placeholder="Repeat your password" autoComplete="new-password" />
                <div className="flex gap-3 mt-1">
                  <button type="button" onClick={() => setStep(0)} className="px-5 py-3.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-all duration-200">Back</button>
                  <button type="submit" disabled={loading} className="flex-1 py-3.5 bg-[#6b7c3f] hover:bg-[#5a6a33] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2">
                    {loading ? (<><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" /><path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" /></svg>Creating account...</>) : "Create Account"}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ── STEP 2: Verify Email ── */}
          {step === 2 && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-black text-gray-900 mb-2">Check your email</h1>
                <p className="text-gray-500 text-sm">We sent a 6-digit code to{" "}<span className="font-semibold text-gray-700">{registeredEmail}</span></p>
              </div>
              {otpError && <ErrorBanner message={otpError} />}
              {resendSuccess && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  <p className="text-green-700 text-sm font-medium">New code sent! Check your inbox.</p>
                </div>
              )}
              <form onSubmit={handleVerify} className="flex flex-col gap-6" noValidate>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-gray-700 text-center">Verification code</label>
                  <OtpInput value={otpValue} onChange={setOtpValue} disabled={loading} />
                </div>
                <div className="flex items-center justify-center gap-2 text-sm">
                  {countdown.expired ? (
                    <p className="text-red-500 font-medium">Code expired — please request a new one</p>
                  ) : (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" strokeLinecap="round" /></svg><span className="text-gray-500">Expires in </span><span className="font-mono font-semibold text-gray-700">{countdown.label}</span></>
                  )}
                </div>
                <button type="submit" disabled={loading || otpValue.length !== 6}
                  className="w-full py-3.5 bg-[#6b7c3f] hover:bg-[#5a6a33] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2">
                  {loading ? (<><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" /><path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" /></svg>Verifying...</>) : "Verify & Continue"}
                </button>
                <div className="text-center text-sm text-gray-500">
                  Didn't receive a code?{" "}
                  <button type="button" onClick={handleResend} disabled={resendLoading}
                    className="text-[#6b7c3f] font-semibold hover:underline disabled:text-gray-400 disabled:cursor-not-allowed">
                    {resendLoading ? "Sending..." : "Resend code"}
                  </button>
                </div>
                <p className="text-center text-xs text-gray-400">
                  Wrong email?{" "}
                  <button type="button" onClick={() => { setStep(0); setOtpValue(""); setOtpError(""); }}
                    className="text-[#6b7c3f] font-semibold hover:underline">Go back and edit</button>
                </p>
              </form>
            </>
          )}

          {step !== 2 && (
            <p className="mt-8 text-center text-xs text-gray-400">
              By signing up, you agree to PathWise's{" "}
              <a href="#" className="underline hover:text-gray-600">Terms</a> and{" "}
              <a href="#" className="underline hover:text-gray-600">Privacy Policy</a>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignUp;