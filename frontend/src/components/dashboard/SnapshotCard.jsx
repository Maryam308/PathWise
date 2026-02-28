import { fmt } from "../../utils/dashboardConstants";

const SnapshotCard = ({ label, value, sub, highlight }) => (
  <div
    className={`rounded-2xl border p-4 ${
      highlight
        ? "bg-[#f5f7f0] border-[#d4ddb8]"
        : "bg-white border-gray-100"
    }`}
  >
    <p className="text-xs text-gray-500 font-medium">{label}</p>
    <p
      className={`text-xl font-black mt-1 ${
        highlight ? "text-[#3d4f22]" : "text-gray-900"
      }`}
    >
      {value}
    </p>
    {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
  </div>
);

export default SnapshotCard;