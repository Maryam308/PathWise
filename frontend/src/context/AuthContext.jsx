import { createContext, useContext, useState, useCallback, useEffect } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("pathwise_user");
    return stored ? JSON.parse(stored) : null;
  });

  const [token, setToken] = useState(() => localStorage.getItem("pathwise_token"));
  const [loggingOut, setLoggingOut] = useState(false);

  const login = useCallback((authResponse) => {
    const { token, email, fullName, id, phone } = authResponse;
    const userData = { email, fullName, id, phone };
    setToken(token);
    setUser(userData);
    localStorage.setItem("pathwise_token", token);
    localStorage.setItem("pathwise_user", JSON.stringify(userData));
  }, []);

  const logout = useCallback(() => {
    setLoggingOut(true);
    setToken(null);
    setUser(null);
    localStorage.removeItem("pathwise_token");
    localStorage.removeItem("pathwise_user");
    setTimeout(() => setLoggingOut(false), 100);
  }, []);

  // Listen for auth:logout events dispatched by apiClient
  // when a 401 or network failure is caught mid-session
  useEffect(() => {
    window.addEventListener("auth:logout", logout);
    return () => window.removeEventListener("auth:logout", logout);
  }, [logout]);

  const updateUser = useCallback((newUserData) => {
    setUser(newUserData);
    localStorage.setItem("pathwise_user", JSON.stringify(newUserData));
  }, []);

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      logout,
      isAuthenticated,
      loggingOut,
      updateUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};