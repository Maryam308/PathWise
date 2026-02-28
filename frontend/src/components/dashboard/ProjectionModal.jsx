const ProjectionModal = ({ goal, token, onClose }) => {
   const [rate, setRate] = useState(goal.monthlySavingsTarget || "");
   const [result, setResult] = useState(null);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState("");

   const run = async () => {
     const r = parseFloat(rate);
     if (!r || r <= 0) { setError("Enter a monthly savings rate greater than 0"); return; }
     setLoading(true); setError("");
     try { setResult(await goalService.getProjection(token, goal.id, r)); }
     catch (e) { setError(e.message); }
     finally { setLoading(false); }
   };

   return (
     <Modal title={`Projection — ${goal.name}`} onClose={onClose}>
       <div className="flex flex-col gap-4">
         <p className="text-sm text-gray-500">
           Enter how much you plan to save toward this goal each month, and we'll calculate your timeline.
         </p>

         <div className="flex gap-2">
           <div className="relative flex-1">
             <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">BD</span>
             <input type="number" value={rate} onChange={(e) => setRate(e.target.value)}
               placeholder="e.g. 200.000" min="0.001" step="0.001"
               className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#6b7c3f] focus:ring-2 focus:ring-[#6b7c3f]/10" />
           </div>
           <button onClick={run} disabled={loading}
             className="px-5 py-2.5 bg-[#6b7c3f] text-white font-bold rounded-xl hover:bg-[#5a6a33] disabled:bg-gray-300 text-sm whitespace-nowrap">
             {loading ? "…" : "Calculate"}
           </button>
         </div>
         {error && <p className="text-red-500 text-sm">⚠ {error}</p>}

         {result && (
           <div className="flex flex-col gap-3">
             {/* Status */}
             <div className={`rounded-xl p-4 border ${result.isOnTrack
               ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
               <p className={`font-bold mb-2 ${result.isOnTrack ? "text-emerald-700" : "text-amber-700"}`}>
                 {result.isOnTrack ? "✅ On track" : "⚠️ Behind schedule"}
               </p>
               <div className="grid grid-cols-2 gap-y-1 text-sm text-gray-600">
                 <span>Projected completion</span>
                 <span className="font-semibold text-gray-800">{result.projectedCompletionDate}</span>
                 <span>Goal deadline</span>
                 <span className="font-semibold text-gray-800">{result.goalDeadline}</span>
                 <span>Months needed</span>
                 <span className="font-semibold text-gray-800">{result.monthsNeeded}</span>
                 <span>{result.monthsAheadOrBehind >= 0 ? "Months ahead" : "Months behind"}</span>
                 <span className={`font-semibold ${result.monthsAheadOrBehind >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                   {Math.abs(result.monthsAheadOrBehind)}
                 </span>
               </div>
             </div>

             {/* Affordability */}
             {result.affordabilityNote && (
               <div className="bg-[#f5f7f0] border border-[#d4ddb8] rounded-xl p-3">
                 <p className="text-sm text-[#3d4f22]">💡 {result.affordabilityNote}</p>
               </div>
             )}

             {/* Financial warning */}
             <WarningBanner level={result.warningLevel} message={result.warningMessage} />
           </div>
         )}
       </div>
     </Modal>
   );
 };
export default ProjectionModal;