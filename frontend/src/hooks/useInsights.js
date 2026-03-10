// ─────────────────────────────────────────────────────────────────────────────
// hooks/useInsights.js
// Convenience hook that re-exports insights context with derived values.
// All components should import from this hook, never from InsightsContext directly.
// 
// Provides:
// - All context state and actions
// - Derived values (hasLinkedCard, primaryAccount, anomalyCount, initialLoading, currentMonthName)
// ─────────────────────────────────────────────────────────────────────────────

import { useInsightsContext } from "../context/InsightsContext.jsx";

/**
 * Custom hook that provides insights data with derived values.
 * @returns {Object} Insights context with additional computed properties
 */
export const useInsights = () => {
  const ctx = useInsightsContext();

  // Derived values
  const hasLinkedCard    = ctx.accounts.length > 0;
  const primaryAccount   = ctx.accounts[0] ?? null;
  const anomalyCount     = ctx.anomalies.length;
  const initialLoading   = ctx.analyticsLoading && ctx.accountsLoading;
  const currentMonthName = new Date().toLocaleString("en-GB", { month: "long" });

  return {
    ...ctx,
    hasLinkedCard,
    primaryAccount,
    anomalyCount,
    initialLoading,
    currentMonthName,
  };
};