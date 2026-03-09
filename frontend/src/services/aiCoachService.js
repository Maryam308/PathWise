
export const aiCoachService = {

  /**
   * Send a chat message to the AI coach.
   * Returns { message, role, timestamp }
   */
  chat: async (token, message) => {
    const res = await fetch("/api/ai-coach/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
    return data;
  },

  /**
   * Notify the backend that a goal action was completed via the wizard,
   * so it can inject a synthetic assistant turn into conversation history.
   * Non-fatal — failure is silently ignored.
   */
  notifyGoalAction: async (token, actionType, goalName) => {
    try {
      await fetch("/api/ai-coach/context-event", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ actionType, goalName }),
      });
    } catch { /* non-fatal */ }
  },
};