/**
 * GoalsContext
 *
 * Manages all goal-related state for the app.
 * The context ONLY calls services — it never calls fetch() directly.
 * All HTTP logic lives in goalService.js.
 *
 * Provides:
 *   goals[]               – live goal list from backend
 *   expenses[]            – user's monthly expense categories (for SimulationModal)
 *   financialSnapshot     – disposable income, total committed, warning level
 *   maxAllocatable()      – how much the user can still allocate monthly
 *   createGoal()          – create + refresh
 *   updateGoal()          – update + refresh
 *   deleteGoal()          – delete + refresh
 *   refreshGoals()        – force a full re-fetch
 *   loading / error / mutating
 */

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext.jsx";
import { goalService } from "../services/goalService.js";

// ── Context ───────────────────────────────────────────────────────────────────
const GoalsContext = createContext(null);

// ── Provider ──────────────────────────────────────────────────────────────────
export const GoalsProvider = ({ children }) => {
  const { token } = useAuth();

  const [goals,    setGoals]    = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [financialSnapshot, setFinancialSnapshot] = useState({
    disposableIncome: 0,
    totalMonthlyCommitment: 0,
    monthlySalary: 0,
    totalMonthlyExpenses: 0,
    savingsRatePercent: null,
    warningLevel: "NONE",
    warningMessage: ""
  });
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [mutating, setMutating] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchGoals = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);

      // Fetch goals, expenses, and financial snapshot in parallel
      const [goalsData, expensesData, snapshotData] = await Promise.all([
        goalService.getAll(token).catch(() => []),
        goalService.getExpenses(token).catch(() => []),
        goalService.getFinancialSnapshot(token).catch(() => ({
          disposableIncome: 0,
          totalMonthlyCommitment: 0,
          monthlySalary: 0,
          totalMonthlyExpenses: 0,
          savingsRatePercent: null,
          warningLevel: "NONE",
          warningMessage: ""
        })),
      ]);

      setGoals(goalsData);
      setExpenses(expensesData);
      setFinancialSnapshot(snapshotData);
    } catch (err) {
      setError(err.message || "Failed to load goals.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  // ── Derived: max allocatable ──────────────────────────────────────────────
  // Pass `editingGoalMonthly` when editing an existing goal so its current
  // monthly target isn't counted twice against the cap.
  const maxAllocatable = (editingGoalMonthly = 0) => {
    const { disposableIncome, totalMonthlyCommitment } = financialSnapshot;
    if (disposableIncome == null) return null;
    return Math.max(
      0,
      disposableIncome - totalMonthlyCommitment + parseFloat(editingGoalMonthly || 0)
    );
  };

  // ── Mutations ─────────────────────────────────────────────────────────────
  // Pattern: optimistic local update → await service call → re-fetch to sync
  // all server-computed fields (status, warningLevel, totalMonthlyCommitment).

  const createGoal = useCallback(async (formData) => {
    setMutating(true);
    try {
      const created = await goalService.create(token, formData);
      setGoals((prev) => [created, ...prev]);
      await fetchGoals(); // re-sync server snapshot fields
      return created;
    } finally {
      setMutating(false);
    }
  }, [token, fetchGoals]);

  const updateGoal = useCallback(async (goalId, formData) => {
    setMutating(true);
    try {
      const updated = await goalService.update(token, goalId, formData);
      setGoals((prev) => prev.map((g) => g.id === goalId ? updated : g));
      await fetchGoals();
      return updated;
    } finally {
      setMutating(false);
    }
  }, [token, fetchGoals]);

  const deleteGoal = useCallback(async (goalId) => {
    setMutating(true);
    try {
      await goalService.remove(token, goalId);
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
      await fetchGoals();
    } finally {
      setMutating(false);
    }
  }, [token, fetchGoals]);

  // ── Context value ─────────────────────────────────────────────────────────
  const value = {
    // Data
    goals,
    expenses,
    financialSnapshot,
    maxAllocatable,
    // Status
    loading,
    error,
    mutating,
    // Actions
    refreshGoals: fetchGoals,
    createGoal,
    updateGoal,
    deleteGoal,
    // Escape hatch for rare direct state updates (e.g. projection modal)
    setGoals,
  };

  return <GoalsContext.Provider value={value}>{children}</GoalsContext.Provider>;
};

// ── Hook ──────────────────────────────────────────────────────────────────────
export const useGoals = () => {
  const ctx = useContext(GoalsContext);
  if (!ctx) throw new Error("useGoals must be used inside <GoalsProvider>");
  return ctx;
};