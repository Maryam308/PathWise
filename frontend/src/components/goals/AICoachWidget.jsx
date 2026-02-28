import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../context/AuthContext.jsx";

const API_BASE = import.meta.env.VITE_BACKEND_URL;

const AICoachWidget = () => {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      // Welcome message
      setMessages([
        {
          role: "assistant",
          content: "Hi! I'm your PathWise AI Coach 👋 Ask me anything about your goals, savings strategy, or financial planning.",
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Hide tooltip after 4s
  useEffect(() => {
    const t = setTimeout(() => setShowTooltip(false), 4000);
    return () => clearTimeout(t);
  }, []);

  const sendMessage = async () => {
    const msg = input.trim();
    if (!msg || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg, timestamp: new Date().toISOString() }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "AI unavailable");
      setMessages((prev) => [...prev, { role: "assistant", content: data.message, timestamp: data.timestamp }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I'm having trouble connecting. Please try again shortly.", timestamp: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (ts) =>
    ts ? new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Chat window */}
      {open && (
        <div className="w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300" style={{ height: "480px" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-[#2c3347] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#6b7c3f] rounded-xl flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" fill="white" />
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-sm">PathWise AI Coach</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                  <span className="text-emerald-400 text-xs font-medium">Online</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 bg-gray-50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2`}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 bg-[#6b7c3f] rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" fill="white" />
                    </svg>
                  </div>
                )}
                <div className="max-w-[75%]">
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#2c3347] text-white rounded-tr-sm"
                        : "bg-white text-gray-700 rounded-tl-sm shadow-sm border border-gray-100"
                    }`}
                  >
                    {msg.content}
                  </div>
                  <p className="text-xs text-gray-300 mt-1 px-1">{formatTime(msg.timestamp)}</p>
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 bg-gray-200 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-[#6b7c3f] rounded-lg flex items-center justify-center shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" fill="white" />
                  </svg>
                </div>
                <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm border border-gray-100 flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 bg-white border-t border-gray-100 flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type your message here..."
              className="flex-1 text-sm text-gray-700 placeholder-gray-300 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#6b7c3f] focus:ring-2 focus:ring-[#6b7c3f]/10 transition-all"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="w-9 h-9 bg-[#6b7c3f] hover:bg-[#5a6a33] disabled:bg-gray-200 rounded-xl flex items-center justify-center transition-all shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M22 2L11 13" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M22 2L15 22 11 13 2 9l20-7z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Tooltip */}
      {!open && showTooltip && (
        <div className="bg-[#2c3347] text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-lg animate-in fade-in duration-300">
          <p>PathWise AI Coach</p>
          <p className="text-gray-400 font-normal">Ask me anything about your goals!</p>
          <div className="absolute -bottom-1.5 right-5 w-3 h-3 bg-[#2c3347] rotate-45" />
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => { setOpen((o) => !o); setShowTooltip(false); }}
        className="w-14 h-14 bg-[#2c3347] hover:bg-[#3d4357] rounded-full flex items-center justify-center shadow-xl hover:shadow-2xl transition-all duration-200 hover:-translate-y-0.5"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" fill="white" />
          </svg>
        )}
      </button>
    </div>
  );
};

export default AICoachWidget;