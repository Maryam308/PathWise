import { GOAL_FILTER_OPTIONS } from "../../constants/goals.js";

const GoalFilters = ({ activeFilter, onFilterChange, goalCounts }) => (
  <div className="flex flex-wrap gap-2">
    {GOAL_FILTER_OPTIONS.map((f) => {
      const count = goalCounts?.[f.key];
      const active = activeFilter === f.key;
      return (
        <button key={f.key} onClick={() => onFilterChange(f.key)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
            active ? "bg-[#2c3347] text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}>
          {f.label}
          {count != null && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              active ? "bg-white/20 text-white" : "bg-gray-200 text-gray-500"
            }`}>
              {count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

export default GoalFilters;