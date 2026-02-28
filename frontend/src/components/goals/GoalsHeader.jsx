const GoalsHeader = ({ goals, onNewGoal, onViewProjections }) => {
  const totalSaved = goals.reduce((sum, g) => sum + (parseFloat(g.savedAmount) || 0), 0);
  const activeGoals = goals.filter((g) => g.status !== "COMPLETED").length;
  const closestDeadline = goals
    .filter((g) => g.status !== "COMPLETED" && g.deadline)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0];

  // Financial data comes from any goal response (all carry the same snapshot)
  const snapshot = goals[0] || {};
  const disposable       = parseFloat(snapshot.disposableIncome || 0);
  const totalCommitment  = parseFloat(snapshot.totalMonthlyCommitment || 0);
  const salary           = parseFloat(snapshot.monthlySalary || 0);
  const totalExpenses    = parseFloat(snapshot.totalMonthlyExpenses || 0);
  const availableToSave  = Math.max(0, disposable - totalCommitment);
  const savingsRate      = snapshot.savingsRatePercent;
  const warningLevel     = snapshot.warningLevel;

  const formatBD = (v) =>
    v.toLocaleString("en-BH", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  const formatShort = (v) =>
    v >= 1000
      ? `BD ${(v / 1000).toFixed(1)}K`
      : `BD ${v.toLocaleString("en-BH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const formatDeadline = (d) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div>
      {/* Hero banner */}
      <div className="bg-[#2c3347] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="absolute border border-white/30 rounded-full"
              style={{ width: `${(i + 1) * 200}px`, height: `${(i + 1) * 200}px`, top: "50%", right: "-5%", transform: "translate(0, -50%)" }}
            />
          ))}
        </div>
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-10 lg:py-14">
          <p className="text-[#a3b46a] text-xs font-semibold uppercase tracking-widest mb-3">Life Milestone Planner</p>
          <h1 className="text-3xl lg:text-4xl font-black text-white leading-tight mb-3">
            Your Path to <span className="text-[#a3b46a]">Financial Freedom</span>
          </h1>
          <p className="text-gray-400 text-sm max-w-xl leading-relaxed mb-8">
            Track every goal, simulate spending scenarios, and let your AI coach guide you to milestones faster.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={onNewGoal}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#6b7c3f] hover:bg-[#5a6a33] text-white text-sm font-bold rounded-xl transition-all shadow-md hover:-translate-y-0.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
              </svg>
              New Goal
            </button>
            <button onClick={onViewProjections}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-xl transition-all border border-white/20">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              View Projections
            </button>
          </div>
        </div>
      </div>

      {/* Stats + financial summary */}
      <div className="max-w-6xl mx-auto px-6 -mt-6 relative z-10 flex flex-col gap-4">
        {/* Top 3 stat cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#6b7c3f] rounded-2xl p-5 shadow-lg">
            <p className="text-[#c5d48a] text-xs font-semibold uppercase tracking-wider mb-1">Total Saved</p>
            <p className="text-white text-2xl font-black">{formatShort(totalSaved)}</p>
          </div>
          <div className="bg-[#3d4357] rounded-2xl p-5 shadow-lg">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Active Goals</p>
            <p className="text-white text-2xl font-black">{activeGoals} Goals</p>
          </div>
          <div className="bg-[#2c3347] rounded-2xl p-5 shadow-lg border border-white/5">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Closest Deadline</p>
            <p className="text-white text-lg font-black leading-tight">
              {closestDeadline ? formatDeadline(closestDeadline.deadline) : "No deadlines set"}
            </p>
          </div>
        </div>

        {/* Financial summary strip — only shown when we have data */}
        {salary > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-gray-800">Monthly Financial Summary</p>
              {warningLevel && warningLevel !== "NONE" && (
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                  warningLevel === "RED" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                }`}>
                  {warningLevel === "RED" ? "⚠ Over budget" : "⚠ Ambitious savings rate"}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Monthly Salary</p>
                <p className="text-sm font-black text-gray-900">BD {formatBD(salary)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Fixed Expenses</p>
                <p className="text-sm font-black text-red-500">− BD {formatBD(totalExpenses)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Disposable Income</p>
                <p className="text-sm font-black text-gray-900">BD {formatBD(disposable)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Committed to Goals</p>
                <p className="text-sm font-black text-[#6b7c3f]">BD {formatBD(totalCommitment)}</p>
              </div>
            </div>

            {/* Progress bar: committed vs disposable */}
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                <span>
                  Saving {savingsRate != null ? `${savingsRate.toFixed(1)}% of disposable` : "—"}
                </span>
                <span className={`font-semibold ${availableToSave > 0 ? "text-[#6b7c3f]" : "text-red-500"}`}>
                  BD {formatBD(availableToSave)} still allocatable
                </span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    warningLevel === "RED" ? "bg-red-400" : warningLevel === "AMBER" ? "bg-amber-400" : "bg-[#6b7c3f]"
                  }`}
                  style={{ width: `${Math.min((totalCommitment / Math.max(disposable, 1)) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-300 mt-1">
                <span>BD 0</span>
                <span>BD {formatBD(disposable)} (disposable)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoalsHeader;