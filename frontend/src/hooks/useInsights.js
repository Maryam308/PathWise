// ─────────────────────────────────────────────────────────────────────────────
// hooks/useInsights.js
// All components import this — never import InsightsContext directly.
// ─────────────────────────────────────────────────────────────────────────────

import { useInsightsContext } from "../context/InsightsContext.jsx";

export const useInsights = () => {
  const ctx = useInsightsContext();

  // Derived values ─────────────────────────────────────────────────────────
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