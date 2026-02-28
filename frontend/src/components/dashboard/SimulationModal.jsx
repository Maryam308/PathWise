const SimulationModal = ({ goal, token, onClose }) => {
   const [currentRate, setCurrentRate] = useState(goal.monthlySavingsTarget || "");
   const [cuts, setCuts] = useState(Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.key, ""])));
   const [result, setResult] = useState(null);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState("");

   const run = async () => {
     const r = parseFloat(currentRate);
     if (!r || r <= 0) { setError("Enter your current monthly savings rate first"); return; }
     const spendingAdjustments = {};
     EXPENSE_CATEGORIES.forEach(({ key }) => {
       const v = parseFloat(cuts[key]);
       if (v > 0) spendingAdjustments[key] = v;
     });
     if (Object.keys(spendingAdjustments).length === 0) {
       setError("Enter at least one spending cut to simulate"); return;
     }
     setLoading(true); setError("");
     try {
       setResult(await goalService.simulate(token, {
         goalId: goal.id,
         currentMonthlySavingsTarget: r,
         spendingAdjustments,
       }));
     } catch (e) { setError(e.message); }
     finally { setLoading(false); }
   };

   return (
     <Modal title={`Simulate — ${goal.name}`} onClose={onClose} wide>
       <div className="flex flex-col gap-4">
         <p className="text-sm text-gray-500">
           See how cutting specific expenses would accelerate your goal timeline.
         </p>

         {/* Current rate */}
         <div>
           <label className="block text-sm font-semibold text-gray-700 mb-1">Current monthly savings rate (BD)</label>
           <div className="relative">
             <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">BD</span>
             <input type="number" value={currentRate} onChange={(e) => setCurrentRate(e.target.value)}
               placeholder="e.g. 200.000" min="0.001" step="0.001"
               className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#6b7c3f] focus:ring-2 focus:ring-[#6b7c3f]/10" />
           </div>
         </div>

         {/* Spending cuts */}
         <div>
           <p className="text-sm font-semibold text-gray-700 mb-2">What if you cut spending in these categories?</p>
           <p className="text-xs text-gray-400 mb-3">Enter how much you could free up per month from each category.</p>
           <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
             {EXPENSE_CATEGORIES.map(({ key, label, icon }) => (
               <div key={key} className={`rounded-xl border p-2.5 transition-all
                 ${parseFloat(cuts[key]) > 0 ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-gray-50"}`}>
                 <div className="flex items-center gap-1.5 mb-1.5">
                   <span className="text-sm">{icon}</span>
                   <p className="text-xs font-semibold text-gray-700 truncate">{label}</p>
                 </div>
                 <div className="relative">
                   <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">BD</span>
                   <input type="number" value={cuts[key]} onChange={(e) => setCuts((c) => ({ ...c, [key]: e.target.value }))}
                     placeholder="0" step="0.001" min="0"
                     className="w-full pl-7 pr-2 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-blue-400" />
                 </div>
               </div>
             ))}
           </div>
         </div>

         {error && <p className="text-red-500 text-sm">⚠ {error}</p>}

         <button onClick={run} disabled={loading}
           className="w-full py-3 bg-[#6b7c3f] text-white font-bold rounded-xl hover:bg-[#5a6a33] disabled:bg-gray-300 transition-colors">
           {loading ? "Simulating…" : "🔮 Run Simulation"}
         </button>

         {result && (
           <div className="flex flex-col gap-3">
             {/* Comparison cards */}
             <div className="grid grid-cols-2 gap-3">
               <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-200">
                 <p className="text-xs text-gray-500 font-medium mb-1">Baseline</p>
                 <p className="font-black text-gray-800">{result.baselineCompletionDate}</p>
                 <p className="text-xs text-gray-400">{result.baselineMonths} months</p>
                 <p className="text-xs text-gray-500 mt-1">{fmt(result.currentMonthlySavingsTarget)}/mo</p>
               </div>
               <div className="bg-[#f5f7f0] rounded-xl p-3 text-center border border-[#d4ddb8]">
                 <p className="text-xs text-[#5a6a33] font-medium mb-1">With Cuts</p>
                 <p className="font-black text-[#3d4f22]">{result.simulatedCompletionDate}</p>
                 <p className="text-xs text-[#5a6a33]">{result.simulatedMonths} months</p>
                 <p className="text-xs text-[#5a6a33] mt-1">{fmt(result.simulatedMonthlySavingsTarget)}/mo</p>
               </div>
             </div>

             {result.monthsSaved > 0 && (
               <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                 <p className="font-bold text-emerald-700 text-lg">
                   🎉 {result.monthsSaved} month{result.monthsSaved !== 1 ? "s" : ""} sooner!
                 </p>
                 <p className="text-sm text-emerald-600 mt-0.5">
                   Cutting {fmt(result.totalAdjustment)}/mo frees up significant savings capacity.
                 </p>
               </div>
             )}

             {result.affordabilityNote && (
               <div className="bg-[#f5f7f0] border border-[#d4ddb8] rounded-xl p-3">
                 <p className="text-sm text-[#3d4f22]">💡 {result.affordabilityNote}</p>
               </div>
             )}

             <WarningBanner level={result.warningLevel} message={null} />
           </div>
         )}
       </div>
     </Modal>
   );
 };
export default SimulationModal;