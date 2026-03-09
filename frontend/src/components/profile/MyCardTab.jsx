import { useState, useEffect, useCallback } from "react";
import React from "react";
import { useInsights } from "../../hooks/useInsights.js";
import { Spinner } from "../ui/primitives.jsx";
import {
  BAHRAIN_BANKS,
  TX_CATEGORIES,
  TRANSACTIONS_PER_PAGE,
  SORT_OPTIONS,
} from "../../constants/insights.js";
import { formatBD } from "../../utils/formatters.js";
import {
  formatTxnDate,
  maskCardNumber,
  formatCardNumber,
} from "../../utils/insightsUtils.js";

// Card visual component
const CardVisual = React.memo(({ account, onAddCard }) => {
  if (!account) {
    return (
      <button
        onClick={onAddCard}
        className="w-full max-w-md mx-auto block group focus:outline-none"
      >
        <div className="relative h-44 rounded-2xl bg-[#2c3347] overflow-hidden shadow-xl group-hover:opacity-90 transition-opacity">
          <div className="absolute bottom-0 right-0 w-36 h-36 bg-[#6b7c3f]/40 rounded-full translate-x-10 translate-y-10" />
          <div className="absolute top-4 right-4 flex">
            <div className="w-8 h-8 rounded-full bg-red-500/90" />
            <div className="w-8 h-8 rounded-full bg-amber-400/80 -ml-3" />
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" opacity="0.55">
              <rect x="1" y="4" width="22" height="16" rx="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
            <p className="text-white/75 font-bold text-sm">Add Card</p>
          </div>
        </div>
      </button>
    );
  }

  const bankLabel = account.bankName || (account.bank ? account.bank.replace(/_/g, " ") : "Your Bank");
  const masked = account.maskedNumber
    ? `•••• •••• •••• ${String(account.maskedNumber).slice(-4)}`
    : maskCardNumber(account.cardNumber || "");
  const expiry = (account.expiryMonth && account.expiryYear)
    ? `${String(account.expiryMonth).padStart(2, "0")}/${String(account.expiryYear).slice(-2)}`
    : "";

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="relative h-44 rounded-2xl bg-[#2c3347] overflow-hidden shadow-xl">
        <div className="absolute bottom-0 right-0 w-44 h-44 bg-[#6b7c3f]/25 rounded-full translate-x-14 translate-y-14" />
        <p className="absolute top-4 left-5 text-white font-bold text-sm">{bankLabel}</p>
        <div className="absolute top-4 right-4 flex">
          <div className="w-8 h-8 rounded-full bg-red-500/90" />
          <div className="w-8 h-8 rounded-full bg-amber-400/80 -ml-3" />
        </div>
        <div className="absolute bottom-5 left-5 right-5">
          <p className="text-white/50 text-xs font-mono mb-1">{masked}</p>
          <div className="flex items-end justify-between">
            <p className="text-white font-semibold text-sm">{account.cardHolderName || "—"}</p>
            {expiry && <p className="text-white/50 text-xs">{expiry}</p>}
          </div>
        </div>
      </div>
    </div>
  );
});

