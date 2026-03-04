/**
 * useWizard
 *
 * Manages the goal-creation wizard state machine inside the AI Coach widget.
 * Extracted from AICoachWidget to separate business logic from rendering.
 */

import { useState, useCallback } from "react";
import {
  WIZARD_STEPS,
  GOAL_CATEGORIES,
  MONTHLY_AFFIRMATIVES,
  MONTHLY_NEGATIVES,
  CONFIRM_WORDS,
} from "../constants/goals.js";
import {
  calcDeadline,
  calcMonthlyNeeded,
  monthsUntil,
  isFutureDate,
  parseDateInput,
} from "../utils/goalCalculations.js";
import { formatBD } from "../utils/formatters.js";

const INITIAL_DRAFT = {
  name:                 "",
  category:             "",
  targetAmount:         "",
  savedAmount:          "0",
  deadline:             "",
  monthlySavingsTarget: "",
  priority:             "",
  currency:             "BHD",
};

// Levenshtein-based fuzzy match
const fuzzyMatch = (input, targets, maxDist = 2) => {
  const s = input.toLowerCase().trim();
  return targets.some((target) => {
    const dist = target.length <= 3 ? 1 : maxDist;
    if (Math.abs(s.length - target.length) > dist) return false;
    const dp = Array.from({ length: s.length + 1 }, (_, i) =>
      Array.from({ length: target.length + 1 }, (_, j) =>
        i === 0 ? j : j === 0 ? i : 0
      )
    );
    for (let i = 1; i <= s.length; i++)
      for (let j = 1; j <= target.length; j++)
        dp[i][j] =
          s[i - 1] === target[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    return dp[s.length][target.length] <= dist;
  });
};

const buildSummary = (draft, intro) => {
  const monthly   = draft.monthlySavingsTarget ? parseFloat(draft.monthlySavingsTarget) : null;
  const suggested = calcMonthlyNeeded(draft.targetAmount, draft.savedAmount, draft.deadline);
  const deadlineDisplay = draft.deadline
    ? new Date(draft.deadline).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : "Not set";
  return (
    `${intro}\n\n` +
    `📋 Name: ${draft.name}\n` +
    `📂 Category: ${draft.category}\n` +
    `💰 Target: ${formatBD(draft.targetAmount)}\n` +
    `✅ Already saved: ${formatBD(draft.savedAmount || 0)}\n` +
    `📅 Deadline: ${deadlineDisplay}\n` +
    `📈 Monthly savings: ${
      monthly
        ? formatBD(monthly)
        : suggested
        ? `${formatBD(suggested)} (recommended)`
        : "Not set"
    }\n` +
    `⚡ Priority: ${draft.priority || "Not set"}\n\n` +
    `Reply "confirm" to create, or tell me what to change (e.g. "name is Lexus Car").`
  );
};

export const useWizard = ({ addBotMessage, executeAction, financialSnapshot }) => {
  const [wizardStep, setWizardStep] = useState(WIZARD_STEPS.IDLE);
  const [goalDraft,  setGoalDraft]  = useState(INITIAL_DRAFT);

  const isActive = wizardStep !== WIZARD_STEPS.IDLE;

  const startWizard = useCallback(
    (categoryHint = null) => {
      setGoalDraft(INITIAL_DRAFT);
      setWizardStep(WIZARD_STEPS.NAME);
      addBotMessage(
        categoryHint
          ? `Great choice! Let's set up your ${categoryHint} goal 🎯\n\nWhat would you like to name this goal?`
          : "Let's create your goal step by step 🎯\n\nWhat would you like to name this goal?"
      );
    },
    [addBotMessage]
  );

  const cancelWizard = useCallback(() => {
    setWizardStep(WIZARD_STEPS.IDLE);
    setGoalDraft(INITIAL_DRAFT);
    addBotMessage("Goal creation cancelled.");
  }, [addBotMessage]);

  const handleInput = useCallback(
    (text) => {
      const t  = text.trim();
      const tl = t.toLowerCase();

      // ── NAME ────────────────────────────────────────────────────────────────
      if (wizardStep === WIZARD_STEPS.NAME) {
        if (!t) { addBotMessage("Please enter a name for your goal."); return; }
        const next = { ...goalDraft, name: t };
        setGoalDraft(next);
        setWizardStep(WIZARD_STEPS.CATEGORY);
        addBotMessage(`"${t}" — nice! 👍\n\nWhat category does it fall under?`);
        return;
      }

      // ── CATEGORY ─────────────────────────────────────────────────────────────
      if (wizardStep === WIZARD_STEPS.CATEGORY) {
        const match = GOAL_CATEGORIES.find(
          (c) =>
            c.value.toUpperCase() === t.toUpperCase() ||
            c.label.toLowerCase() === tl
        );
        if (!match) {
          addBotMessage("I didn't recognise that category. Please pick one from the options below.");
          return;
        }
        const next = { ...goalDraft, category: match.value };
        setGoalDraft(next);
        setWizardStep(WIZARD_STEPS.TARGET);
        addBotMessage(`${match.icon} ${match.label} — got it!\n\nWhat's your target amount in BD?`);
        return;
      }

      // ── TARGET ───────────────────────────────────────────────────────────────
      if (wizardStep === WIZARD_STEPS.TARGET) {
        const val = parseFloat(t);
        if (isNaN(val) || val <= 0) {
          addBotMessage("Please enter a valid amount greater than 0.");
          return;
        }
        const next = { ...goalDraft, targetAmount: val.toFixed(3) };
        setGoalDraft(next);
        setWizardStep(WIZARD_STEPS.SAVED);
        addBotMessage(
          `${formatBD(val)} — noted! 💰\n\nHow much have you already saved towards this? (Enter 0 if nothing yet)`
        );
        return;
      }

      // ── SAVED ────────────────────────────────────────────────────────────────
      if (wizardStep === WIZARD_STEPS.SAVED) {
        const val = parseFloat(t);
        if (isNaN(val) || val < 0) {
          addBotMessage("Please enter 0 or a positive amount.");
          return;
        }
        if (val >= parseFloat(goalDraft.targetAmount)) {
          addBotMessage(
            `That's already at or above your target of ${formatBD(goalDraft.targetAmount)}! ` +
            `Either increase your target or reduce the saved amount.`
          );
          return;
        }
        const next = { ...goalDraft, savedAmount: val.toFixed(3) };
        setGoalDraft(next);
        setWizardStep(WIZARD_STEPS.DEADLINE);
        const rem = parseFloat(next.targetAmount) - val;
        addBotMessage(
          `Got it — ${formatBD(rem)} left to go!\n\n` +
          `What's your deadline? (YYYY-MM, e.g. 2027-06)\n\n` +
          `You can also say things like "end of 2028", "June 2028", or "skip" if unsure.`
        );
        return;
      }

      // ── DEADLINE ─────────────────────────────────────────────────────────────
      if (wizardStep === WIZARD_STEPS.DEADLINE) {
        const dontKnow = ["idk","i don't know","i dont know","not sure","no idea","unsure","skip","n/a","no"]
          .some((k) => tl.includes(k));
        if (dontKnow) {
          setWizardStep(WIZARD_STEPS.MONTHLY);
          addBotMessage(
            "No problem! How much can you save per month in BD? I'll calculate the deadline automatically."
          );
          return;
        }
        const parsed = parseDateInput(t);
        if (!parsed) {
          addBotMessage(
            "I couldn't parse that date. Try formats like:\n" +
            "• 2028-06  or  06-2028\n" +
            "• June 2028  or  end of 2028\n\n" +
            `Or type "skip" if you don't have a deadline yet.`
          );
          return;
        }
        if (!isFutureDate(parsed)) {
          addBotMessage("⚠️ That date is in the past! Please enter a future date.");
          return;
        }
        const next      = { ...goalDraft, deadline: parsed };
        const months    = monthsUntil(parsed);
        const suggested = calcMonthlyNeeded(next.targetAmount, next.savedAmount, parsed);
        const display   = new Date(parsed).toLocaleDateString("en-GB", {
          month: "long", year: "numeric",
        });
        setGoalDraft(next);
        setWizardStep(WIZARD_STEPS.MONTHLY);
        addBotMessage(
          `📅 ${display} — that's ${months} month${months === 1 ? "" : "s"} away.\n\n` +
          (suggested
            ? `To reach your target by then, you'd need to save ${formatBD(suggested)}/month.\n\n` +
              `Would you like to use this? (Yes / enter a different amount / Skip)`
            : `How much can you set aside monthly? (Enter amount in BD or "skip")`)
        );
        return;
      }

      // ── MONTHLY ──────────────────────────────────────────────────────────────
      if (wizardStep === WIZARD_STEPS.MONTHLY) {
        const suggested = calcMonthlyNeeded(
          goalDraft.targetAmount,
          goalDraft.savedAmount,
          goalDraft.deadline
        );
        let monthly = null;

        if (fuzzyMatch(t, MONTHLY_AFFIRMATIVES)) {
          monthly = suggested;
        } else if (fuzzyMatch(t, MONTHLY_NEGATIVES)) {
          monthly = null;
        } else {
          const val = parseFloat(t);
          if (isNaN(val) || val <= 0) {
            addBotMessage(
              `Enter an amount in BD, "Yes" to use ${
                suggested ? formatBD(suggested) : "the suggested amount"
              }, or "Skip".`
            );
            return;
          }
          monthly = val.toFixed(3);
        }

        if (monthly) {
          const rem = parseFloat(goalDraft.targetAmount) - parseFloat(goalDraft.savedAmount || 0);
          if (parseFloat(monthly) >= rem) {
            addBotMessage(
              `⚠️ ${formatBD(monthly)}/month is ≥ the remaining balance of ${formatBD(rem)}. ` +
              `Please enter a lower amount or type "skip".`
            );
            return;
          }
          const { disposableIncome, totalMonthlyCommitment } = financialSnapshot;
          if (disposableIncome != null) {
            const available = disposableIncome - totalMonthlyCommitment;
            if (parseFloat(monthly) > available) {
              addBotMessage(
                `⚠️ ${formatBD(monthly)}/month exceeds your available budget of ${formatBD(available)}. ` +
                `Please enter a lower amount or type "skip".`
              );
              return;
            }
          }
        }

        const next = { ...goalDraft, monthlySavingsTarget: monthly };
        setGoalDraft(next);
        setWizardStep(WIZARD_STEPS.PRIORITY);
        addBotMessage(
          monthly
            ? `${formatBD(monthly)}/month — great plan! 📈\n\nLast step: what's the priority for this goal?\n\n🔴 High   🟡 Medium   ⚪ Low`
            : `No monthly target set — you can always add one later.\n\nLast step: what's the priority?\n\n🔴 High   🟡 Medium   ⚪ Low`
        );
        return;
      }

      // ── PRIORITY ─────────────────────────────────────────────────────────────
      // Only accept explicit HIGH / MEDIUM / LOW — "ok" etc. must NOT default.
      if (wizardStep === WIZARD_STEPS.PRIORITY) {
        const upper = tl.trim();
        const priority =
          upper === "high"   || upper === "h" || upper === "high priority" ? "HIGH"   :
          upper === "medium" || upper === "m" || upper === "med"           ? "MEDIUM" :
          upper === "low"    || upper === "l" || upper === "low priority"  ? "LOW"    :
          ["HIGH","MEDIUM","LOW"].includes(t.toUpperCase()) ? t.toUpperCase() :
          null;

        if (!priority) {
          addBotMessage(
            "Please choose a priority — tap one of the buttons above or type:\n\n" +
            "🔴 High   🟡 Medium   ⚪ Low"
          );
          return;
        }
        const next = { ...goalDraft, priority };
        setGoalDraft(next);
        setWizardStep(WIZARD_STEPS.CONFIRM);
        addBotMessage(buildSummary(next, "Here's your goal summary — does everything look correct?"));
        return;
      }

      // ── CONFIRM ──────────────────────────────────────────────────────────────
      if (wizardStep === WIZARD_STEPS.CONFIRM) {
        if (fuzzyMatch(tl, CONFIRM_WORDS)) {
          let deadline = goalDraft.deadline;
          if (!deadline && goalDraft.monthlySavingsTarget) {
            deadline = calcDeadline(
              goalDraft.targetAmount,
              goalDraft.savedAmount,
              goalDraft.monthlySavingsTarget
            );
          }
          if (deadline) {
            const parts = deadline.split("-");
            if (parts.length === 3) deadline = `${parts[0]}-${parts[1]}`;
          }
          if (!deadline) {
            addBotMessage(
              `⚠️ I need a deadline. When would you like to reach this goal?\n\n` +
              `You can say "end of 2028", "June 2029", or set a monthly amount and I'll calculate it.`
            );
            setWizardStep(WIZARD_STEPS.DEADLINE);
            return;
          }
          executeAction({
            type: "CREATE_GOAL",
            data: {
              ...goalDraft,
              deadline,
              targetAmount:         parseFloat(goalDraft.targetAmount),
              savedAmount:          parseFloat(goalDraft.savedAmount) || 0,
              monthlySavingsTarget: goalDraft.monthlySavingsTarget
                ? parseFloat(goalDraft.monthlySavingsTarget)
                : null,
            },
          });
          return;
        }

        if (tl.includes("cancel") || tl.includes("stop") || tl.includes("abort") || tl === "no") {
          setWizardStep(WIZARD_STEPS.IDLE);
          setGoalDraft(INITIAL_DRAFT);
          addBotMessage("No problem — goal creation cancelled. What else can I help you with?");
          return;
        }

        // Smart inline edits at confirm step
        let updated = { ...goalDraft };
        const changed  = [];

        const isName     = tl.includes("name") || tl.includes("rename") || tl.includes("call it");
        const isCategory = tl.includes("categ");
        const isMonthly  = tl.includes("monthly") || tl.includes("per month") || tl.includes("each month");
        const isDeadline =
          !isMonthly &&
          (tl.includes("deadline") || tl.includes("due date") ||
            /\b\d{4}\b/.test(tl) ||
            /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/.test(tl));
        const isSaved    = tl.includes("saved") || tl.includes("already saved");
        const isTarget   = !isSaved && (tl.includes("target") || (tl.includes("amount") && !tl.includes("saved")));
        const isPriority = tl.includes("priority");

        if (isName) {
          const after = t.match(/\b(?:to|is|be|:)\s+(.+)/i);
          const newName = after
            ? after[1].trim()
            : t.replace(/\b(change|rename|update|set|edit|fix|the|name|call|it|goal|please)\b/gi, "")
               .replace(/\s+/g, " ").trim();
          if (newName) { updated.name = newName; changed.push(`Name → "${newName}"`); }
        }
        if (isCategory) {
          const match = GOAL_CATEGORIES.find(
            (c) => tl.includes(c.value.toLowerCase()) || tl.includes(c.label.toLowerCase())
          );
          if (match) { updated.category = match.value; changed.push(`Category → ${match.icon} ${match.label}`); }
        }
        if (isTarget) {
          const num = t.match(/[\d,]+\.?\d*/);
          if (num) {
            const val = parseFloat(num[0].replace(/,/g, ""));
            if (!isNaN(val) && val > 0) {
              updated.targetAmount = val.toFixed(3);
              changed.push(`Target → ${formatBD(val)}`);
            }
          }
        }
        if (isSaved) {
          const num = t.match(/[\d,]+\.?\d*/);
          if (num) {
            const val = parseFloat(num[0].replace(/,/g, ""));
            if (!isNaN(val) && val >= 0) {
              if (val >= parseFloat(updated.targetAmount)) {
                addBotMessage(`❌ Already saved (${formatBD(val)}) can't be ≥ target (${formatBD(updated.targetAmount)}).`);
                return;
              }
              updated.savedAmount = val.toFixed(3);
              changed.push(`Already saved → ${formatBD(val)}`);
            }
          }
        }
        if (isDeadline) {
          const parsed = parseDateInput(t);
          if (parsed) {
            if (!isFutureDate(parsed)) { addBotMessage("⚠️ That date is in the past."); return; }
            updated.deadline = parsed;
            changed.push(
              `Deadline → ${new Date(parsed).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`
            );
          }
        }
        if (isMonthly) {
          const num = t.match(/[\d,]+\.?\d*/);
          if (num) {
            const val = parseFloat(num[0].replace(/,/g, ""));
            if (!isNaN(val) && val > 0) {
              const rem = parseFloat(updated.targetAmount) - parseFloat(updated.savedAmount || 0);
              if (val >= rem) {
                addBotMessage(`⚠️ ${formatBD(val)}/month is ≥ the remaining balance of ${formatBD(rem)}.`);
                return;
              }
              updated.monthlySavingsTarget = val.toFixed(3);
              changed.push(`Monthly → ${formatBD(val)}`);
            }
          }
        }
        if (isPriority) {
          const p =
            tl.includes("high") ? "HIGH" :
            tl.includes("low")  ? "LOW"  :
            tl.includes("med")  ? "MEDIUM" :
            null;
          if (p) { updated.priority = p; changed.push(`Priority → ${p}`); }
        }

        if (changed.length > 0) {
          setGoalDraft(updated);
          addBotMessage(buildSummary(updated, `✅ Updated: ${changed.join(" · ")}\n\nHere's your updated summary:`));
          return;
        }

        addBotMessage(
          `I can update any field — just tell me what to change, like:\n\n` +
          `• "name is Lexus Car"\n• "change target to 10000"\n• "deadline June 2028"\n` +
          `• "monthly is 300"\n• "priority high"\n\n` +
          `Or reply "confirm" to create, or "cancel" to start over.`
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wizardStep, goalDraft, addBotMessage, executeAction, financialSnapshot]
  );

  return {
    wizardStep,
    setWizardStep,
    goalDraft,
    setGoalDraft,
    isActive,
    startWizard,
    cancelWizard,
    handleInput,
    INITIAL_DRAFT,
  };
};