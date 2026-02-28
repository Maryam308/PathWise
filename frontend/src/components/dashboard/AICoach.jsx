const AICoach = ({ token }) => {
   const [messages, setMessages] = useState([]);
   const [input, setInput] = useState("");
   const [loading, setLoading] = useState(false);
   const [weeklyLoading, setWeeklyLoading] = useState(false);
   const bottomRef = useRef(null);

   useEffect(() => {
     bottomRef.current?.scrollIntoView({ behavior: "smooth" });
   }, [messages]);

   const push = (msg) => setMessages((m) => [...m, msg]);

   const send = async (text) => {
     const msg = (text || input).trim();
     if (!msg || loading) return;
     setInput("");
     push({ role: "user", content: msg });
     setLoading(true);
     try {
       const data = await aiService.chat(token, msg);
       push({ role: "assistant", content: data.message });
     } catch (e) {
       push({ role: "error", content: e.message });
     } finally { setLoading(false); }
   };

   const getAdvice = async () => {
     setWeeklyLoading(true);
     try {
       const data = await aiService.getWeeklyAdvice(token);
       push({ role: "assistant", content: `📋 **Weekly Check-in**\n\n${data.message}` });
     } catch (e) {
       push({ role: "error", content: e.message });
     } finally { setWeeklyLoading(false); }
   };

   const QUICK = ["What's my savings rate?", "Am I on track for my goals?", "How can I save faster?"];

   return (
     <div className="flex flex-col h-full">
       {/* Header */}
       <div className="flex items-center justify-between mb-4 shrink-0">
         <div className="flex items-center gap-2.5">
           <div className="w-9 h-9 bg-[#6b7c3f] rounded-full flex items-center justify-center text-white text-base">🤖</div>
           <div>
             <p className="text-sm font-bold text-gray-900 leading-tight">PathWise AI Coach</p>
             <p className="text-xs text-gray-400">Bahrain-focused · Powered by Groq</p>
           </div>
         </div>
         <button onClick={getAdvice} disabled={weeklyLoading}
           className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#f5f7f0] text-[#5a6a33]
             hover:bg-[#e8edd4] disabled:opacity-50 transition-colors">
           {weeklyLoading ? "Loading…" : "📋 Weekly tips"}
         </button>
       </div>

       {/* Messages */}
       <div className="flex-1 overflow-y-auto space-y-3 min-h-0 mb-3 pr-1">
         {messages.length === 0 && (
           <div className="flex flex-col items-center justify-center h-full text-center py-8 gap-4">
             <div className="w-14 h-14 bg-[#f5f7f0] rounded-full flex items-center justify-center text-3xl">💬</div>
             <div>
               <p className="text-sm font-semibold text-gray-700">Ask me anything</p>
               <p className="text-xs text-gray-400 mt-1">Your goals, savings rate, or financial plan</p>
             </div>
             <div className="flex flex-col gap-2 w-full max-w-xs mt-1">
               {QUICK.map((q) => (
                 <button key={q} onClick={() => send(q)}
                   className="text-xs px-3 py-2 rounded-lg bg-[#f5f7f0] text-[#5a6a33] hover:bg-[#e8edd4] text-left transition-colors">
                   {q}
                 </button>
               ))}
             </div>
           </div>
         )}

         {messages.map((m, i) => (
           <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
             <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed
               ${m.role === "user"
                 ? "bg-[#6b7c3f] text-white rounded-br-sm"
                 : m.role === "error"
                 ? "bg-red-50 text-red-700 border border-red-200 rounded-bl-sm"
                 : "bg-gray-50 text-gray-800 border border-gray-100 rounded-bl-sm"
               }`}>
               {m.content}
             </div>
           </div>
         ))}

         {loading && (
           <div className="flex justify-start">
             <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
               <div className="flex gap-1 items-center h-4">
                 {[0,1,2].map((i) => (
                   <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                     style={{ animationDelay: `${i * 150}ms` }} />
                 ))}
               </div>
             </div>
           </div>
         )}
         <div ref={bottomRef} />
       </div>

       {/* Input */}
       <div className="flex gap-2 shrink-0">
         <input value={input} onChange={(e) => setInput(e.target.value)}
           onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && !loading && send()}
           placeholder="Ask your AI coach…"
           className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none
             focus:border-[#6b7c3f] focus:ring-2 focus:ring-[#6b7c3f]/10" />
         <button onClick={() => send()} disabled={loading || !input.trim()}
           className="w-10 h-10 bg-[#6b7c3f] rounded-xl flex items-center justify-center text-white
             hover:bg-[#5a6a33] disabled:bg-gray-200 disabled:text-gray-400 transition-colors shrink-0">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
             <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
           </svg>
         </button>
       </div>
     </div>
   );
 };

export default AICoach;