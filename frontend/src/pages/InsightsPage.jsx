// ─────────────────────────────────────────────────────────────────────────────
// pages/InsightsPage.jsx
//
// Route: /insights
//
// Layout:
//   1. Dark navy hero banner
//   2. 3 stat cards: Account Balance (Plaid + salary) | Expenses | Income
//   3. Anomaly banners
//   4. Time range selector: This month | 3 months | 6 months | 12 months
//   5. Spending pie chart — hover shows % + amount tooltip
//   6. Income vs Expenses bar chart + Weekly (Mon–Sun current week) side by side
//   7. "View Reports" button → popup modal
//   8. Latest report rendered inline below button
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { useInsights }         from "../hooks/useInsights.js";
import { useAuth }             from "../context/AuthContext.jsx";
import { insightsService }     from "../services/insightsService.js";
import Navbar                  from "../components/common/Navbar.jsx";
import Footer                  from "../components/common/Footer.jsx";
import { Spinner }             from "../components/ui/primitives.jsx";
import { formatBD, formatBDAmount } from "../utils/formatters.js";
import { formatReportDate }    from "../utils/insightsUtils.js";
import { PIE_COLORS, ANOMALY_SEVERITY, ANALYTICS_RANGES } from "../constants/insights.js";

// ─────────────────────────────────────────────────────────────────────────────
// Pie chart with hover tooltip
// ─────────────────────────────────────────────────────────────────────────────
const PieChart = ({ data }) => {
  const [hovered, setHovered] = useState(null); // { label, value, pct, x, y }

  const entries = Object.entries(data || {}).filter(([, v]) => v > 0);
  if (!entries.length) {
    return <div className="flex items-center justify-center h-36"><p className="text-sm text-gray-400">No spending data yet</p></div>;
  }

  const total  = entries.reduce((s, [, v]) => s + v, 0);
  const cx = 80, cy = 80, r = 72;
  let angle = -Math.PI / 2;

  const slices = entries.map(([label, value], i) => {
    const sweep  = (value / total) * 2 * Math.PI;
    const midAng = angle + sweep / 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    // tooltip anchor point — midpoint on arc, slightly outside
    const tx = cx + (r + 10) * Math.cos(midAng);
    const ty = cy + (r + 10) * Math.sin(midAng);
    return {
      label, value,
      path:  `M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`,
      color: PIE_COLORS[i % PIE_COLORS.length],
      pct:   ((value / total) * 100).toFixed(1),
      tx, ty,
    };
  });

  return (
    <div className="flex items-center gap-8 flex-wrap">
      {/* SVG */}
      <div className="relative shrink-0">
        <svg viewBox="0 0 160 160" className="w-40 h-40">
          {slices.map((s, i) => (
            <path
              key={i}
              d={s.path}
              fill={s.color}
              stroke="white"
              strokeWidth={hovered?.label === s.label ? "2.5" : "1.5"}
              opacity={hovered ? (hovered.label === s.label ? 1 : 0.6) : 1}
              style={{ cursor: "pointer", transition: "opacity 0.15s, stroke-width 0.15s" }}
              onMouseEnter={() => setHovered({ label: s.label, value: s.value, pct: s.pct, color: s.color })}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>

        {/* Centre tooltip on hover */}
        {hovered && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-xl font-black leading-tight" style={{ color: hovered.color }}>
              {hovered.pct}%
            </p>
            <p className="text-xs text-gray-600 font-medium text-center px-2 leading-tight">
              {hovered.label}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{formatBD(hovered.value)}</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        {slices.map((s, i) => (
          <div key={i}
            className="flex items-center gap-2 cursor-pointer"
            onMouseEnter={() => setHovered({ label: s.label, value: s.value, pct: s.pct, color: s.color })}
            onMouseLeave={() => setHovered(null)}>
            <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className={`text-xs font-medium truncate max-w-[80px] ${hovered?.label === s.label ? "text-gray-900" : "text-gray-600"}`}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Income vs Expenses grouped bar chart
// ─────────────────────────────────────────────────────────────────────────────
const IncomeExpensesChart = ({ data }) => {
  if (!data?.length) return (
    <div className="flex items-center justify-center h-32"><p className="text-sm text-gray-400">No data yet</p></div>
  );
  const maxVal = Math.max(...data.flatMap((d) => [d.income || 0, d.expenses || 0]), 1);
  const barH   = 100;
  const colW   = 52;
  const W      = data.length * colW + 20;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${barH + 30}`} className="w-full" style={{ minWidth: "260px" }}>
        {[0.25, 0.5, 0.75, 1].map((f) => {
          const y = barH * (1 - f);
          return (
            <g key={f}>
              <line x1="12" y1={y} x2={W - 4} y2={y} stroke="#f3f4f6" strokeWidth="1" />
              <text x="10" y={y + 3} fontSize="7" fill="#d1d5db" textAnchor="end">
                {Math.round(f * maxVal)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x  = i * colW + 16;
          const iH = Math.max(((d.income   || 0) / maxVal) * barH, 0);
          const eH = Math.max(((d.expenses || 0) / maxVal) * barH, 0);
          return (
            <g key={i}>
              <rect x={x}      y={barH - iH} width="16" height={iH} fill="#a3b46a" rx="2" />
              <rect x={x + 18} y={barH - eH} width="16" height={eH} fill="#2c3347" rx="2" />
              <text x={x + 16} y={barH + 14} fontSize="7.5" fill="#9ca3af" textAnchor="middle">
                {String(d.month || d.label || "").slice(0, 3)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-6 mt-2 px-1">
        {[["#a3b46a", "Income"], ["#2c3347", "Expenses"]].map(([color, label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded-sm" style={{ background: color }} />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Weekly chart — Mon to Sun of current week, uses dailySpending from backend
// The backend provides dailySpending as a Map<date-string, amount>.
// We pick the 7 days of the current ISO week.
// ─────────────────────────────────────────────────────────────────────────────
const WeeklyChart = ({ dailySpending }) => {
  // Build current week Mon–Sun labels and amounts
  const today    = new Date();
  const dayOfWk  = today.getDay();                          // 0=Sun … 6=Sat
  const monday   = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWk + 6) % 7));   // roll back to Monday

  const weekDays = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const weekData = weekDays.map((label, i) => {
    const d   = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    return { label, amount: parseFloat(dailySpending?.[key] || 0) };
  });

  const maxVal = Math.max(...weekData.map((d) => d.amount), 1);
  const barH   = 80;
  const barW   = 22;
  const colW   = 34;

  if (weekData.every((d) => d.amount === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2">
        <p className="text-sm text-gray-400">No spending this week yet</p>
        <div className="flex items-end gap-2 opacity-20">
          {weekDays.map((d) => (
            <div key={d} className="flex flex-col items-center gap-1">
              <div className="w-5 bg-[#a3b46a] rounded-t" style={{ height: `${Math.random() * 40 + 10}px` }} />
              <span className="text-[9px] text-gray-400">{d}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <svg viewBox={`0 0 ${weekData.length * colW + 10} ${barH + 22}`} className="w-full">
        {weekData.map((d, i) => {
          const h = (d.amount / maxVal) * barH;
          const x = i * colW + 8;
          const isToday = weekDays[i] === weekDays[(today.getDay() + 6) % 7];
          return (
            <g key={i}>
              <rect x={x} y={barH - h} width={barW} height={Math.max(h, 2)}
                fill={isToday ? "#6b7c3f" : "#a3b46a"} rx="3" opacity="0.85" />
              <text x={x + barW / 2} y={barH + 14} fontSize="8" fill={isToday ? "#6b7c3f" : "#9ca3af"}
                textAnchor="middle" fontWeight={isToday ? "700" : "400"}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-[10px] text-gray-400 text-center mt-1">Current week spending by day</p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Anomaly banner
// ─────────────────────────────────────────────────────────────────────────────
const AnomalyBanner = ({ anomaly, onDismiss }) => {
  const cfg = ANOMALY_SEVERITY[anomaly.severity] || ANOMALY_SEVERITY.LOW;
  return (
    <div className={`flex items-start gap-3 p-3.5 rounded-xl border ${cfg.bg} ${cfg.border}`}>
      <span className="shrink-0 mt-0.5">{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold uppercase tracking-wider mb-0.5 opacity-60 ${cfg.text}`}>
          {anomaly.severity} · {anomaly.category}
        </p>
        <p className={`text-sm leading-relaxed ${cfg.text}`}>{anomaly.message}</p>
      </div>
      <button onClick={() => onDismiss(anomaly.id)}
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors opacity-50 hover:opacity-100">
        ✕
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Reports popup
// ─────────────────────────────────────────────────────────────────────────────
const ReportsModal = ({ reports, loading, token, onClose, onViewReport }) => {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const report = await insightsService.generateReport(token);
      onViewReport(report);
      onClose();
    } catch (err) { console.error("generate:", err.message); }
    finally       { setGenerating(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-black text-gray-900">Financial Reports</h3>
            <p className="text-xs text-gray-400 mt-0.5">AI-generated monthly summaries</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
          {/* Generate */}
          <button onClick={handleGenerate} disabled={generating}
            className="w-full py-2.5 bg-[#2c3347] hover:bg-[#3d4357] disabled:bg-gray-200 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2">
            {generating ? <><Spinner size="sm" /> Generating…</> : "✨ Generate New Report"}
          </button>
          {/* List */}
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)
            : reports.length === 0
            ? <div className="py-10 text-center"><p className="text-3xl mb-2">📋</p><p className="text-sm text-gray-400">No reports yet.</p></div>
            : reports.map((r) => (
                <button key={r.id}
                  onClick={() => { onViewReport(r); onClose(); }}
                  className="flex items-center justify-between gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl text-left w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-[#6b7c3f]/10 rounded-lg flex items-center justify-center text-base shrink-0">📊</div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{r.title || "Monthly Report"}</p>
                      <p className="text-xs text-gray-400">{formatReportDate(r.createdAt)}</p>
                    </div>
                  </div>
                  <span className="text-gray-300 text-sm">›</span>
                </button>
              ))
          }
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Inline report display (below "View Reports" button)
// ─────────────────────────────────────────────────────────────────────────────
const ReportInline = ({ report, loading }) => {
  if (loading) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex items-center justify-center gap-3">
      <Spinner color="#6b7c3f" /><span className="text-sm text-gray-400">Loading report…</span>
    </div>
  );
  // Empty placeholder box matching prototype even when no report yet
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
// Stat card
// ─────────────────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, bg, labelCn, sub }) => (
  <div className={`${bg} rounded-2xl p-5 shadow-lg`}>
    <p className={`${labelCn} text-xs font-semibold uppercase tracking-wider mb-1`}>{label}</p>
    <p className="text-white text-xl font-black leading-tight">{value}</p>
    {sub && <p className="text-white/40 text-[10px] mt-1">{sub}</p>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
const InsightsPage = () => {
  const { token }  = useAuth();
  const {
    analytics, analyticsLoading, analyticsError,
    anomalies, anomaliesLoading,
    reports, reportsLoading,
    dismissAnomaly, fetchAnalytics, fetchReports,
    currentMonthName,
  } = useInsights();

  const [months,             setMonths]             = useState(1); // default: current month
  const [showReportsModal,   setShowReportsModal]   = useState(false);
  const [activeReport,       setActiveReport]       = useState(null);
  const [reportLoading,      setReportLoading]      = useState(false);

  const monthlyBreakdown = (analytics?.monthlyBreakdown || []).map((d) => ({
    month: d.month || d.label || "", income: d.income || 0, expenses: d.expenses || 0,
  }));

  const handleViewReport = async (r) => {
    if (r?.content) { setActiveReport(r); return; }
    setReportLoading(true);
    setActiveReport(null);
    try { setActiveReport(await insightsService.getReport(token, r.id)); }
    catch (err) { console.error("getReport:", err.message); }
    finally     { setReportLoading(false); }
  };

  // Auto-load latest report
  useEffect(() => {
    if (reports.length > 0 && !activeReport) handleViewReport(reports[0]);
  }, [reports]); // eslint-disable-line

  const handleRangeChange = (m) => {
    setMonths(m);
    fetchAnalytics(m);
  };

  // Label for the spending pie heading
  const pieLabel = months === 1 ? `${currentMonthName} Spending` : `Spending (last ${months} months)`;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 pt-[64px]">
        {/* Hero banner */}
        <div className="bg-[#2c3347] relative overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="absolute border border-white/10 rounded-full pointer-events-none"
              style={{ width:`${(i+1)*200}px`, height:`${(i+1)*200}px`, top:"50%", right:"-5%", transform:"translate(0,-50%)" }} />
          ))}
          <div className="relative z-10 max-w-6xl mx-auto px-6 py-10 lg:py-14">
            <p className="text-[#a3b46a] text-xs font-semibold uppercase tracking-widest mb-3">Life Milestone Planner</p>
            <h1 className="text-3xl lg:text-4xl font-black text-white leading-tight mb-3">
              Your Path to <span className="text-[#a3b46a]">Financial Freedom</span>
            </h1>
            <p className="text-gray-400 text-sm max-w-xl leading-relaxed">
              Track every goal, simulate spending scenarios, and let your AI coach guide you to milestones faster.
            </p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-6">

          {/* Stat cards */}
          {analyticsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1,2,3].map((i) => <div key={i} className="h-24 bg-gray-200 rounded-2xl animate-pulse" />)}
            </div>
          ) : analytics ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                label="Account Balance"
                value={`${formatBDAmount(analytics.totalBalance)} BHD`}
                bg="bg-[#6b7c3f]" labelCn="text-[#c5d48a]"
                sub="Plaid balance + salary"
              />
              <StatCard
                label="Monthly Spending"
                value={`${formatBDAmount(analytics.totalExpenses)} BHD`}
                bg="bg-[#3d4357]" labelCn="text-gray-400"
              />
              <StatCard
                label="Monthly Income"
                value={`${formatBDAmount(analytics.totalIncome)} BHD`}
                bg="bg-[#2c3347]" labelCn="text-gray-400"
              />
            </div>
          ) : analyticsError ? (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700 font-medium">
              ⚠️ {analyticsError} — Link a card in Profile → My Card to get started.
            </div>
          ) : null}

          {/* Anomaly banners */}
          {!anomaliesLoading && anomalies.length > 0 && (
            <div className="flex flex-col gap-2">
              {anomalies.slice(0, 3).map((a) => (
                <AnomalyBanner key={a.id} anomaly={a} onDismiss={dismissAnomaly} />
              ))}
            </div>
          )}

          {/* Time range selector */}
          {analytics && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 font-medium mr-1">Show:</span>
              {ANALYTICS_RANGES.map(({ value, label }) => (
                <button key={value} onClick={() => handleRangeChange(value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    months === value ? "bg-[#2c3347] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}>{label}</button>
              ))}
            </div>
          )}

          {/* Charts */}
          {analyticsLoading ? (
            <div className="flex flex-col gap-5">
              <div className="h-56 bg-white rounded-2xl border border-gray-100 animate-pulse" />
              <div className="grid grid-cols-2 gap-5">
                <div className="h-44 bg-white rounded-2xl border border-gray-100 animate-pulse" />
                <div className="h-44 bg-white rounded-2xl border border-gray-100 animate-pulse" />
              </div>
            </div>
          ) : analytics ? (
            <div className="flex flex-col gap-5">
              {/* Spending pie */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-800 mb-4">{pieLabel}</h3>
                <PieChart data={analytics.spendingByCategory} />
              </div>

              {/* Income vs Expenses + Weekly */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="text-sm font-bold text-gray-800 mb-4">Income Vs Expenses</h3>
                  <IncomeExpensesChart data={monthlyBreakdown} />
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="text-sm font-bold text-gray-800 mb-1">Weekly</h3>
                  <WeeklyChart dailySpending={analytics.dailySpending} />
                </div>
              </div>
            </div>
          ) : null}

          {/* View Reports button */}
          <div className="flex justify-end">
            <button
              onClick={() => { fetchReports(); setShowReportsModal(true); }}
              className="px-8 py-3 bg-[#6b7c3f] hover:bg-[#5a6a33] text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5">
              View Reports
            </button>
          </div>

          {/* Inline report */}
          <ReportInline report={activeReport} loading={reportLoading} />
        </div>
      </main>

      <Footer />

      {showReportsModal && (
        <ReportsModal
          reports={reports} loading={reportsLoading} token={token}
          onClose={() => setShowReportsModal(false)}
          onViewReport={(r) => { setShowReportsModal(false); handleViewReport(r); }}
        />
      )}
    </div>
  );
};

export default InsightsPage;