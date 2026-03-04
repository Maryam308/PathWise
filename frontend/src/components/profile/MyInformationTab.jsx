import { useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { profileService } from "../../services/profileService.js";
import ExpensesSection from "./ExpensesSection.jsx";

// ── Reusable read-only field ─────────────────────────────────────────────────
const ReadOnlyField = ({ label, value, iconPath }) => (
  <div>
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
      {label}
    </p>
    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl">
      <svg
        width="15" height="15" viewBox="0 0 24 24"
        fill="none" stroke="#9ca3af" strokeWidth="2"
        className="shrink-0"
      >
        {iconPath}
      </svg>
      <span className="text-sm text-gray-600 font-medium flex-1">{value || "—"}</span>
      <span className="text-xs text-gray-300 font-medium">Read only</span>
    </div>
  </div>
);

// ── Main tab ─────────────────────────────────────────────────────────────────
const MyInformationTab = () => {
  const { user, token, setUser } = useAuth();

  const [editingName, setEditingName] = useState(false);
  const [nameValue,   setNameValue]   = useState(user?.fullName || "");
  const [saving,      setSaving]      = useState(false);
  const [nameError,   setNameError]   = useState(null);
  const [nameSuccess, setNameSuccess] = useState(false);

  const startEdit = () => {
    setNameValue(user?.fullName || "");
    setNameError(null);
    setEditingName(true);
  };

  const cancelEdit = () => {
    setNameValue(user?.fullName || "");
    setNameError(null);
    setEditingName(false);
  };

  const handleSaveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed) { setNameError("Name cannot be empty."); return; }
    if (trimmed === user?.fullName) { setEditingName(false); return; }

    setSaving(true);
    setNameError(null);
    try {
      const updated = await profileService.updateName(token, trimmed);
      // Sync back into AuthContext so the Navbar avatar/greeting updates too
      if (typeof setUser === "function") {
        setUser((prev) => ({ ...prev, fullName: updated.fullName ?? trimmed }));
      }
      setEditingName(false);
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch (err) {
      setNameError(err.message || "Failed to update name.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">

      {/* Name success toast */}
      {nameSuccess && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-sm text-emerald-700 font-medium">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Name updated successfully!
        </div>
      )}

      {/* ── Full Name (editable) ──────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
          Full Name
        </p>

        {editingName ? (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={nameValue}
              autoFocus
              onChange={(e) => { setNameValue(e.target.value); setNameError(null); }}
              onKeyDown={(e) => {
                if (e.key === "Enter")  handleSaveName();
                if (e.key === "Escape") cancelEdit();
              }}
              className={`w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none transition-all ${
                nameError
                  ? "border-red-300 bg-red-50 focus:ring-1 focus:ring-red-200"
                  : "border-[#6b7c3f] bg-white focus:ring-2 focus:ring-[#6b7c3f]/15"
              }`}
            />
            {nameError && (
              <p className="text-xs text-red-500 flex items-center gap-1">⚠ {nameError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={cancelEdit}
                className="px-4 py-2 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveName}
                disabled={saving}
                className="px-4 py-2 text-xs font-bold text-white bg-[#6b7c3f] hover:bg-[#5a6a33] disabled:bg-gray-300 rounded-lg transition-colors"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl group">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="shrink-0">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span className="text-sm text-gray-800 font-medium flex-1">
              {user?.fullName || "—"}
            </span>
            <button
              onClick={startEdit}
              className="flex items-center gap-1 text-xs font-semibold text-[#6b7c3f] opacity-0 group-hover:opacity-100 transition-opacity hover:text-[#5a6a33]"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit
            </button>
          </div>
        )}
      </div>

      {/* ── Email (read only) ─────────────────────────────────────────────── */}
      <ReadOnlyField
        label="Email"
        value={user?.email}
        iconPath={
          <>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </>
        }
      />

      {/* ── Phone (read only) ─────────────────────────────────────────────── */}
      <ReadOnlyField
        label="Phone Number"
        value={user?.phone}
        iconPath={
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.59 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 5.68 5.68l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
        }
      />

      {/* ── Divider ───────────────────────────────────────────────────────── */}
      <div className="h-px bg-gray-100 my-1" />

      {/* ── Monthly Expenses ─────────────────────────────────────────────── */}
      <ExpensesSection />
    </div>
  );
};

export default MyInformationTab;