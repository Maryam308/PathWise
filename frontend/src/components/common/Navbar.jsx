// ─────────────────────────────────────────────────────────────────────────────
// components/common/Navbar.jsx
//
// Authenticated nav links: Home (/dashboard)  Insights (/insights)  Goals (/goals)
// Unauthenticated: Login + Sign Up buttons
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { Link, NavLink, useNavigate }  from "react-router-dom";
import { useAuth }                     from "../../context/AuthContext.jsx";

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate                          = useNavigate();

  const [scrolled,     setScrolled]     = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef                     = useRef(null);

  // Shadow on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    setMobileOpen(false);
    navigate("/");
  };

  // Active link classes
  const navLinkCn = ({ isActive }) =>
    `text-sm font-semibold transition-colors ${
      isActive ? "text-[#6b7c3f]" : "text-gray-600 hover:text-[#6b7c3f]"
    }`;

  // Initials avatar
  const initials = user?.fullName
    ? user.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-40 bg-white transition-shadow duration-200 ${
        scrolled ? "shadow-md" : "shadow-sm"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* ── Logo ─────────────────────────────────────────────────────── */}
        <Link to={isAuthenticated ? "/dashboard" : "/"} className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#6b7c3f] rounded-lg flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="white" strokeWidth="2.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinecap="round"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <span className="font-black text-[#2c3347] text-base tracking-tight">PathWise</span>
        </Link>

        {/* ── Desktop nav links ─────────────────────────────────────────── */}
        <div className="hidden md:flex items-center gap-8">
          {isAuthenticated ? (
            <>
              <NavLink to="/dashboard" className={navLinkCn}>Home</NavLink>
              <NavLink to="/insights"  className={navLinkCn}>Insights</NavLink>
              <NavLink to="/goals"     className={navLinkCn}>Goals</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/"     end className={navLinkCn}>Home</NavLink>
              <NavLink to="/login"    className={navLinkCn}>Login</NavLink>
            </>
          )}
        </div>

        {/* ── Right side ───────────────────────────────────────────────── */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            /* User dropdown */
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((p) => !p)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl
                           hover:bg-gray-50 transition-colors"
              >
                {/* Avatar */}
                <div className="w-7 h-7 rounded-full bg-[#6b7c3f] flex items-center
                                justify-center text-white text-xs font-bold">
                  {initials}
                </div>
                <span className="text-sm font-semibold text-gray-700">
                  Hello, {user?.fullName?.split(" ")[0] || "User"}
                </span>
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="#9ca3af" strokeWidth="2.5"
                  className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" strokeLinecap="round"/>
                </svg>
              </button>

              {/* Dropdown menu */}
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-2xl
                                shadow-xl border border-gray-100 py-1.5 overflow-hidden">
                  <Link
                    to="/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700
                               hover:bg-gray-50 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm
                               text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Unauthenticated buttons */
            <>
              <Link to="/login"
                className="text-sm font-semibold text-gray-600 hover:text-[#6b7c3f]
                           transition-colors px-3 py-1.5">
                Login
              </Link>
              <Link to="/signup"
                className="text-sm font-bold bg-[#2c3347] hover:bg-[#3d4357] text-white
                           px-4 py-2 rounded-xl transition-all">
                Sign Up
              </Link>
            </>
          )}
        </div>

        {/* ── Mobile hamburger ─────────────────────────────────────────── */}
        <button
          onClick={() => setMobileOpen((p) => !p)}
          className="md:hidden w-9 h-9 flex flex-col items-center justify-center gap-1.5
                     rounded-lg hover:bg-gray-50 transition-colors"
          aria-label="Toggle menu"
        >
          <span className={`block w-5 h-0.5 bg-gray-700 transition-all ${mobileOpen ? "rotate-45 translate-y-2" : ""}`} />
          <span className={`block w-5 h-0.5 bg-gray-700 transition-all ${mobileOpen ? "opacity-0" : ""}`} />
          <span className={`block w-5 h-0.5 bg-gray-700 transition-all ${mobileOpen ? "-rotate-45 -translate-y-2" : ""}`} />
        </button>
      </div>

      {/* ── Mobile menu ──────────────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-6 py-4 flex flex-col gap-3">
          {isAuthenticated ? (
            <>
              <NavLink to="/dashboard" onClick={() => setMobileOpen(false)} className={navLinkCn}>Home</NavLink>
              <NavLink to="/insights"  onClick={() => setMobileOpen(false)} className={navLinkCn}>Insights</NavLink>
              <NavLink to="/goals"     onClick={() => setMobileOpen(false)} className={navLinkCn}>Goals</NavLink>
              <NavLink to="/profile"   onClick={() => setMobileOpen(false)} className={navLinkCn}>Profile</NavLink>
              <button onClick={handleLogout}
                className="text-sm font-semibold text-red-500 text-left">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/"      onClick={() => setMobileOpen(false)} className="text-sm font-semibold text-gray-600">Home</Link>
              <Link to="/login" onClick={() => setMobileOpen(false)} className="text-sm font-semibold text-gray-600">Login</Link>
              <Link to="/signup" onClick={() => setMobileOpen(false)}
                className="text-sm font-bold bg-[#2c3347] text-white px-4 py-2 rounded-xl text-center">
                Sign Up
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;