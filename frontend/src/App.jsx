// ─────────────────────────────────────────────────────────────────────────────
//
// Route map:
//   /             → LandingPage        (public)
//   /login        → Login              (public)
//   /signup       → SignUp             (public)
//   /dashboard    → DashboardPage      (protected) — "Home" in nav
//   /insights     → InsightsPage       (protected) — "Insights" in nav
//   /goals        → GoalsPage          (protected) — "Goals" in nav
//   /profile      → ProfilePage        (protected) — user dropdown
//
// InsightsProvider wraps /dashboard, /insights, and /profile so all three
// share the same analytics / transactions / accounts state without redundant
// fetches.  GoalsProvider wraps only /goals.
// ─────────────────────────────────────────────────────────────────────────────

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider }      from "./context/AuthContext.jsx";
import { GoalsProvider }     from "./context/GoalsContext.jsx";
import { InsightsProvider }  from "./context/InsightsContext.jsx";
import ProtectedRoute        from "./components/common/ProtectedRoute.jsx";
import LandingPage           from "./pages/LandingPage.jsx";
import Login                 from "./pages/Login.jsx";
import SignUp                from "./pages/SignUp.jsx";
import DashboardPage         from "./pages/DashboardPage.jsx";
import InsightsPage          from "./pages/InsightsPage.jsx";
import GoalsPage             from "./pages/GoalsPage.jsx";
import ProfilePage           from "./pages/ProfilePage.jsx";
import ForgotPassword        from "./pages/Forgotpassword.jsx";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Public ─────────────────────────────────────────────── */}
          <Route path="/"       element={<LandingPage />} />
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* ── Protected — insights feature shares one provider ────── */}
          {/*
            InsightsProvider wraps dashboard + insights + profile together
            so navigating between them doesn't re-fetch everything.
            Each route still gets its own ProtectedRoute guard.
          */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <InsightsProvider>
                  <DashboardPage />
                </InsightsProvider>
              </ProtectedRoute>
            }
          />

          <Route
            path="/insights"
            element={
              <ProtectedRoute>
                <InsightsProvider>
                  <InsightsPage />
                </InsightsProvider>
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                {/* InsightsProvider needed here for MyCardTab */}
                <InsightsProvider>
                  <ProfilePage />
                </InsightsProvider>
              </ProtectedRoute>
            }
          />

          <Route
            path="/goals"
            element={
              <ProtectedRoute>
                <GoalsProvider>
                  <GoalsPage />
                </GoalsProvider>
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;