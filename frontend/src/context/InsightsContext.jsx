import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useAuth } from "./AuthContext.jsx";
import { insightsService } from "../services/insightsService.js";
import { TRANSACTIONS_PER_PAGE } from "../constants/insights.js";

const InsightsContext = createContext(null);

export const InsightsProvider = ({ children }) => {
  const { token } = useAuth();

  // ── Analytics ──────────────────────────────────────────────────────────────
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState(null);

  // ── Transactions (paginated) ───────────────────────────────────────────────
  const [transactions, setTransactions] = useState([]);
  const [transactionsMeta, setTransactionsMeta] = useState({ 
    totalPages: 0, 
    totalElements: 0, 
    number: 0,
    size: TRANSACTIONS_PER_PAGE 
  });
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState(null);

  // ── Anomalies ──────────────────────────────────────────────────────────────
  const [anomalies, setAnomalies] = useState([]);
  const [anomaliesLoading, setAnomaliesLoading] = useState(true);

  // ── Reports ────────────────────────────────────────────────────────────────
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);

  // ── Accounts ───────────────────────────────────────────────────────────────
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // ── fetchAnalytics ─────────────────────────────────────────────────────────
  const fetchAnalytics = useCallback(async (months = 1) => {
    if (!token) return;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const data = await insightsService.getAnalytics(token, months);
      setAnalytics(data);
    } catch (err) {
      setAnalyticsError(err.message || "Failed to load analytics");
    } finally {
      setAnalyticsLoading(false);
    }
  }, [token]);

  // ── fetchTransactions ──────────────────────────────────────────────────────
  const fetchTransactions = useCallback(async (params = {}) => {
    if (!token) return;
    setTransactionsLoading(true);
    setTransactionsError(null);
    try {
      // Request with pagination, search, category, and sort params
      const data = await insightsService.getTransactions(token, { 
        size: TRANSACTIONS_PER_PAGE, 
        ...params 
      });
      
      if (Array.isArray(data)) {
        setTransactions(data);
        setTransactionsMeta({ 
          totalPages: 1, 
          totalElements: data.length, 
          number: 0,
          size: data.length
        });
      } else {
        setTransactions(data.content || []);
        setTransactionsMeta({
          totalPages: data.totalPages ?? 1,
          totalElements: data.totalElements ?? 0,
          number: data.number ?? 0,
          size: data.size ?? TRANSACTIONS_PER_PAGE,
        });
      }
    } catch (err) {
      setTransactionsError(err.message || "Failed to load transactions");
      setTransactions([]);
      setTransactionsMeta({ 
        totalPages: 0, 
        totalElements: 0, 
        number: 0, 
        size: TRANSACTIONS_PER_PAGE 
      });
    } finally {
      setTransactionsLoading(false);
    }
  }, [token]);

  // ── fetchAnomalies ─────────────────────────────────────────────────────────
  const fetchAnomalies = useCallback(async () => {
    if (!token) return;
    setAnomaliesLoading(true);
    try {
      const data = await insightsService.getAnomalies(token);
      setAnomalies(Array.isArray(data) ? data.filter((a) => !a.isDismissed) : []);
    } catch { 
      setAnomalies([]); 
    } finally { 
      setAnomaliesLoading(false); 
    }
  }, [token]);

  // ── fetchReports ───────────────────────────────────────────────────────────
  const fetchReports = useCallback(async () => {
    if (!token) return;
    setReportsLoading(true);
    try {
      const data = await insightsService.getReports(token);
      setReports(Array.isArray(data) ? data : []);
    } catch { 
      setReports([]); 
    } finally { 
      setReportsLoading(false); 
    }
  }, [token]);

  // ── fetchAccounts ──────────────────────────────────────────────────────────
  const fetchAccounts = useCallback(async () => {
    if (!token) return;
    setAccountsLoading(true);
    try {
      const data = await insightsService.getAccounts(token);
      setAccounts(Array.isArray(data) ? data : []);
    } catch { 
      setAccounts([]); 
    } finally { 
      setAccountsLoading(false); 
    }
  }, [token]);

  // ── Initial parallel load ──────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    
    const loadInitialData = async () => {
      await Promise.all([
        fetchAnalytics(1),
        fetchAnomalies(),
        fetchReports(),
        fetchAccounts()
      ]);
    };
    
    loadInitialData();
  }, [token, fetchAnalytics, fetchAnomalies, fetchReports, fetchAccounts]);

  // ── dismissAnomaly ─────────────────────────────────────────────────────────
  const dismissAnomaly = useCallback(async (id) => {
    try {
      await insightsService.dismissAnomaly(token, id);
      setAnomalies((prev) => prev.filter((a) => a.id !== id));
    } catch (err) { 
      console.error("dismissAnomaly:", err.message); 
    }
  }, [token]);

  // ── syncTransactions ───────────────────────────────────────────────────────
  const syncTransactions = useCallback(async () => {
    setSyncing(true);
    try {
      await insightsService.syncTransactions(token);
      await Promise.all([
        fetchTransactions({ page: 0 }), 
        fetchAnalytics(1)
      ]);
    } catch (err) { 
      console.error("sync:", err.message); 
    } finally { 
      setSyncing(false); 
    }
  }, [token, fetchTransactions, fetchAnalytics]);

  // ── linkCard — throws so component can show error ─────────────────────────
  const linkCard = useCallback(async (cardData) => {
    const result = await insightsService.linkCard(token, cardData);
    await fetchAccounts();
    try {
      await insightsService.syncTransactions(token);
      await Promise.all([
        fetchTransactions({ page: 0 }), 
        fetchAnalytics(1)
      ]);
    } catch { 
      /* non-fatal */ 
    }
    return result;
  }, [token, fetchAccounts, fetchTransactions, fetchAnalytics]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const hasLinkedCard = accounts.length > 0;
  const primaryAccount = accounts[0] ?? null;
  const currentMonthName = new Date().toLocaleString("en-GB", { month: "long" });

  const value = {
    // State
    analytics, 
    analyticsLoading, 
    analyticsError,
    transactions, 
    transactionsMeta, 
    transactionsLoading, 
    transactionsError,
    anomalies, 
    anomaliesLoading,
    reports, 
    reportsLoading,
    accounts, 
    accountsLoading,
    syncing,
    
    // Actions
    fetchAnalytics,
    fetchTransactions,
    fetchAnomalies,
    fetchReports,
    fetchAccounts,
    dismissAnomaly,
    syncTransactions,
    linkCard,
    
    // Derived
    hasLinkedCard,
    primaryAccount,
    currentMonthName,
  };

  return <InsightsContext.Provider value={value}>{children}</InsightsContext.Provider>;
};

export const useInsightsContext = () => {
  const ctx = useContext(InsightsContext);
  if (!ctx) throw new Error("useInsightsContext must be used inside <InsightsProvider>");
  return ctx;
};