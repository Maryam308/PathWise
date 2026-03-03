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
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [mutating, setMutating] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchGoals = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);

      // Both calls go through the service layer — no fetch() here.
      // Expenses are non-fatal: if the call fails we keep an empty array
      // rather than breaking the whole page.
      const [goalsData, expensesData] = await Promise.all([
        goalService.getAll(token),
        goalService.getExpenses(token).catch(() => []),
      ]);

      setGoals(goalsData);
      setExpenses(expensesData);
    } catch (err) {
      setError(err.message || "Failed to load goals.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  // ── Derived: financial snapshot ───────────────────────────────────────────
  // The backend attaches disposableIncome / totalMonthlyCommitment to every
  // goal response (FinancialProfileService). We read it from the first goal,
  // or fall back to a client-side sum so GoalModal always has something to
  // work with even when no goals have been loaded yet.
  const financialSnapshot = (() => {
    const ref = goals[0];
    if (ref?.disposableIncome != null) {
      return {
        disposableIncome:       parseFloat(ref.disposableIncome       || 0),
        totalMonthlyCommitment: parseFloat(ref.totalMonthlyCommitment || 0),
        warningLevel:           ref.warningLevel   || "NONE",
        warningMessage:         ref.warningMessage || "",
      };
    }
    // Fallback: sum the goals we already have in memory
    const committed = goals.reduce(
      (acc, g) => acc + parseFloat(g.monthlySavingsTarget || 0),
      0
    );
    return {
      disposableIncome:       null,
      totalMonthlyCommitment: committed,
      warningLevel:           "NONE",
      warningMessage:         "",
    };
  })();

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