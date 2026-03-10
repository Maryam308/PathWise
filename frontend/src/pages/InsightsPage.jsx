import { useState, useEffect } from "react";
import { useInsights } from "../hooks/useInsights.js";
import { useAuth } from "../context/AuthContext.jsx";
import { insightsService } from "../services/insightsService.js";
import Navbar from "../components/common/Navbar.jsx";
import Footer from "../components/common/Footer.jsx";
import { Spinner } from "../components/ui/primitives.jsx";
import { formatBD, formatBDAmount } from "../utils/formatters.js";
import { formatReportDate } from "../utils/insightsUtils.js";
import { PIE_COLORS, ANOMALY_SEVERITY, ANALYTICS_RANGES } from "../constants/insights.js";

// Recharts imports
import {
  PieChart as RePieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

// ─────────────────────────────────────────────────────────────────────────────
// Pie Chart using Recharts with enhanced empty state
// ─────────────────────────────────────────────────────────────────────────────
const PieChart = ({ data, months, currentMonthName }) => {
  const [activeIndex, setActiveIndex] = useState(null);

  const chartData = Object.entries(data || {})
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({
      name,
      value: parseFloat(value)
    }));

  // Enhanced empty state with contextual message
  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48">
        <p className="text-3xl mb-2">📊</p>
        <p className="text-sm text-gray-400">
          {months === 1 
            ? `No spending in ${currentMonthName}` 
            : `No spending in the last ${months} months`}
        </p>
        <p className="text-xs text-gray-300 mt-1">
          {months === 1 
            ? "Transactions will appear here when you make purchases" 
            : "Try selecting a different time range or add transactions"}
        </p>
      </div>
    );
  }

  const onPieEnter = (_, index) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(null);
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-100">
          <p className="text-sm font-semibold text-gray-800">{payload[0].name}</p>
          <p className="text-sm text-gray-600">{formatBD(payload[0].value)}</p>
          <p className="text-xs text-gray-400">{payload[0].payload.percent}%</p>
        </div>
      );
    }
    return null;
  };

  // Calculate percentages
  const total = chartData.reduce((sum, item) => sum + item.value, 0);
  const dataWithPercent = chartData.map(item => ({
    ...item,
    percent: ((item.value / total) * 100).toFixed(1)
  }));

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <RePieChart>
          <Pie
            data={dataWithPercent}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            onMouseEnter={onPieEnter}
            onMouseLeave={onPieLeave}
          >
            {dataWithPercent.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={PIE_COLORS[index % PIE_COLORS.length]}
                stroke={activeIndex === index ? '#fff' : 'none'}
                strokeWidth={activeIndex === index ? 2 : 0}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            layout="vertical" 
            align="right"
            verticalAlign="middle"
            formatter={(value, entry) => (
              <span className="text-sm text-gray-700">{value}</span>
            )}
          />
        </RePieChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Monthly Bar Chart using Recharts with horizontal scroll
// ─────────────────────────────────────────────────────────────────────────────
const MonthlyBarChart = ({ data, months, onMonthsChange }) => {
  const [showMonths, setShowMonths] = useState(months || 6);
  
  if (!data?.length) {
    return <div className="flex items-center justify-center h-64"><p className="text-sm text-gray-400">No data yet</p></div>;
  }
  
  // Sort and filter data
  const sortedData = [...data].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const displayData = sortedData.slice(-showMonths).map(item => ({
    month: item.month,
    income: parseFloat(item.income || 0),
    expenses: parseFloat(item.expenses || 0),
    savingsRate: item.savingsRate || 0
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-100">
          <p className="text-sm font-semibold text-gray-800 mb-1">{label}</p>
          <p className="text-sm text-emerald-600">Income: {formatBD(payload[0].value)}</p>
          <p className="text-sm text-red-500">Expenses: {formatBD(payload[1].value)}</p>
          <p className="text-xs text-gray-400 mt-1">Savings Rate: {payload[0].payload.savingsRate}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-800">Monthly Income vs Expenses</h3>
        <div className="flex gap-2">
          <button 
            onClick={() => { setShowMonths(6); onMonthsChange(6); }}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              showMonths === 6 ? "bg-[#2c3347] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}>
            Current Month
          </button>
          <button 
            onClick={() => { setShowMonths(12); onMonthsChange(12); }}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              showMonths === 12 ? "bg-[#2c3347] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}>
            12 Months
          </button>
        </div>
      </div>

      <div className="w-full overflow-x-auto pb-4">
        <div style={{ minWidth: `${Math.max(600, displayData.length * 70)}px` }}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={displayData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              barGap={8}
              barSize={24}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickFormatter={(value) => formatBDAmount(value)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                formatter={(value) => value === 'income' ? 'Income' : 'Expenses'}
              />
              <Bar dataKey="income" fill="#a3b46a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="#2c3347" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Scroll indicator */}
      {displayData.length > 8 && (
        <div className="flex justify-center mt-2 text-xs text-gray-400">
          <span className="px-2 py-1 bg-gray-50 rounded">← Scroll horizontally for more months →</span>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Anomalies Section
// ─────────────────────────────────────────────────────────────────────────────
const AnomaliesSection = ({ anomalies, onDismiss }) => {
  if (!anomalies || anomalies.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-bold text-gray-800 mb-4">Spending Anomalies</h3>
        <div className="flex flex-col items-center justify-center py-8">
          <p className="text-3xl mb-2">✅</p>
          <p className="text-sm text-gray-400">No anomalies detected</p>
          <p className="text-xs text-gray-300 mt-1">Your spending patterns look normal</p>
        </div>
      </div>
    );
  }

  // Severity colors: HIGH=red, MEDIUM=yellow, LOW=green
  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'HIGH': return 'bg-red-50 border-red-200 text-red-700';
      case 'MEDIUM': return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      case 'LOW': return 'bg-green-50 border-green-200 text-green-700';
      default: return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  const getSeverityIcon = (severity) => {
    switch(severity) {
      case 'HIGH': return '🔴';
      case 'MEDIUM': return '🟡';
      case 'LOW': return '🟢';
      default: return '⚪';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h3 className="text-sm font-bold text-gray-800 mb-4">Spending Anomalies</h3>
      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
        {anomalies.map((anomaly) => {
          const severityColor = getSeverityColor(anomaly.severity);
          const severityIcon = getSeverityIcon(anomaly.severity);
          const date = new Date(anomaly.createdAt).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric'
          });

          return (
            <div key={anomaly.id} className={`p-4 rounded-xl border ${severityColor} relative`}>
              <button 
                onClick={() => onDismiss(anomaly.id)}
                className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors opacity-50 hover:opacity-100 text-sm"
              >
                ✕
              </button>
              <div className="flex items-start gap-2">
                <span className="text-lg">{severityIcon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded-full bg-white/50">
                      {anomaly.severity}
                    </span>
                    <span className="text-xs opacity-60">{date}</span>
                  </div>
                  <p className="text-sm font-medium mb-1">{anomaly.category}</p>
                  <p className="text-sm leading-relaxed">{anomaly.message}</p>
                  <div className="flex gap-4 mt-2 text-xs">
                    <span>Actual: {formatBD(anomaly.actualAmount)}</span>
                    <span>Average: {formatBD(anomaly.baselineAmount)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, bg, labelCn, sub }) => (
  <div className={`${bg} rounded-2xl p-5 shadow-lg`}>
    <p className={`${labelCn} text-xs font-semibold uppercase tracking-wider mb-1`}>{label}</p>
    <p className="text-white text-xl font-black">{value}</p>
    {sub && <p className="text-white/40 text-[10px] mt-1">{sub}</p>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Reports Modal
// ─────────────────────────────────────────────────────────────────────────────
const ReportsModal = ({ reports, loading, token, onClose, onViewReport, hasLinkedCard }) => {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!hasLinkedCard) {
      alert('Please link a card first to generate reports');
      return;
    }
    setGenerating(true);
    try {
      const report = await insightsService.generateReport(token);
      onViewReport(report);
      onClose();
    } catch (err) { console.error(err); }
    finally { setGenerating(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-black text-gray-900">Financial Reports</h3>
            <p className="text-xs text-gray-400 mt-0.5">AI-generated monthly summaries</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
          <button 
            onClick={handleGenerate} 
            disabled={generating || !hasLinkedCard}
            className={`w-full py-2.5 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 ${
              hasLinkedCard 
                ? 'bg-[#2c3347] hover:bg-[#3d4357]' 
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {generating ? <><Spinner size="sm" /> Generating…</> : 
             hasLinkedCard ? '✨ Generate New Report' : '🔒 Link card to generate reports'}
          </button>
          {loading ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)
            : reports.length === 0 ? <div className="py-10 text-center"><p className="text-3xl mb-2">📋</p><p className="text-sm text-gray-400">No reports yet.</p></div>
            : reports.map((r) => (
                <button key={r.id} onClick={() => { onViewReport(r); onClose(); }}
                  className="flex items-center justify-between gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl text-left w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-[#6b7c3f]/10 rounded-lg flex items-center justify-center text-base">📊</div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{r.title || "Monthly Report"}</p>
                      <p className="text-xs text-gray-400">{formatReportDate(r.createdAt)}</p>
                    </div>
                  </div>
                  <span className="text-gray-300 text-sm">›</span>
                </button>
              ))}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Report Inline
// ─────────────────────────────────────────────────────────────────────────────
const ReportInline = ({ report, loading, hasLinkedCard }) => {
  if (loading) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex items-center justify-center gap-3">
      <Spinner color="#6b7c3f" /><span className="text-sm text-gray-400">Loading report…</span>
    </div>
  );
  
  if (!hasLinkedCard) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        <p className="text-3xl mb-2">💳</p>
        <p className="text-sm text-gray-400">Link a card in Profile → My Card to generate reports</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 min-h-[80px]">
      {report ? (
        <>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900">{report.title || "Monthly Report"}</h3>
            <span className="text-xs text-gray-400">{formatReportDate(report.createdAt)}</span>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{report.content || "No content available."}</p>
        </>
      ) : (
        <p className="text-xs text-gray-300 text-center py-4">
          Generate a report or select one from "View Reports" to see it here.
        </p>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
const InsightsPage = () => {
  const { token } = useAuth();
  const {
    analytics, analyticsLoading, analyticsError,
    anomalies, anomaliesLoading,
    reports, reportsLoading,
    hasLinkedCard,
    dismissAnomaly, fetchAnalytics, fetchReports,
    currentMonthName,
  } = useInsights();

  const [months, setMonths] = useState(6);
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [activeReport, setActiveReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const monthlyBreakdown = (analytics?.monthlyBreakdown || []).map((d) => ({
    month: d.month,
    sortKey: d.sortKey,
    income: d.income || 0,
    expenses: d.expenses || 0,
    savingsRate: d.savingsRate || 0,
  }));

  const handleViewReport = async (r) => {
    if (r?.content) { setActiveReport(r); return; }
    setReportLoading(true);
    try { setActiveReport(await insightsService.getReport(token, r.id)); }
    catch (err) { console.error(err); }
    finally { setReportLoading(false); }
  };

  useEffect(() => {
    if (reports.length > 0 && !activeReport) handleViewReport(reports[0]);
  }, [reports]);

  const handleRangeChange = (m) => {
    setMonths(m);
    fetchAnalytics(m);
  };

  const pieLabel = months === 1 ? `${currentMonthName} Spending` : `Spending (last ${months} months)`;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-1 pt-[64px]">
        {/* Hero banner */}
        <div className="bg-[#2c3347] relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="absolute border border-white/30 rounded-full"
                style={{ width: `${(i + 1) * 180}px`, height: `${(i + 1) * 180}px`, top: "50%", right: "-3%", transform: "translate(0,-50%)" }} />
            ))}
          </div>
          <div className="relative z-10 max-w-6xl mx-auto px-6 py-10 lg:py-14">
            <p className="text-[#a3b46a] text-xs font-semibold uppercase tracking-widest mb-3">Life Milestone Planner</p>
            <h1 className="text-3xl lg:text-4xl font-black text-white leading-tight">
              Your Path to <span className="text-[#a3b46a]">Financial Freedom</span>
            </h1>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-6">
          {/* Stat cards */}
          {analyticsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-200 rounded-2xl animate-pulse" />)}
            </div>
          ) : analytics ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard 
                label="Account Balance" 
                value={`${formatBDAmount(analytics.totalBalance)} BHD`}
                bg="bg-[#6b7c3f]" 
                labelCn="text-[#c5d48a]" 
                sub="Plaid balance + all income" 
              />
              <StatCard 
                label="Monthly Spending" 
                value={`${formatBDAmount(analytics.totalExpenses)} BHD`}
                bg="bg-[#3d4357]" 
                labelCn="text-gray-400" 
                sub="This month only" 
              />
              <StatCard 
                label="Monthly Income" 
                value={`${formatBDAmount(analytics.totalIncome)} BHD`}
                bg="bg-[#2c3347]" 
                labelCn="text-gray-400" 
                sub="Salary + this month's credits" 
              />
            </div>
          ) : analyticsError ? (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700 font-medium">
              ⚠️ {analyticsError} — Link a card in Profile → My Card to get started.
            </div>
          ) : null}

          {/* Time range selector */}
          {analytics && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 font-medium mr-1">Show:</span>
              {ANALYTICS_RANGES.map(({ value, label }) => (
                <button 
                  key={value} 
                  onClick={() => handleRangeChange(value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    months === value ? "bg-[#2c3347] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Charts */}
          {analyticsLoading ? (
            <div className="flex flex-col gap-5">
              <div className="h-64 bg-white rounded-2xl border border-gray-100 animate-pulse" />
              <div className="grid grid-cols-2 gap-5">
                <div className="h-64 bg-white rounded-2xl border border-gray-100 animate-pulse" />
                <div className="h-64 bg-white rounded-2xl border border-gray-100 animate-pulse" />
              </div>
            </div>
          ) : analytics ? (
            <div className="flex flex-col gap-5">
              {/* Spending pie - with enhanced empty state */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="text-base font-bold text-gray-800 mb-6">{pieLabel}</h3>
                <PieChart 
                  data={analytics.spendingByCategory} 
                  months={months}
                  currentMonthName={currentMonthName}
                />
              </div>

              {/* Bar Chart + Anomalies - side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <MonthlyBarChart 
                    data={monthlyBreakdown} 
                    months={months}
                    onMonthsChange={handleRangeChange}
                  />
                </div>
                <AnomaliesSection 
                  anomalies={anomalies} 
                  onDismiss={dismissAnomaly} 
                />
              </div>
            </div>
          ) : null}

          {/* View Reports button - disabled if no card */}
          <div className="flex justify-end">
            <button 
              onClick={() => { 
                if (hasLinkedCard) {
                  fetchReports(); 
                  setShowReportsModal(true);
                } else {
                  alert('Please link a card first to view reports');
                }
              }}
              className={`px-8 py-3 text-white font-bold rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all ${
                hasLinkedCard 
                  ? 'bg-[#6b7c3f] hover:bg-[#5a6a33]' 
                  : 'bg-gray-300 cursor-not-allowed'
              }`}>
              View Reports
            </button>
          </div>

          {/* Inline report */}
          <ReportInline report={activeReport} loading={reportLoading} hasLinkedCard={hasLinkedCard} />
        </div>
      </main>
      <Footer />

      {showReportsModal && (
        <ReportsModal
          reports={reports} 
          loading={reportsLoading} 
          token={token}
          hasLinkedCard={hasLinkedCard}
          onClose={() => setShowReportsModal(false)}
          onViewReport={(r) => { setShowReportsModal(false); handleViewReport(r); }}
        />
      )}
    </div>
  );
};

export default InsightsPage;