// ─────────────────────────────────────────────────────────────────────────────
// pages/DashboardPage.jsx
// Home page for authenticated users displaying a dashboard with recent transactions,
// feature highlights, and navigation to insights and goals.
// 
// Features:
// - Hero section with branding
// - Feature bullets highlighting app capabilities
// - Recent transactions preview with link to full transaction view
// - Bottom CTA section with goals navigation
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useInsights } from "../hooks/useInsights.js";
import Navbar from "../components/common/Navbar.jsx";
import Footer from "../components/common/Footer.jsx";
import { formatBD } from "../utils/formatters.js";
import { formatTxnDate } from "../utils/insightsUtils.js";
import { CATEGORY_STYLE, CATEGORY_ICON, DASHBOARD_RECENT_TX } from "../constants/insights.js";

/**
 * Compact transaction row component for dashboard preview
 * Displays transaction icon, merchant name, date, type badge, and amount
 * 
 * @param {Object} props - Component props
 * @param {Object} props.txn - Transaction object
 * @param {number} props.index - Row index for numbering
 */
const TxnPreviewRow = ({ txn, index }) => {
  const isCredit = txn.type === "CREDIT";
  const style = CATEGORY_STYLE[txn.category] || "bg-gray-100 text-gray-500";
  const icon = txn.categoryIcon || CATEGORY_ICON[txn.category] || "💳";

  return (
    <div className={`flex items-center gap-3 py-3 border-b border-gray-50 last:border-0
                     ${isCredit ? "hover:bg-emerald-50/20" : "hover:bg-red-50/10"} transition-colors`}>
      {/* Row number */}
      <span className="text-xs text-gray-300 font-mono w-4 shrink-0">{index + 1}</span>

      {/* Category icon */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm ${style}`}>
        {icon}
      </div>

      {/* Merchant name and date */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{txn.merchantName || "Transaction"}</p>
        <p className="text-xs text-gray-400">{formatTxnDate(txn.transactionDate)}</p>
      </div>

      {/* Transaction type badge */}
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
        isCredit ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
      }`}>
        {isCredit ? "Income" : "Expense"}
      </span>

      {/* Amount with sign */}
      <div className="text-right shrink-0 min-w-[72px]">
        <p className={`text-sm font-bold ${isCredit ? "text-emerald-600" : "text-red-500"}`}>
          {isCredit ? "+" : "−"}{formatBD(txn.amount)}
        </p>
      </div>
    </div>
  );
};

/**
 * Skeleton loader for transaction rows during loading state
 */
const TxnPreviewSkeleton = () => (
  <div className="flex items-center gap-3 py-3 border-b border-gray-50 animate-pulse">
    <div className="w-4 shrink-0" />
    <div className="w-9 h-9 bg-gray-100 rounded-xl shrink-0" />
    <div className="flex-1 space-y-1.5">
      <div className="h-3.5 bg-gray-100 rounded w-3/5" />
      <div className="h-3 bg-gray-100 rounded w-2/5" />
    </div>
    <div className="h-5 bg-gray-100 rounded-full w-14 shrink-0" />
    <div className="h-3.5 bg-gray-100 rounded w-16 shrink-0" />
  </div>
);

/**
 * Feature bullet component for highlighting app capabilities
 * 
 * @param {Object} props - Component props
 * @param {string} props.text - Feature description text
 */
const FeatureBullet = ({ text }) => (
  <div className="bg-gray-100 rounded-xl px-5 py-3.5">
    <p className="text-sm text-gray-600 leading-relaxed">{text}</p>
  </div>
);

/**
 * Dashboard page component
 * Displays welcome hero, feature highlights, and recent transactions preview
 */
