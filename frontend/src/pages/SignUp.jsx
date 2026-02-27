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
      phone: "", // Add phone field
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
        phone: values.phone, // Include phone
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

  // In your form JSX, add the phone field after email:
  return (
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

      {/* Add phone field here */}
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
  );
};