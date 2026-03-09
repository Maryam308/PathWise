import { apiFetch } from "./apiClient.js";

export const aiCoachService = {

  chat: async (token, message) => {
    const res = await apiFetch("/api/ai-coach/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message }),
    });
    if (!res) return;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
    return data;
  },

  // Non-fatal — failure is silently ignored
  notifyGoalAction: async (token, actionType, goalName) => {
    try {
      await apiFetch("/api/ai-coach/context-event", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ actionType, goalName }),
      });
    } catch { /* non-fatal */ }
  },
};