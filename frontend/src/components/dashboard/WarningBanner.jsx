const WarningBanner = ({ level, message }) => {
  if (!level || level === "NONE" || !message) return null;

  const s =
    level === "RED"
      ? {
          bg: "bg-red-50",
          border: "border-red-200",
          text: "text-red-800",
          icon: "🔴",
        }
      : {
          bg: "bg-amber-50",
          border: "border-amber-200",
          text: "text-amber-800",
          icon: "⚠️",
        };

  return (
    <div
      className={`${s.bg} ${s.border} border rounded-xl px-4 py-3 flex items-start gap-3`}
    >
      <span>{s.icon}</span>
      <p className={`${s.text} text-sm`}>{message}</p>
    </div>
  );
};

export default WarningBanner;