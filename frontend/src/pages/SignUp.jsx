import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { authService } from "../services/authService.js";
import { useAuthForm } from "../hooks/useAuthForm.js";
import InputField from "../components/auth/InputField.jsx";

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
    (v) => (!/^[0-9+\-\s()]{8,15}$/.test(v) ? "Enter a valid phone number" : null),
  ],
  monthlySalary: [
    (v) => {
      if (!v && v !== 0) return "Monthly salary is required";
      if (isNaN(v) || v === '') return "Monthly salary must be a number";
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

const SignUp = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { values, errors, loading, serverError, setLoading, setServerError, handleChange, validate } =
    useAuthForm({
      fullName: "",
      email: "",
      phone: "",
      monthlySalary: "",
      password: "",
      confirmPassword: ""
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate(rules)) return;
    setLoading(true);
    try {
      const data = await authService.register({
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        password: values.password,
        monthlySalary: parseFloat(values.monthlySalary) || 0,
      });
      login(data);
      navigate("/dashboard");
    } catch (err) {
      setServerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#2c2c2c] relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0">
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#6b7c3f] opacity-20 rounded-full blur-3xl" />
          <div className="absolute top-10 right-10 w-48 h-48 bg-[#6b7c3f] opacity-10 rounded-full blur-2xl" />
          <div className="absolute top-0 left-0 w-full h-full opacity-5">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute border border-white rounded-full"
                style={{
                  width: `${(i + 1) * 140}px`,
                  height: `${(i + 1) * 140}px`,
                  bottom: "-20%",
                  left: "20%",
                  transform: "translate(-50%, 50%)",
                }}
              />
            ))}
          </div>
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
            Start your path to financial clarity
          </h2>
          <p className="text-gray-400 leading-relaxed">
            Join thousands of people who use PathWise to track goals, manage spending, and build a better financial future.
          </p>
          <div className="flex flex-col gap-3 mt-2">
            {[
              "Set and track financial goals",
              "Get personalized spending insights",
              "Visualize your financial health",
              "Secure and private — always",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <div className="w-5 h-5 bg-[#6b7c3f] rounded-full flex items-center justify-center shrink-0">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
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

      {/* Right Panel - Form */}
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

          <div className="mb-8">
            <h1 className="text-3xl font-black text-gray-900 mb-2">Create account</h1>
            <p className="text-gray-500 text-sm">
              Already have an account?{" "}
              <Link to="/login" className="text-[#6b7c3f] font-semibold hover:underline">
                Log in
              </Link>
            </p>
          </div>

          {serverError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <p className="text-red-600 text-sm font-medium">{serverError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            <InputField
              label="Full name"
              name="fullName"
              type="text"
              value={values.fullName}
              onChange={handleChange}
              error={errors.fullName}
              placeholder="Jane Doe"
              autoComplete="name"
            />
            <InputField
              label="Email address"
              name="email"
              type="email"
              value={values.email}
              onChange={handleChange}
              error={errors.email}
              placeholder="you@example.com"
              autoComplete="email"
            />

            {/* Phone field */}
            <InputField
              label="Phone Number"
              name="phone"
              type="tel"
              value={values.phone}
              onChange={handleChange}
              error={errors.phone}
              placeholder="+973 1234 5678"
              autoComplete="tel"
            />

            <InputField
              label="Monthly Salary (BHD)"
              name="monthlySalary"
              type="number"
              value={values.monthlySalary}
              onChange={handleChange}
              error={errors.monthlySalary}
              placeholder="0.000"
              step="0.001"
              min="0"
            />
            <InputField
              label="Password"
              name="password"
              type="password"
              value={values.password}
              onChange={handleChange}
              error={errors.password}
              placeholder="Min. 6 characters"
              autoComplete="new-password"
            />
            <InputField
              label="Confirm password"
              name="confirmPassword"
              type="password"
              value={values.confirmPassword}
              onChange={handleChange}
              error={errors.confirmPassword}
              placeholder="Repeat your password"
              autoComplete="new-password"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#6b7c3f] hover:bg-[#5a6a33] disabled:bg-gray-300 disabled:cursor-not-allowed
                text-white font-bold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg
                hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 mt-1"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                    <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                  </svg>
                  Creating account...
                </>
              ) : "Create Account"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-gray-400">
            By signing up, you agree to PathWise's{" "}
            <a href="#" className="underline hover:text-gray-600">Terms</a> and{" "}
            <a href="#" className="underline hover:text-gray-600">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUp;