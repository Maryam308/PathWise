import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { goalService } from "../../services/goalService.js";
import Navbar from "../../components/common/Navbar.jsx";
import Footer from "../../components/common/Footer.jsx";
import GoalsHeader from "../../components/goals/GoalsHeader.jsx";
import GoalCard from "../../components/goals/GoalCard.jsx";
import GoalFilters from "../../components/goals/GoalFilters.jsx";
import GoalModal from "../../components/goals/GoalModal.jsx";
import ProjectionModal from "../../components/goals/ProjectionModal.jsx";
import SimulationModal from "../../components/goals/SimulationModal.jsx";
import AICoachWidget from "../../components/goals/AICoachWidget.jsx";

const ITEMS_PER_PAGE = 9;

const EmptyState = ({ filter, onNewGoal }) => (
  <div className="col-span-3 flex flex-col items-center justify-center py-20 text-center">
    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4 text-3xl">
      {filter === "COMPLETED" ? "🏆" : filter === "AT_RISK" ? "⚠️" : "🎯"}
    </div>
    <h3 className="text-lg font-bold text-gray-700 mb-1">
      {filter === "ALL" ? "No goals yet" : `No ${filter.toLowerCase().replace(/_/g, " ")} goals`}
    </h3>
    <p className="text-sm text-gray-400 max-w-xs mb-5">
      {filter === "ALL"
        ? "Create your first financial goal and start tracking your path to financial freedom."
        : "Goals matching this filter will appear here."}
    </p>
    {filter === "ALL" && (
      <button onClick={onNewGoal}
        className="flex items-center gap-2 px-5 py-2.5 bg-[#6b7c3f] hover:bg-[#5a6a33] text-white text-sm font-bold rounded-xl transition-all">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
        </svg>
        Create your first goal
      </button>
    )}
  </div>
);