const DashboardPage = () => {
  const { transactions, transactionsLoading, hasLinkedCard, fetchTransactions } = useInsights();

  // Load only the 4 most recent transactions for the preview section
  useEffect(() => {
    fetchTransactions({ page: 0, size: DASHBOARD_RECENT_TX });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <main className="flex-1 pt-[64px]">

        {/* Hero section with headline and card stack visual */}
        <section className="bg-white overflow-hidden">
          <div className="max-w-6xl mx-auto px-6 pt-10 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
              {/* Headline */}
              <div>
                <h1 className="text-4xl md:text-5xl font-black text-gray-900 leading-tight uppercase tracking-tight">
                  Make Payments Easy,{" "}
                  <span className="block">Simplify Your</span>
                  <span className="block">Finances</span>
                </h1>
              </div>

              {/* Card stack visual with olive background */}
              <div className="relative flex items-center justify-end min-h-[200px]">
                <div className="absolute right-0 top-0 bottom-0 w-3/4 bg-[#a3b46a]/30 rounded-3xl" />
                <div className="relative z-10 mr-4 mt-4" style={{ height: "140px", width: "210px" }}>
                  {[
                    { bg: "bg-gray-200", rotate: "-6deg", top: "24px", zIndex: 1 },
                    { bg: "bg-gray-300", rotate: "-2deg", top: "12px", zIndex: 2 },
                    { bg: "bg-white shadow-xl", rotate: "2deg", top: "0px", zIndex: 3 },
                  ].map((c, i) => (
                    <div
                      key={i}
                      className={`absolute w-52 h-32 rounded-2xl ${c.bg} flex items-center justify-end px-5`}
                      style={{ transform: `rotate(${c.rotate})`, top: c.top, zIndex: c.zIndex }}
                    >
                      {i === 2 && <span className="text-2xl font-black text-blue-600 tracking-widest">VISA</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature bullets section */}
        <section className="bg-white">
          <div className="max-w-6xl mx-auto px-6 pb-8 flex flex-col gap-3">
            <FeatureBullet text="Track every transaction from your linked bank cards automatically — no manual entry needed." />
            <FeatureBullet text="Get AI-powered spending analytics, category breakdowns, and monthly financial health reports." />
            <FeatureBullet text="Set savings goals, simulate spending cut scenarios, and reach your milestones faster with your AI coach." />
          </div>
        </section>

        {/* Recent Transactions section */}
        <section className="bg-white py-6">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-black text-[#6b7c3f]">Recent Transactions</h2>
              <div className="flex gap-2">
                {/* Link to full transaction view in profile card tab */}
                <Link
                  to="/profile?tab=card"
                  className="px-4 py-2 border border-[#2c3347] text-[#2c3347] hover:bg-[#2c3347] hover:text-white
                             text-xs font-semibold rounded-xl transition-all"
                >
                  View All
                </Link>
                {/* Link to insights page for detailed analytics */}
                <Link
                  to="/insights"
                  className="px-4 py-2 bg-[#2c3347] hover:bg-[#3d4357] text-white
                             text-xs font-semibold rounded-xl transition-all"
                >
                  View Insights
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-1">
              {transactionsLoading ? (
                // Loading skeletons
                Array.from({ length: DASHBOARD_RECENT_TX }).map((_, i) => <TxnPreviewSkeleton key={i} />)
              ) : transactions.length === 0 ? (
                // Empty state - no transactions
                <div className="py-10 text-center">
                  <p className="text-2xl mb-2">💳</p>
                  <p className="text-sm text-gray-400">
                    {hasLinkedCard
                      ? "No transactions yet — try syncing your card."
                      : "Link a bank card in Profile → My Card to see transactions here."}
                  </p>
                  {!hasLinkedCard && (
                    <Link
                      to="/profile?tab=card"
                      className="inline-flex mt-3 px-4 py-2 bg-[#6b7c3f] hover:bg-[#5a6a33]
                                 text-white text-xs font-bold rounded-xl transition-all"
                    >
                      Link a Card
                    </Link>
                  )}
                </div>
              ) : (
                // Display up to DASHBOARD_RECENT_TX transactions
                transactions.slice(0, DASHBOARD_RECENT_TX).map((txn, i) => (
                  <TxnPreviewRow key={txn.id || i} txn={txn} index={i} />
                ))
              )}
            </div>
          </div>
        </section>

        {/* Bottom CTA section linking to goals */}
        <section className="bg-white py-10">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="flex flex-col gap-4">
                <h2 className="text-2xl font-black text-[#6b7c3f] leading-tight">Recent Transactions</h2>
                <p className="text-gray-500 text-sm leading-relaxed max-w-sm">
                  Every transaction tells a story about your financial habits. Track them, understand patterns,
                  and make smarter decisions with PathWise's AI-powered insights to accelerate your progress
                  towards every milestone.
                </p>
                <Link
                  to="/goals"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2c3347] hover:bg-[#3d4357]
                             text-white text-sm font-semibold rounded-xl transition-all w-fit"
                >
                  View Goals
                </Link>
              </div>
              <div className="rounded-2xl overflow-hidden shadow-lg">
                <img
                  src="https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=600&q=80"
                  alt="Savings jar"
                  className="w-full h-52 object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default DashboardPage;