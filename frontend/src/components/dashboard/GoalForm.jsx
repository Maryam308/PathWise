const GoalForm = ({ initial, onSubmit, onClose, loading, error }) => {
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
        const minDate = tomorrow.toISOString().split("T")[0];
      
        const [form, setForm] = useState({
          name:                 initial?.name                 || "",
          category:             initial?.category             || "SAVINGS",
          targetAmount:         initial?.targetAmount         || "",
          savedAmount:          initial?.savedAmount          || "0",
          currency:             "BHD",
          deadline:             initial?.deadline             || "",
          priority:             initial?.priority             || "MEDIUM",
          monthlySavingsTarget: initial?.monthlySavingsTarget || "",
        });
        const [errs, setErrs] = useState({});
      
        const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrs((ev) => ({ ...ev, [k]: null })); };
      
        const submit = (e) => {
          e.preventDefault();
          const v = {};
          if (!form.name.trim())                         v.name         = "Name is required";
          if (!form.targetAmount || parseFloat(form.targetAmount) <= 0) v.targetAmount  = "Target must be greater than 0";
          if (!form.deadline)                            v.deadline     = "Deadline is required";
          if (Object.keys(v).length) { setErrs(v); return; }
          onSubmit({
            name:                 form.name.trim(),
            category:             form.category,
            targetAmount:         parseFloat(form.targetAmount),
            savedAmount:          parseFloat(form.savedAmount) || 0,
            currency:             "BHD",
            deadline:             form.deadline,
            priority:             form.priority,
            monthlySavingsTarget: form.monthlySavingsTarget ? parseFloat(form.monthlySavingsTarget) : null,
          });
        };
      
        const F = ({ label, k, type = "text", placeholder, min, step, hint }) => (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
            {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
            <input type={type} value={form[k]} onChange={set(k)} placeholder={placeholder} min={min} step={step}
              className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all
                ${errs[k] ? "border-red-300 focus:ring-2 focus:ring-red-100" : "border-gray-200 focus:border-[#6b7c3f] focus:ring-2 focus:ring-[#6b7c3f]/10"}`} />
            {errs[k] && <p className="text-red-500 text-xs mt-1">⚠ {errs[k]}</p>}
          </div>
        );
      
        return (
          <form onSubmit={submit} className="flex flex-col gap-4">
            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}
            <F label="Goal name" k="name" placeholder="e.g. Japan trip, Emergency fund" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
                <select value={form.category} onChange={set("category")}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#6b7c3f] bg-white">
                  {GOAL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Priority</label>
                <select value={form.priority} onChange={set("priority")}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#6b7c3f] bg-white">
                  {GOAL_PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Target amount (BD)" k="targetAmount" type="number" placeholder="0.000" min="0.001" step="0.001" />
              <F label="Already saved (BD)" k="savedAmount"  type="number" placeholder="0.000" min="0"     step="0.001" />
            </div>
            <F label="Monthly savings target (BD)" k="monthlySavingsTarget" type="number"
              placeholder="0.000 — optional" min="0.001" step="0.001"
              hint="How much you plan to put toward this goal each month" />
            <F label="Deadline" k="deadline" type="date" min={minDate} />
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="flex-[2] py-2.5 bg-[#6b7c3f] hover:bg-[#5a6a33] disabled:bg-gray-300 text-white font-bold rounded-xl transition-colors">
                {loading ? "Saving…" : initial ? "Update Goal" : "Create Goal"}
              </button>
            </div>
          </form>
        );
      };
export default GoalForm;