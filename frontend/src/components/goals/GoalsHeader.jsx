import { formatBDAmount, formatBDShort, formatDeadline, deadlineMs } from "../../utils/formatters.js";

const GoalsHeader = ({ goals, onNewGoal, onViewProjections, financialSnapshot }) => {
  const totalSaved   = goals.reduce((sum, g) => sum + (parseFloat(g.savedAmount) || 0), 0);
  const activeGoals  = goals.filter((g) => g.status !== "COMPLETED").length;
  const closestGoal  = goals
    .filter((g) => g.status !== "COMPLETED" && g.deadline)
    .sort((a, b) => deadlineMs(a.deadline) - deadlineMs(b.deadline))[0];

  // Use financialSnapshot prop instead of trying to get it from goals
  const disposable      = parseFloat(financialSnapshot?.disposableIncome || 0);
  const totalCommitment = parseFloat(financialSnapshot?.totalMonthlyCommitment || 0);
  const salary          = parseFloat(financialSnapshot?.monthlySalary || 0);
  const totalExpenses   = parseFloat(financialSnapshot?.totalMonthlyExpenses || 0);
  const availableToSave = Math.max(0, disposable - totalCommitment);
  const savingsRate     = financialSnapshot?.savingsRatePercent;
  const warningLevel    = financialSnapshot?.warningLevel;

  // Check if user has no remaining amount to allocate to new goals
  const hasNoRemainingAllocatable = availableToSave <= 0;

  return (
    <div>
      {/* ── Hero banner ──────────────────────────────────────────────────── */}
      <div className="bg-[#2c3347] relative overflow-hidden">
        <BackgroundRings />
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-10 lg:py-14">
          <p className="text-[#a3b46a] text-xs font-semibold uppercase tracking-widest mb-3">
            Life Milestone Planner
          </p>
          <h1 className="text-3xl lg:text-4xl font-black text-white leading-tight mb-3">
            Your Path to <span className="text-[#a3b46a]">Financial Freedom</span>
          </h1>
          <p className="text-gray-400 text-sm max-w-xl leading-relaxed mb-8">
            Track every goal, simulate spending scenarios, and let your AI coach guide you to milestones faster.
          </p>

          {/* Warning message when no remaining amount to allocate */}
          {hasNoRemainingAllocatable && (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
              <span className="text-amber-400 text-lg shrink-0 mt-0.5">⚠️</span>
              <div>
                <p className="text-amber-400 text-sm font-bold">No disposable income available for new goals</p>
                <p className="text-amber-400/70 text-xs mt-0.5">
                  Your expenses plus existing goal commitments fully consume your salary.
                  Consider reducing expenses or adjusting existing goal targets before creating new goals.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={onNewGoal}
              disabled={hasNoRemainingAllocatable}
              className={`flex items-center gap-2 px-5 py-2.5 text-white text-sm font-bold rounded-xl transition-all shadow-md ${
                hasNoRemainingAllocatable
                  ? "bg-gray-400 cursor-not-allowed hover:no-underline"
                  : "bg-[#6b7c3f] hover:bg-[#5a6a33] hover:-translate-y-0.5"
              }`}
              title={hasNoRemainingAllocatable ? "Cannot create new goals - no remaining disposable income" : ""}
            >
              <PlusIcon />
              New Goal
            </button>
            <button onClick={onViewProjections}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-xl transition-all border border-white/20">
              <ProjectionsIcon />
              View Projections
            </button>
          </div>
        </div>
      </div>

      {/* ── Stat cards + financial summary ───────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 -mt-6 relative z-10 flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-4">
          <StatCard color="bg-[#6b7c3f]" labelColor="text-[#c5d48a]" label="Total Saved">
            {formatBDShort(totalSaved)}
          </StatCard>
          <StatCard color="bg-[#3d4357]" labelColor="text-gray-400" label="Active Goals">
            {activeGoals} Goals
          </StatCard>
          <StatCard color="bg-[#2c3347]" labelColor="text-gray-400" label="Closest Deadline"
            border="border border-white/5" textSize="text-lg">
            {closestGoal ? formatDeadline(closestGoal.deadline) : "No deadlines set"}
          </StatCard>
        </div>

        {/* Financial summary — only shown when salary data is available */}
        {salary > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-gray-800">Monthly Financial Summary</p>
              {warningLevel && warningLevel !== "NONE" && (
                <WarningBadge level={warningLevel} />
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <FinancialLine label="Monthly Salary">BD {formatBDAmount(salary)}</FinancialLine>
              <FinancialLine label="Fixed Expenses" valueClass="text-red-500">
                − BD {formatBDAmount(totalExpenses)}
              </FinancialLine>
              <FinancialLine
                label="Disposable Income"
                valueClass={disposable <= 0 ? "text-red-500" : ""}
              >
                BD {formatBDAmount(disposable)}
              </FinancialLine>
              <FinancialLine label="Committed to Goals" valueClass="text-[#6b7c3f]">
                BD {formatBDAmount(totalCommitment)}
              </FinancialLine>
            </div>

            {/* Commitment progress bar */}
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                <span>
                  Saving {savingsRate != null ? `${savingsRate.toFixed(1)}% of disposable` : "—"}
                </span>
                <span className={`font-semibold ${availableToSave > 0 ? "text-[#6b7c3f]" : "text-red-500"}`}>
                  BD {formatBDAmount(availableToSave)} still allocatable
                </span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    warningLevel === "RED"
                      ? "bg-red-400"
                      : warningLevel === "AMBER"
                      ? "bg-amber-400"
                      : "bg-[#6b7c3f]"
                  }`}
                  style={{ width: `${Math.min((totalCommitment / Math.max(disposable, 1)) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-300 mt-1">
                <span>BD 0</span>
                <span>BD {formatBDAmount(disposable)} (disposable)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Sub-components (unchanged) ────────────────────────────────────────────────

const BackgroundRings = () => (
  <div className="absolute inset-0 opacity-10">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="absolute border border-white/30 rounded-full"
        style={{
          width:     `${(i + 1) * 200}px`,
          height:    `${(i + 1) * 200}px`,
          top:       "50%",
          right:     "-5%",
          transform: "translate(0, -50%)",
        }}
      />
    ))}
  </div>
);

const StatCard = ({ color, labelColor, label, border = "", textSize = "text-2xl", children }) => (
  <div className={`${color} rounded-2xl p-5 shadow-lg ${border}`}>
    <p className={`${labelColor} text-xs font-semibold uppercase tracking-wider mb-1`}>{label}</p>
    <p className={`text-white ${textSize} font-black leading-tight`}>{children}</p>
  </div>
);

const FinancialLine = ({ label, valueClass = "text-gray-900", children }) => (
  <div>
    <p className="text-xs text-gray-400 mb-0.5">{label}</p>
    <p className={`text-sm font-black ${valueClass}`}>{children}</p>
  </div>
);

const WarningBadge = ({ level }) => (
  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
    level === "RED" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
  }`}>
    {level === "RED" ? "⚠ Over budget" : "⚠ Ambitious savings rate"}
  </span>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
  </svg>
);
const ProjectionsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default GoalsHeader;