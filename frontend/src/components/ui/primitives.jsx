/**
 * Shared UI primitives used across the goals feature.
 *
 * FormField   — label + input + error message in one unit
 * Spinner     — animated loading indicator
 * ModalShell  — backdrop + centred white card wrapper
 */

// ── FormField ─────────────────────────────────────────────────────────────────
/**
 * A labelled form control with optional error state.
 *
 * @param {string}    label
 * @param {string}    [hint]       — small grey hint rendered after the label
 * @param {string}    [error]      — validation error; renders below the input
 * @param {ReactNode} children     — the actual <input>, <select>, etc.
 */
export const FormField = ({ label, hint, error, children, className = "" }) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    <label className="flex items-baseline gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
      {label}
      {hint && <span className="font-normal normal-case tracking-normal text-gray-400">{hint}</span>}
    </label>
    {children}
    {error && (
      <p className="text-xs text-red-500 flex items-center gap-1">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" stroke="white" strokeWidth="2" />
          <line x1="12" y1="16" x2="12.01" y2="16" stroke="white" strokeWidth="2" />
        </svg>
        {error}
      </p>
    )}
  </div>
);

// ── Spinner ───────────────────────────────────────────────────────────────────
/**
 * @param {"sm"|"md"} [size="md"]
 * @param {string}    [color="white"]
 */
export const Spinner = ({ size = "md", color = "white" }) => {
  const dim = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  return (
    <svg className={`animate-spin ${dim}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke={color} strokeWidth="4" />
      <path
        className="opacity-75"
        fill={color}
        d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
      />
    </svg>
  );
};

// ── ModalShell ────────────────────────────────────────────────────────────────
/**
 * Backdrop + centred white card.  Pass `onClose` to close on backdrop click.
 *
 * @param {() => void} onClose
 * @param {string}     [maxWidth="max-w-lg"]
 * @param {ReactNode}  children
 */
export const ModalShell = ({ onClose, maxWidth = "max-w-lg", children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
    <div
      className={`relative bg-white rounded-3xl shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}
    >
      {children}
    </div>
  </div>
);

// ── CloseButton ───────────────────────────────────────────────────────────────
export const CloseButton = ({ onClick }) => (
  <button
    onClick={onClick}
    className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  </button>
);

// ── InputBase ─────────────────────────────────────────────────────────────────
/**
 * Shared className factory for <input> elements.
 * Keeps focus/error states consistent across all form inputs.
 */
export const inputCn = (hasError = false) =>
  [
    "w-full px-4 py-3 rounded-xl border text-sm font-medium placeholder-gray-300 outline-none transition-all",
    hasError
      ? "border-red-300 bg-red-50 focus:ring-1 focus:ring-red-200"
      : "border-gray-200 focus:border-[#6b7c3f] focus:ring-2 focus:ring-[#6b7c3f]/10",
  ].join(" ");