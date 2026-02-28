import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";

import Navbar from "../components/common/Navbar.jsx";
import GoalCard from "../components/dashboard/GoalCard.jsx";
import GoalForm from "../components/dashboard/GoalForm.jsx";
import ProjectionModal from "../components/dashboard/ProjectionModal.jsx";
import SimulationModal from "../components/dashboard/SimulationModal.jsx";
import DeleteConfirm from "../components/dashboard/DeleteConfirm.jsx";
import SnapshotCard from "../components/dashboard/SnapshotCard.jsx";
import WarningBanner from "../components/dashboard/WarningBanner.jsx";
import AICoach from "../components/dashboard/AICoach.jsx";
import Modal from "../components/ui/Modal.jsx";

import { goalService, profileService } from "../services/authService.js";
import { fmt, pctFmt } from "../utils/dashboardConstants.js";

const Dashboard = () => {
  const { user, token } = useAuth();

  const [goals, setGoals]     = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("goals");

  // Modal state
  const [showCreate,     setShowCreate]     = useState(false);
  const [editingGoal,    setEditingGoal]    = useState(null);
  const [projectionGoal, setProjectionGoal] = useState(null);
  const [simulationGoal, setSimulationGoal] = useState(null);
  const [deleteTarget,   setDeleteTarget]   = useState(null);
  const [formLoading,    setFormLoading]    = useState(false);
  const [formError,      setFormError]      = useState("");

  const refreshProfile = async () => {
    try { setProfile(await profileService.getProfile(token)); } catch (_) {}
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [g, p] = await Promise.all([
          goalService.getAll(token),
          profileService.getProfile(token),
        ]);
        setGoals(g);
        setProfile(p);
      } catch (e) { console.error("Dashboard load error:", e); }
      finally { setLoading(false); }
    };
    load();
  }, [token]);

  const handleCreate = async (data) => {
    setFormLoading(true); setFormError("");
    try {
      const g = await goalService.create(token, data);
      setGoals((prev) => [g, ...prev]);
      setShowCreate(false);
      await refreshProfile();
    } catch (e) { setFormError(e.message); }
    finally { setFormLoading(false); }
  };

  const handleUpdate = async (data) => {
    setFormLoading(true); setFormError("");
    try {
      const g = await goalService.update(token, editingGoal.id, data);
      setGoals((prev) => prev.map((x) => x.id === g.id ? g : x));
      setEditingGoal(null);
      await refreshProfile();
    } catch (e) { setFormError(e.message); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async () => {
    try {
      await goalService.remove(token, deleteTarget.id);
      setGoals((prev) => prev.filter((g) => g.id !== deleteTarget.id));
      setDeleteTarget(null);
      await refreshProfile();
    } catch (e) { alert(e.message); }
  };

  const snap = profile?.financialSnapshot;
  const firstName = user?.fullName?.split(" ")[0] || "";

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-16">

        {/* Page header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900">
              Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {firstName} 👋
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">Here's your financial overview</p>
          </div>
          <button onClick={() => { setFormError(""); setShowCreate(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#6b7c3f] text-white font-bold rounded-xl
              hover:bg-[#5a6a33] transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 text-sm">
            + New Goal
          </button>
        </div>

        {/* Financial warning */}
        {snap?.warningLevel && snap.warningLevel !== "NONE" && (
          <div className="mb-5">
            <WarningBanner level={snap.warningLevel} message={snap.warningMessage} />
          </div>
        )}

        {/* Snapshot cards */}
        {snap && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <SnapshotCard label="Monthly Salary" value={fmt(profile?.monthlySalary)} />
            <SnapshotCard label="Disposable Income" value={fmt(snap.disposableIncome)}
              sub="Salary − fixed expenses" highlight
              accent={parseFloat(snap.disposableIncome) < 0 ? "text-red-600" : undefined} />
            <SnapshotCard label="Monthly Committed" value={fmt(snap.totalMonthlySavings)}
              sub="Across all goals" />
            <SnapshotCard label="Savings Rate" value={pctFmt(snap.savingsRatePercent)}
              sub="Of disposable income" />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white border border-gray-100 rounded-xl p-1 w-fit shadow-sm">
          {[["goals", "🎯 Goals"], ["coach", "🤖 AI Coach"]].map(([k, label]) => (
            <button key={k} onClick={() => setActiveTab(k)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all
                ${activeTab === k ? "bg-[#6b7c3f] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Goals tab */}
        {activeTab === "goals" && (
          <div>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1,2,3].map((i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                    <div className="h-4 bg-gray-100 rounded w-2/3 mb-3" />
                    <div className="h-2 bg-gray-100 rounded mb-2" />
                    <div className="h-2 bg-gray-100 rounded w-3/4 mb-4" />
                    <div className="h-8 bg-gray-100 rounded" />
                  </div>
                ))}
              </div>
            ) : goals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-16 h-16 bg-[#f5f7f0] rounded-full flex items-center justify-center text-3xl">🎯</div>
                <div className="text-center">
                  <p className="text-gray-700 font-semibold">No goals yet</p>
                  <p className="text-gray-400 text-sm mt-1">Create your first financial goal to get started</p>
                </div>
                <button onClick={() => { setFormError(""); setShowCreate(true); }}
                  className="px-6 py-3 bg-[#6b7c3f] text-white font-bold rounded-xl hover:bg-[#5a6a33] shadow-sm transition-all">
                  Create a Goal
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {goals.map((g) => (
                  <GoalCard key={g.id} goal={g}
                    onProjection={setProjectionGoal}
                    onSimulation={setSimulationGoal}
                    onEdit={(g) => { setFormError(""); setEditingGoal(g); }}
                    onDelete={setDeleteTarget} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* AI Coach tab */}
        {activeTab === "coach" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col"
            style={{ height: "600px" }}>
            <AICoach token={token} />
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showCreate && (
        <Modal title="New Goal" onClose={() => setShowCreate(false)}>
          <GoalForm onSubmit={handleCreate} onClose={() => setShowCreate(false)}
            loading={formLoading} error={formError} />
        </Modal>
      )}

      {editingGoal && (
        <Modal title="Edit Goal" onClose={() => setEditingGoal(null)}>
          <GoalForm initial={editingGoal} onSubmit={handleUpdate} onClose={() => setEditingGoal(null)}
            loading={formLoading} error={formError} />
        </Modal>
      )}

      {projectionGoal && (
        <ProjectionModal goal={projectionGoal} token={token} onClose={() => setProjectionGoal(null)} />
      )}

      {simulationGoal && (
        <SimulationModal goal={simulationGoal} token={token} onClose={() => setSimulationGoal(null)} />
      )}

      {deleteTarget && (
        <DeleteConfirm goal={deleteTarget} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
      )}
    </div>
  );
};

export default Dashboard;