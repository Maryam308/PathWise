import { useState, useEffect } from "react";
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

// ─────────────────────────────────────────────────────────────────────────────
// Card visual
// ─────────────────────────────────────────────────────────────────────────────
const CardVisual = ({ account, onAddCard }) => {
  if (!account) {
    return (
      <button
        onClick={onAddCard}
        className="w-full max-w-sm mx-auto block group focus:outline-none"
        aria-label="Add a card"
      >
        <div className="relative h-44 rounded-2xl bg-[#2c3347] overflow-hidden shadow-xl
                        group-hover:opacity-90 transition-opacity cursor-pointer">
          <div className="absolute bottom-0 right-0 w-36 h-36 bg-[#6b7c3f]/40 rounded-full
                          translate-x-10 translate-y-10" />
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
    <div className="w-full max-w-sm mx-auto">
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
};

// ─────────────────────────────────────────────────────────────────────────────
// Add Card form
// ─────────────────────────────────────────────────────────────────────────────
const AddCardForm = ({ onSubmit, onCancel, loading, error }) => {
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
      cardNumber: raw,
      lastFourDigits: raw.slice(-4),
      expiryMonth: parseInt(form.expiryMonth),
      expiryYear: parseInt(form.expiryYear.length === 2 ? `20${form.expiryYear}` : form.expiryYear),
      bank: form.bank,
      cardType: form.cardType,
    });
  };

  const inputCn = (err) =>
    `w-full px-4 py-2.5 rounded-xl border text-sm outline-none bg-white transition-all ${err ? "border-red-300 bg-red-50"
      : "border-gray-200 focus:border-[#6b7c3f] focus:ring-2 focus:ring-[#6b7c3f]/10"
    }`;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-5">
        <h4 className="text-sm font-black text-gray-900">Add Card</h4>
        <button onClick={onCancel} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors text-sm">✕</button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium">
          ⚠ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Cardholder Name */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Cardholder Name</label>
          <input type="text" value={form.cardHolderName} onChange={(e) => set("cardHolderName", e.target.value)}
            placeholder="Enter Cardholder Name" className={inputCn(errors.cardHolderName)} />
          {errors.cardHolderName && <p className="text-xs text-red-500 mt-1">⚠ {errors.cardHolderName}</p>}
        </div>

        {/* Card Number */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Card Number</label>
          <input type="text" inputMode="numeric"
            value={formatCardNumber(form.cardNumber)}
            onChange={(e) => set("cardNumber", e.target.value.replace(/\D/g, "").slice(0, 16))}
            placeholder="•••• •••• •••• ••••" maxLength={19}
            className={`${inputCn(errors.cardNumber)} font-mono tracking-widest`} />
          {errors.cardNumber && <p className="text-xs text-red-500 mt-1">⚠ {errors.cardNumber}</p>}
        </div>

        {/* Expiry */}
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
          {(errors.expiryMonth || errors.expiryYear) && <p className="text-xs text-red-500 mt-1">⚠ Enter a valid expiry date</p>}
        </div>

        {/* Card Type */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Card Type</label>
          <div className="flex gap-3">
            {[{ value: "CREDIT", label: "Credit Card" }, { value: "DEBIT", label: "Debit Card" }].map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => set("cardType", t.value)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${form.cardType === t.value
                    ? "bg-[#2c3347] text-white border-[#2c3347]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-[#2c3347]/40"
                  }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bank */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Bank Name</label>
          <select value={form.bank} onChange={(e) => set("bank", e.target.value)} className={inputCn(false)}>
            {BAHRAIN_BANKS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>

        <button type="submit" disabled={loading}
          className="w-full py-3 mt-1 bg-[#6b7c3f] hover:bg-[#5a6a33] disabled:bg-gray-200
                     text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2">
          {loading ? <><Spinner size="sm" /> Linking card…</> : "Add Card"}
        </button>
      </form>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Transaction table
// ─────────────────────────────────────────────────────────────────────────────
const TypeBadge = ({ type }) => {
  const isCredit = type === "CREDIT";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${isCredit ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
      }`}>
      {isCredit ? "Income" : "Expense"}
    </span>
  );
};

const TxnTable = ({ transactions, loading, transactionsMeta }) => {
  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="py-3 px-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-10">#</th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Category</th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
              <th className="py-3 px-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Amount</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-50 animate-pulse">
                <td className="py-3 px-3"><div className="h-3 bg-gray-100 rounded w-4" /></td>
                <td className="py-3 px-3">
                  <div className="h-3.5 bg-gray-100 rounded w-32 mb-1" />
                  <div className="h-3 bg-gray-100 rounded w-20" />
                </td>
                <td className="py-3 px-3"><div className="h-6 bg-gray-100 rounded-full w-24" /></td>
                <td className="py-3 px-3"><div className="h-6 bg-gray-100 rounded-full w-16" /></td>
                <td className="py-3 px-3 text-right"><div className="h-3.5 bg-gray-100 rounded w-16 ml-auto" /></td>
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
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/60">
            <th className="py-3 px-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-10">#</th>
            <th className="py-3 px-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
            <th className="py-3 px-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Category</th>
            <th className="py-3 px-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
            <th className="py-3 px-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn, idx) => {
            const isCredit = txn.type === "CREDIT";
            return (
              <tr key={txn.id || idx}
                className={`border-b border-gray-50 last:border-0 transition-colors ${isCredit ? "hover:bg-emerald-50/30" : "hover:bg-red-50/20"
                  }`}>
                {/* # */}
                <td className="py-3 px-3 text-xs text-gray-400 font-mono">
                  {idx + 1 + (transactionsMeta.number * TRANSACTIONS_PER_PAGE)}
                </td>

                {/* Name + date */}
                <td className="py-3 px-3">
                  <p className="font-semibold text-gray-800 text-sm leading-tight">
                    {txn.merchantName || "Transaction"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatTxnDate(txn.transactionDate)}
                  </p>
                </td>

                {/* Category pill */}
                <td className="py-3 px-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    {txn.categoryIcon || "💳"}
                    <span className="truncate max-w-[70px]">{txn.category || "Other"}</span>
                  </span>
                </td>

                {/* Type badge */}
                <td className="py-3 px-3">
                  <TypeBadge type={txn.type} />
                </td>

                {/* Amount */}
                <td className={`py-3 px-3 text-right font-bold text-sm ${isCredit ? "text-emerald-600" : "text-red-500"
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
};

// ─────────────────────────────────────────────────────────────────────────────
// Filters + Sort bar
// ─────────────────────────────────────────────────────────────────────────────
const FiltersBar = ({ filters, onChange }) => {
  // Handle sort change - convert to backend params
  const handleSortChange = (sortValue) => {
    let sortBy = "transactionDate";
    let sortDir = "DESC";

    switch (sortValue) {
      case "amount_asc":
        sortBy = "amount";
        sortDir = "ASC";
        break;
      case "amount_desc":
        sortBy = "amount";
        sortDir = "DESC";
        break;
      case "date_asc":
        sortBy = "transactionDate";
        sortDir = "ASC";
        break;
      case "date_desc":
      default:
        sortBy = "transactionDate";
        sortDir = "DESC";
        break;
    }

    onChange({
      ...filters,
      sort: sortValue,
      sortBy,
      sortDir,
      page: 0
    });
  };

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {/* Search */}
      <div className="relative flex-1 min-w-32">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={filters.search || ""}
          onChange={(e) => onChange({ ...filters, search: e.target.value, page: 0 })}
          placeholder="Search transactions"
          className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-gray-200 outline-none focus:border-[#6b7c3f] transition-all" />
      </div>

      {/* Category */}
      <select
        value={filters.category || ""}
        onChange={(e) => onChange({ ...filters, category: e.target.value, page: 0 })}
        className="text-xs px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-[#6b7c3f] bg-white">
        <option value="">All Categories</option>
        {TX_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>

      {/* Sort */}
      <select
        value={filters.sort || "date_desc"}
        onChange={(e) => handleSortChange(e.target.value)}
        className="text-xs px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-[#6b7c3f] bg-white">
        {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────────────────────────────────────
const Pagination = ({ page, totalPages, totalElements, onChange }) => {
  if (totalPages <= 1) return null;

  const start = Math.max(0, Math.min(page - 2, totalPages - 5));
  const visible = [];
  for (let i = start; i < Math.min(start + 5, totalPages); i++) visible.push(i);

  return (
    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
      <p className="text-xs text-gray-400">
        {totalElements} transaction{totalElements !== 1 ? "s" : ""}
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page === 0}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 text-sm">‹</button>

        {visible[0] > 0 && <>
          <button onClick={() => onChange(0)} className="w-7 h-7 flex items-center justify-center rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100">1</button>
          {visible[0] > 1 && <span className="text-gray-300 text-xs px-0.5">…</span>}
        </>}

        {visible.map((n) => (
          <button key={n} onClick={() => onChange(n)}
            className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-semibold transition-all ${page === n ? "bg-[#2c3347] text-white" : "text-gray-500 hover:bg-gray-100"
              }`}>{n + 1}</button>
        ))}

        {visible[visible.length - 1] < totalPages - 1 && <>
          {visible[visible.length - 1] < totalPages - 2 && <span className="text-gray-300 text-xs px-0.5">…</span>}
          <button onClick={() => onChange(totalPages - 1)}
            className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-semibold ${page === totalPages - 1 ? "bg-[#2c3347] text-white" : "text-gray-500 hover:bg-gray-100"
              }`}>{totalPages}</button>
        </>}

        <button onClick={() => onChange(page + 1)} disabled={page >= totalPages - 1}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 text-sm">›</button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
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
    syncing,
    syncTransactions,
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
    filters.page,
    filters.search,
    filters.category,
    filters.sortBy,
    filters.sortDir,
    hasLinkedCard,
    fetchTransactions
  ]);

  const flash = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const handleLinkCard = async (cardData) => {
    setCardLoading(true);
    setCardError(null);
    try {
      await linkCard(cardData);
      // Close form immediately
      setShowForm(false);
      // Refresh accounts to get the new card
      await fetchAccounts();
      // Fetch first page of transactions
      await fetchTransactions({ page: 0 });
      flash("Card linked! Transactions are being synced.");
    } catch (err) {
      setCardError(err.message || "Failed to link card. Please try again.");
    } finally {
      setCardLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Card visual */}
      {accountsLoading ? (
        <div className="w-full max-w-sm mx-auto h-44 bg-gray-100 rounded-2xl animate-pulse" />
      ) : (
        <CardVisual
          account={primaryAccount}
          onAddCard={() => {
            setShowForm(true);
            setCardError(null);
          }}
        />
      )}

      {/* Add card form - only show if no card AND form is open */}
      {!hasLinkedCard && showForm && (
        <AddCardForm
          onSubmit={handleLinkCard}
          onCancel={() => {
            setShowForm(false);
            setCardError(null);
          }}
          loading={cardLoading}
          error={cardError}
        />
      )}

      {/* Actions (card linked, form closed) */}
      {hasLinkedCard && !showForm && (
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => syncTransactions()}
            disabled={syncing}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#2c3347]
                       bg-[#2c3347]/5 hover:bg-[#2c3347]/10 rounded-lg transition-colors disabled:opacity-50">
            {syncing ? <><Spinner size="sm" color="#2c3347" /> Syncing…</> : <>↻ Sync transactions</>}
          </button>
        </div>
      )}

      {/* Success toast */}
      {successMsg && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100
                        rounded-xl px-3 py-2.5 text-xs text-emerald-700 font-medium">
          ✓ {successMsg}
        </div>
      )}

      {/* Transactions section - only show if card is linked */}
      {hasLinkedCard && !showForm && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-gray-800">Recent transactions</h4>
            {transactionsMeta.totalElements > 0 && (
              <span className="text-xs text-gray-400">{transactionsMeta.totalElements} transactions</span>
            )}
          </div>

          <FiltersBar filters={filters} onChange={setFilters} />

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <TxnTable
              transactions={transactions}
              loading={transactionsLoading}
              transactionsMeta={transactionsMeta}
            />
          </div>

          <Pagination
            page={filters.page}
            totalPages={transactionsMeta.totalPages}
            totalElements={transactionsMeta.totalElements}
            onChange={(p) => setFilters((f) => ({ ...f, page: p }))}
          />
        </div>
      )}

      {/* No card nudge - only show if no card AND form is not open */}
      {!hasLinkedCard && !accountsLoading && !showForm && (
        <p className="text-center text-xs text-gray-400 mt-1">
          Tap the card above to link your bank card and start tracking transactions.
        </p>
      )}
    </div>
  );
};

export default MyCardTab;