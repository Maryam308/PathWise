import { STATUS, fmt } from "../../utils/dashboardConstants";

const GoalCard = ({
  goal,
  onProjection,
  onSimulation,
  onEdit,
  onDelete,
}) => {
  const s = STATUS[goal.status] || STATUS.ON_TRACK;
  const progress = Math.min(
    Math.max(goal.progressPercentage || 0, 0),
    100
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-gray-900">
            {goal.name}
          </h3>
          <p className="text-xs text-gray-400">
            {goal.category} · Due {goal.deadline}
          </p>
        </div>

        <span
          className={`${s.bg} ${s.text} text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${s.dot}`}
          />
          {s.label}
        </span>
      </div>

      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-[#6b7c3f]"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="text-xs text-right text-[#6b7c3f] font-semibold">
        {progress.toFixed(1)}%
      </p>

      <div className="flex gap-2 mt-3">
        <button onClick={() => onProjection(goal)}>📈</button>
        <button onClick={() => onSimulation(goal)}>🔮</button>
        <button onClick={() => onEdit(goal)}>✏️</button>
        <button onClick={() => onDelete(goal)}>🗑</button>
      </div>
    </div>
  );
};

export default GoalCard;