const GoalsPage = () => {
  const { token } = useAuth();

  // ── Data ──────────────────────────────────────────────────────────────────
  const [goals, setGoals]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [page, setPage]                 = useState(1);

  // ── Goal modal (create / edit) ────────────────────────────────────────────
  const [goalModalOpen, setGoalModalOpen]   = useState(false);
  const [editingGoal, setEditingGoal]       = useState(null);
  const [goalModalLoading, setGoalModalLoading] = useState(false);
  const [goalModalError, setGoalModalError]     = useState(null);

  // ── Delete confirm ────────────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState(null); // goalId | null

  // ── Projection modal ──────────────────────────────────────────────────────
  const [projectionGoal, setProjectionGoal] = useState(null);

  // ── Simulation modal ──────────────────────────────────────────────────────
  const [simulationGoal, setSimulationGoal] = useState(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchGoals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await goalService.getAll(token);
      setGoals(data);
    } catch (err) {
      setError("Failed to load goals. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  // ── Filter / paginate ─────────────────────────────────────────────────────
  const filteredGoals = (() => {
    switch (activeFilter) {
      case "ON_TRACK":    return goals.filter((g) => g.status === "ON_TRACK");
      case "AT_RISK":     return goals.filter((g) => g.status === "AT_RISK");
      case "COMPLETED":   return goals.filter((g) => g.status === "COMPLETED");
      case "BY_DEADLINE": return [...goals].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
      case "HIGH_PRIORITY": return goals.filter((g) => g.priority === "HIGH");
      default:            return goals;
    }
  })();

  const goalCounts = {
    ALL:          goals.length,
    ON_TRACK:     goals.filter((g) => g.status === "ON_TRACK").length,
    AT_RISK:      goals.filter((g) => g.status === "AT_RISK").length,
    COMPLETED:    goals.filter((g) => g.status === "COMPLETED").length,
    HIGH_PRIORITY:goals.filter((g) => g.priority === "HIGH").length,
  };

  const totalPages   = Math.max(1, Math.ceil(filteredGoals.length / ITEMS_PER_PAGE));
  const paginatedGoals = filteredGoals.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleFilterChange = (f) => { setActiveFilter(f); setPage(1); };

  // ── Goal CRUD handlers ────────────────────────────────────────────────────
  const openCreateModal = () => { setEditingGoal(null); setGoalModalError(null); setGoalModalOpen(true); };
  const openEditModal   = (goal) => { setEditingGoal(goal); setGoalModalError(null); setGoalModalOpen(true); };

  const handleGoalSubmit = async (formData) => {
    setGoalModalLoading(true);
    setGoalModalError(null);
    try {
      if (editingGoal) {
        const updated = await goalService.update(token, editingGoal.id, formData);
        setGoals((prev) => prev.map((g) => (g.id === editingGoal.id ? updated : g)));
      } else {
        const created = await goalService.create(token, formData);
        setGoals((prev) => [created, ...prev]);
      }
      setGoalModalOpen(false);
    } catch (err) {
      setGoalModalError(err.message || "Something went wrong");
    } finally {
      setGoalModalLoading(false);
    }
  };

  const handleDelete = async (goalId) => {
    try {
      await goalService.remove(token, goalId);
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
    } catch {
      setError("Failed to delete goal.");
    }
    setDeleteConfirm(null);
  };

  // After projection saves, refresh goal so the new monthlySavingsTarget appears
  const handleProjectionSaved = (projectionResult) => {
    setGoals((prev) =>
      prev.map((g) =>
        g.id === projectionResult.goalId
          ? { ...g, monthlySavingsTarget: projectionResult.monthlySavingsTarget, status: projectionResult.isOnTrack ? "ON_TRACK" : "AT_RISK" }
          : g
      )
    );
  };

  // ── Pagination helper ─────────────────────────────────────────────────────
  const pageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 3) return [1, 2, 3, "...", totalPages - 1, totalPages];
    if (page >= totalPages - 2) return [1, 2, "...", totalPages - 2, totalPages - 1, totalPages];
    return [1, "...", page - 1, page, page + 1, "...", totalPages];
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 pt-[64px]">
        <GoalsHeader
          goals={goals}
          onNewGoal={openCreateModal}
          onViewProjections={() => {}}
        />

        <div className="max-w-6xl mx-auto px-6 py-10">
          {/* Heading + filters */}
          <div className="flex flex-col gap-4 mb-8">
            <h2 className="text-3xl font-black text-gray-900">My Goals</h2>
            <GoalFilters activeFilter={activeFilter} onFilterChange={handleFilterChange} goalCounts={goalCounts} />
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-sm text-red-600 font-medium">{error}</p>
              <button onClick={fetchGoals} className="ml-auto text-xs text-red-500 underline font-semibold">Retry</button>
            </div>
          )}

          {/* Goal grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                  <div className="flex gap-3 mb-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl" />
                    <div className="flex-1"><div className="h-4 bg-gray-100 rounded mb-2 w-3/4" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div>
                  </div>
                  <div className="h-8 bg-gray-100 rounded mb-3" />
                  <div className="h-2 bg-gray-100 rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedGoals.length === 0 ? (
                <EmptyState filter={activeFilter} onNewGoal={openCreateModal} />
              ) : (
                paginatedGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onEdit={openEditModal}
                    onDelete={(id) => setDeleteConfirm(id)}
                    onProjection={(g) => setProjectionGoal(g)}
                    onSimulation={(g) => setSimulationGoal(g)}
                  />
                ))
              )}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-10">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              {pageNumbers().map((p, i) =>
                p === "..." ? (
                  <span key={`dot-${i}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-sm">…</span>
                ) : (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-semibold transition-all ${page === p ? "bg-[#2c3347] text-white shadow-sm" : "text-gray-500 hover:bg-gray-100"}`}>
                    {p}
                  </button>
                )
              )}
              <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {/* Create / Edit goal */}
      <GoalModal
        isOpen={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        onSubmit={handleGoalSubmit}
        editingGoal={editingGoal}
        loading={goalModalLoading}
        serverError={goalModalError}
      />

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
              </svg>
            </div>
            <h3 className="text-lg font-black text-gray-900 text-center mb-1">Delete goal?</h3>
            <p className="text-sm text-gray-400 text-center mb-6">This action cannot be undone. All progress will be lost.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 text-sm transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Projection */}
      {projectionGoal && (
        <ProjectionModal
          goal={projectionGoal}
          onClose={() => setProjectionGoal(null)}
          onSaved={(result) => {
            handleProjectionSaved(result);
            setProjectionGoal(null);
          }}
        />
      )}

      {/* Simulation */}
      {simulationGoal && (
        <SimulationModal
          goal={simulationGoal}
          onClose={() => setSimulationGoal(null)}
        />
      )}

      {/* AI Coach */}
      <AICoachWidget />
    </div>
  );
};

export default GoalsPage;