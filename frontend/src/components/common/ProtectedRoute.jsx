import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loggingOut } = useAuth();

  if (loggingOut) return null;

  return isAuthenticated ? children : <Navigate to="/" replace />;
};

export default ProtectedRoute;