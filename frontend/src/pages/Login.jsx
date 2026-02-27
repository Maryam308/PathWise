import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { authService } from "../services/authService.js";
import { useAuthForm } from "../hooks/useAuthForm.js";
import InputField from "../components/auth/InputField.jsx";

const rules = {
  email: [
    (v) => (!v ? "Email is required" : null),
    (v) => (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "Invalid email format" : null),
  ],
  password: [
    (v) => (!v ? "Password is required" : null),
    (v) => (v.length < 6 ? "Password must be at least 6 characters" : null),
  ],
};

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { values, errors, loading, serverError, setLoading, setServerError, handleChange, validate } =
    useAuthForm({ email: "", password: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate(rules)) return;
    setLoading(true);
    try {
      const data = await authService.login(values);
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
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#2c2c2c] relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full opacity-5">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute border border-white rounded-full"
                style={{
                  width: `${(i + 1) * 120}px`,
                  height: `${(i + 1) * 120}px`,
                  top: "50%",
                  left: "30%",
                  transform: "translate(-50%, -50%)",
                }}
              />
            ))}
          </div>
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#6b7c3f] opacity-20 rounded-full blur-3xl" />
          <div className="absolute top-20 left-10 w-40 h-40 bg-[#6b7c3f] opacity-10 rounded-full blur-2xl" />
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

        <div className="relative z-10 flex flex-col gap-8">
          <div>
            <h2 className="text-4xl font-black text-white leading-tight mb-4">
              Welcome back to your financial journey
            </h2>
            <p className="text-gray-400 text-base leading-relaxed">
              Track your goals, monitor your spending, and stay on the path to financial freedom.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Goals Achieved", value: "$10K+" },
              { label: "Active Users", value: "1,200+" },
              { label: "Avg. Savings", value: "23%" },
              { label: "Uptime", value: "99.9%" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
                <p className="text-2xl font-black text-white">{stat.value}</p>
                <p className="text-gray-400 text-xs mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-gray-500 text-sm italic">"The secret of getting ahead is getting started."</p>
          <p className="text-gray-600 text-xs mt-1">— Mark Twain</p>
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
            <h1 className="text-3xl font-black text-gray-900 mb-2">Log in</h1>
            <p className="text-gray-500 text-sm">
              Don't have an account?{" "}
              <Link to="/signup" className="text-[#6b7c3f] font-semibold hover:underline">
                Sign up
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
              label="Email address"
              name="email"
              type="email"
              value={values.email}
              onChange={handleChange}
              error={errors.email}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <InputField
              label="Password"
              name="password"
              type="password"
              value={values.password}
              onChange={handleChange}
              error={errors.password}
              placeholder="••••••••"
              autoComplete="current-password"
            />

            <div className="flex justify-end">
              <a href="#" className="text-sm text-[#6b7c3f] hover:underline font-medium">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#6b7c3f] hover:bg-[#5a6a33] disabled:bg-gray-300 disabled:cursor-not-allowed
                text-white font-bold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg
                hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                    <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                  </svg>
                  Logging in...
                </>
              ) : "Log In"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-gray-400">
            By continuing, you agree to PathWise's{" "}
            <a href="#" className="underline hover:text-gray-600">Terms</a> and{" "}
            <a href="#" className="underline hover:text-gray-600">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;