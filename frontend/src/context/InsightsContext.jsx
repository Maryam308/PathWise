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

  // ── SYNC FUNCTION ─────────────────────────────────────────────────────────
  const syncTransactions = useCallback(async () => {
    if (!token) return;
    try {
      await insightsService.syncTransactions(token);
      await Promise.all([
        fetchTransactions({ page: 0 }),
        fetchAnalytics(1),
        fetchAnomalies()
      ]);
      console.log("✅ Transactions synced");
    } catch (err) { 
      console.error("Sync failed:", err.message); 
    }
  }, [token, fetchTransactions, fetchAnalytics, fetchAnomalies]);

  // ── ON PAGE LOAD - Load all data ──────────────────────────────────────────
  useEffect(() => {
    if (!token) return;

    const loadInitialData = async () => {
      await Promise.all([
        fetchAnalytics(1),
        fetchAnomalies(),
        fetchReports(),
        fetchAccounts(),
        fetchTransactions({ page: 0 })
      ]);
    };
    
    loadInitialData();
  }, [token, fetchAnalytics, fetchAnomalies, fetchReports, fetchAccounts, fetchTransactions]);

  // ── SMART SYNC when user returns to tab after 5+ minutes ───────────────────
  useEffect(() => {
    if (!token) return;

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const lastSync = localStorage.getItem('lastTransactionSync');
        const now = Date.now();
        
        if (!lastSync || now - parseInt(lastSync) > 5 * 60 * 1000) {
          syncTransactions();
          localStorage.setItem('lastTransactionSync', now.toString());
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token, syncTransactions]);

  // ── dismissAnomaly ─────────────────────────────────────────────────────────
  const dismissAnomaly = useCallback(async (id) => {
    try {
      await insightsService.dismissAnomaly(token, id);
      setAnomalies((prev) => prev.filter((a) => a.id !== id));
    } catch (err) { 
      console.error("dismissAnomaly:", err.message); 
    }
  }, [token]);

  // ── linkCard ───────────────────────────────────────────────────────────────
  const linkCard = useCallback(async (cardData) => {
    const result = await insightsService.linkCard(token, cardData);
    await fetchAccounts();
    await fetchTransactions({ page: 0 });
    return result;
  }, [token, fetchAccounts, fetchTransactions]);

  // ===== FIXED: Derived values with safe checks =====
  // Calculate these BEFORE using them in value object
  const hasLinkedCard = Array.isArray(accounts) ? accounts.length > 0 : false;
  const primaryAccount = Array.isArray(accounts) && accounts.length > 0 ? accounts[0] : null;
  const currentMonthName = new Date().toLocaleString("en-GB", { month: "long" });

  // ===== Value object =====
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
    
    // Actions
    fetchAnalytics,
    fetchTransactions,
    fetchAnomalies,
    fetchReports,
    fetchAccounts,
    dismissAnomaly,
    linkCard,
    syncTransactions,
    
    // Derived (now safely defined above)
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