// Add Card form
const AddCardForm = React.memo(({ onSubmit, onCancel, loading, error }) => {
  const [form, setForm] = useState({
    cardHolderName: "",
    cardNumber: "",
    expiryMonth: "",
    expiryYear: "",
    bank: BAHRAIN_BANKS[0].value,
    cardType: "CREDIT",
  });
  const [errors, setErrors] = useState({});

  const set = (f, v) => {
    setForm((p) => ({ ...p, [f]: v }));
    setErrors((p) => ({ ...p, [f]: null }));
  };

  const validate = () => {
    const e = {};
    if (!form.cardHolderName.trim()) e.cardHolderName = "Required";
    if (!/^\d{16}$/.test(form.cardNumber.replace(/\s/g, ""))) e.cardNumber = "Must be 16 digits";
    const m = parseInt(form.expiryMonth);
    if (!form.expiryMonth || m < 1 || m > 12) e.expiryMonth = "1–12";
    if (!form.expiryYear || form.expiryYear.replace(/\D/g, "").length < 2) e.expiryYear = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    const raw = form.cardNumber.replace(/\s/g, "");
    onSubmit({
      cardHolderName: form.cardHolderName.trim(),
      lastFourDigits: raw.slice(-4),
      expiryMonth: parseInt(form.expiryMonth),
      expiryYear: parseInt(form.expiryYear.length === 2 ? `20${form.expiryYear}` : form.expiryYear),
      bank: form.bank,
      cardType: form.cardType,
    });
  };

  const inputCn = (err) =>
    `w-full px-4 py-2.5 rounded-xl border text-sm outline-none bg-white transition-all ${
      err ? "border-red-300 bg-red-50"
          : "border-gray-200 focus:border-[#6b7c3f] focus:ring-2 focus:ring-[#6b7c3f]/10"
    }`;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 max-w-md mx-auto w-full">
      <div className="flex items-center justify-between mb-5">
        <h4 className="text-sm font-black text-gray-900">Add Card</h4>
        <button onClick={onCancel} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">✕</button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium">
          ⚠ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Cardholder Name</label>
          <input type="text" value={form.cardHolderName} onChange={(e) => set("cardHolderName", e.target.value)}
            placeholder="Enter Cardholder Name" className={inputCn(errors.cardHolderName)} />
          {errors.cardHolderName && <p className="text-xs text-red-500 mt-1">⚠ {errors.cardHolderName}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Card Number</label>
          <input type="text" inputMode="numeric"
            value={formatCardNumber(form.cardNumber)}
            onChange={(e) => set("cardNumber", e.target.value.replace(/\D/g, "").slice(0, 16))}
            placeholder="•••• •••• •••• ••••" maxLength={19}
            className={`${inputCn(errors.cardNumber)} font-mono tracking-widest`} />
          {errors.cardNumber && <p className="text-xs text-red-500 mt-1">⚠ {errors.cardNumber}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Card Expiry Date</label>
          <div className="flex gap-3">
            <input type="text" inputMode="numeric" value={form.expiryMonth}
              onChange={(e) => set("expiryMonth", e.target.value.replace(/\D/g, "").slice(0, 2))}
              placeholder="MM" maxLength={2}
              className={`w-24 px-3 py-2.5 rounded-xl border text-sm outline-none bg-white ${errors.expiryMonth ? "border-red-300 bg-red-50" : "border-gray-200 focus:border-[#6b7c3f]"}`} />
            <input type="text" inputMode="numeric" value={form.expiryYear}
              onChange={(e) => set("expiryYear", e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="YY" maxLength={4}
              className={`w-24 px-3 py-2.5 rounded-xl border text-sm outline-none bg-white ${errors.expiryYear ? "border-red-300 bg-red-50" : "border-gray-200 focus:border-[#6b7c3f]"}`} />
          </div>
          {(errors.expiryMonth || errors.expiryYear) && <p className="text-xs text-red-500 mt-1">⚠ Enter valid expiry</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Card Type</label>
          <div className="flex gap-3">
            {[{ value: "CREDIT", label: "Credit" }, { value: "DEBIT", label: "Debit" }].map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => set("cardType", t.value)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                  form.cardType === t.value
                    ? "bg-[#2c3347] text-white border-[#2c3347]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-[#2c3347]/40"
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Bank Name</label>
          <select value={form.bank} onChange={(e) => set("bank", e.target.value)} className={inputCn(false)}>
            {BAHRAIN_BANKS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>

        <button type="submit" disabled={loading}
          className="w-full py-3 mt-1 bg-[#6b7c3f] hover:bg-[#5a6a33] disabled:bg-gray-200 text-white font-bold rounded-xl">
          {loading ? <><Spinner size="sm" /> Linking…</> : "Add Card"}
        </button>
      </form>
    </div>
  );
});

// Transaction table
const TypeBadge = ({ type }) => {
  const isCredit = type === "CREDIT";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
      isCredit ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
    }`}>
      {isCredit ? "Income" : "Expense"}
    </span>
  );
};

const TxnTable = React.memo(({ transactions, loading, transactionsMeta }) => {
  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase w-16">#</th>
              <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase w-1/3">Name</th>
              <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase w-1/4">Category</th>
              <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase w-24">Type</th>
              <th className="py-3 px-4 text-right text-xs font-semibold text-gray-400 uppercase w-28">Amount</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-50 animate-pulse">
                <td className="py-3 px-4"><div className="h-3 bg-gray-100 rounded w-4" /></td>
                <td className="py-3 px-4"><div className="h-3.5 bg-gray-100 rounded w-32" /></td>
                <td className="py-3 px-4"><div className="h-6 bg-gray-100 rounded-full w-28" /></td>
                <td className="py-3 px-4"><div className="h-6 bg-gray-100 rounded-full w-20" /></td>
                <td className="py-3 px-4 text-right"><div className="h-3.5 bg-gray-100 rounded w-16 ml-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!transactions.length) {
    return (
      <div className="py-12 text-center">
        <p className="text-3xl mb-2">💳</p>
        <p className="text-sm text-gray-400">No transactions match your filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm table-fixed">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/60">
            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase w-16">#</th>
            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase w-1/3">Name</th>
            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase w-1/4">Category</th>
            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase w-24">Type</th>
            <th className="py-3 px-4 text-right text-xs font-semibold text-gray-400 uppercase w-28">Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn, idx) => {
            const isCredit = txn.type === "CREDIT";
            return (
              <tr key={txn.id || idx} className={`border-b border-gray-50 last:border-0 ${
                isCredit ? "hover:bg-emerald-50/30" : "hover:bg-red-50/20"
              }`}>
                <td className="py-3 px-4 text-xs text-gray-400 font-mono">
                  {idx + 1 + (transactionsMeta.number * TRANSACTIONS_PER_PAGE)}
                </td>
                <td className="py-3 px-4">
                  <p className="font-semibold text-gray-800 text-sm truncate">{txn.merchantName || "Transaction"}</p>
                  <p className="text-xs text-gray-400">{formatTxnDate(txn.transactionDate)}</p>
                </td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 whitespace-nowrap">
                    {txn.categoryIcon || "💳"}
                    <span className="max-w-[120px] truncate">{txn.category || "Other"}</span>
                  </span>
                </td>
                <td className="py-3 px-4">
                  <TypeBadge type={txn.type} />
                </td>
                <td className={`py-3 px-4 text-right font-bold text-sm ${
                  isCredit ? "text-emerald-600" : "text-red-500"
                }`}>
                  {isCredit ? "+" : "−"}{formatBD(txn.amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

// Filters Bar - WITHOUT income/expense filter
const FiltersBar = React.memo(({ filters, onChange }) => {
  const handleSortChange = (sortValue) => {
    let sortBy = "transactionDate";
    let sortDir = "DESC";

    switch (sortValue) {
      case "amount_asc": sortBy = "amount"; sortDir = "ASC"; break;
      case "amount_desc": sortBy = "amount"; sortDir = "DESC"; break;
      case "date_asc": sortBy = "transactionDate"; sortDir = "ASC"; break;
      default: sortBy = "transactionDate"; sortDir = "DESC"; break;
    }

    onChange({ ...filters, sort: sortValue, sortBy, sortDir, page: 0 });
  };

  return (
    <div className="flex flex-wrap gap-3 mb-4">
      <div className="relative flex-[2] min-w-[220px]">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input type="text" value={filters.search || ""}
          onChange={(e) => onChange({ ...filters, search: e.target.value, page: 0 })}
          placeholder="Search transactions"
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:border-[#6b7c3f]" />
      </div>

      <select value={filters.category || ""}
        onChange={(e) => onChange({ ...filters, category: e.target.value, page: 0 })}
        className="flex-1 min-w-[160px] px-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:border-[#6b7c3f] bg-white">
        <option value="">All Categories</option>
        {TX_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>

      <select value={filters.sort || "date_desc"}
        onChange={(e) => handleSortChange(e.target.value)}
        className="w-40 px-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:border-[#6b7c3f] bg-white">
        {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    </div>
  );
});

// Pagination
const Pagination = React.memo(({ page, totalPages, totalElements, onChange }) => {
  if (totalPages <= 1) return null;

  const start = Math.max(0, Math.min(page - 2, totalPages - 5));
  const visible = [];
  for (let i = start; i < Math.min(start + 5, totalPages); i++) visible.push(i);

  return (
    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
      <p className="text-xs text-gray-400">{totalElements} transaction{totalElements !== 1 ? "s" : ""}</p>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page === 0}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30">‹</button>

        {visible[0] > 0 && <>
          <button onClick={() => onChange(0)} className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100">1</button>
          {visible[0] > 1 && <span className="text-gray-300 text-xs px-0.5">…</span>}
        </>}

        {visible.map((n) => (
          <button key={n} onClick={() => onChange(n)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold ${
              page === n ? "bg-[#2c3347] text-white" : "text-gray-500 hover:bg-gray-100"
            }`}>{n + 1}</button>
        ))}

        {visible[visible.length - 1] < totalPages - 1 && <>
          {visible[visible.length - 1] < totalPages - 2 && <span className="text-gray-300 text-xs px-0.5">…</span>}
          <button onClick={() => onChange(totalPages - 1)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold ${
              page === totalPages - 1 ? "bg-[#2c3347] text-white" : "text-gray-500 hover:bg-gray-100"
            }`}>{totalPages}</button>
        </>}

        <button onClick={() => onChange(page + 1)} disabled={page >= totalPages - 1}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30">›</button>
      </div>
    </div>
  );
});

// Main Component
const MyCardTab = () => {
  const {
    hasLinkedCard,
    primaryAccount,
    accountsLoading,
    transactions,
    transactionsMeta,
    transactionsLoading,
    fetchTransactions,
    linkCard,
    fetchAccounts,
  } = useInsights();

  const [showForm, setShowForm] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  const [filters, setFilters] = useState({
    search: "",
    category: "",
    sort: "date_desc",
    sortBy: "transactionDate",
    sortDir: "DESC",
    page: 0,
  });

  const handleFilterChange = useCallback((newFilters) => {
    setFilters(newFilters);
  }, []);

  const handlePageChange = useCallback((newPage) => {
    setFilters((f) => ({ ...f, page: newPage }));
  }, []);

  // Fetch when filters change
  useEffect(() => {
    if (!hasLinkedCard) return;

    const params = {
      page: filters.page,
      size: TRANSACTIONS_PER_PAGE,
      search: filters.search || undefined,
      category: filters.category || undefined,
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
    };

    fetchTransactions(params);
  }, [
    filters.page, filters.search, filters.category,
    filters.sortBy, filters.sortDir, hasLinkedCard, fetchTransactions
  ]);

  const flash = useCallback((msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4000);
  }, []);

  const handleLinkCard = useCallback(async (cardData) => {
    setCardLoading(true);
    setCardError(null);
    try {
      await linkCard(cardData);
      setShowForm(false);
      await fetchAccounts();
      await fetchTransactions({ page: 0 });
      flash("Card linked! Transactions are syncing.");
    } catch (err) {
      setCardError(err.message || "Failed to link card");
    } finally {
      setCardLoading(false);
    }
  }, [linkCard, fetchAccounts, fetchTransactions, flash]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-center">
        {accountsLoading ? (
          <div className="w-full max-w-md h-44 bg-gray-100 rounded-2xl animate-pulse" />
        ) : (
          <CardVisual account={primaryAccount} onAddCard={() => setShowForm(true)} />
        )}
      </div>

      {!hasLinkedCard && showForm && (
        <AddCardForm
          onSubmit={handleLinkCard}
          onCancel={() => setShowForm(false)}
          loading={cardLoading}
          error={cardError}
        />
      )}

      {successMsg && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5 text-xs text-emerald-700 font-medium max-w-md mx-auto">
          ✓ {successMsg}
        </div>
      )}

      {hasLinkedCard && !showForm && (
        <div className="w-full">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-bold text-gray-800">Recent transactions</h4>
            {transactionsMeta.totalElements > 0 && (
              <span className="text-xs text-gray-400">{transactionsMeta.totalElements} transactions</span>
            )}
          </div>

          <FiltersBar filters={filters} onChange={handleFilterChange} />

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <TxnTable transactions={transactions} loading={transactionsLoading} transactionsMeta={transactionsMeta} />
          </div>

          <Pagination
            page={filters.page}
            totalPages={transactionsMeta.totalPages}
            totalElements={transactionsMeta.totalElements}
            onChange={handlePageChange}
          />
        </div>
      )}

      {!hasLinkedCard && !accountsLoading && !showForm && (
        <p className="text-center text-xs text-gray-400 mt-2">
          Tap the card above to link your bank card and start tracking transactions.
        </p>
      )}
    </div>
  );
};

export default React.memo(MyCardTab);