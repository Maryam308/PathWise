/**
 * useGoalForm
 *
 * Encapsulates all form state, derived values, and validation logic
 * for the GoalModal.  The component becomes a pure renderer.
 */

import { useState, useEffect, useMemo } from "react";
import {
  calcDeadline,
  monthsUntil,
  monthToLastDay,
  dateToMonth,
  minDeadlineMonth,
} from "../utils/goalCalculations.js";

const EMPTY = {
  name:                 "",
  category:             "CUSTOM",
  targetAmount:         "",
  savedAmount:          "",
  monthlySavingsTarget: "",
  currency:             "BHD",
  deadline:             "",
  priority:             "MEDIUM",
  deadlineMode:         "manual", // "manual" | "calculated"
};

const inferMonthly = (targetAmount, savedAmount, deadline) => {
  const months = monthsUntil(deadline);
  if (!months || months <= 0) return null;
  const rem = (parseFloat(targetAmount) || 0) - (parseFloat(savedAmount) || 0);
  if (rem <= 0) return null;
  return (rem / months).toFixed(3);
};

export const useGoalForm = ({ isOpen, editingGoal, maxAllocatable }) => {
  const [form,   setForm]   = useState(EMPTY);
  const [errors, setErrors] = useState({});

  // ── Reset on open ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    if (editingGoal) {
      setForm({
        name:                 editingGoal.name                || "",
        category:             editingGoal.category            || "CUSTOM",
        targetAmount:         editingGoal.targetAmount        || "",
        savedAmount:          editingGoal.savedAmount         || "",
        monthlySavingsTarget: editingGoal.monthlySavingsTarget || "",
        currency:             editingGoal.currency            || "BHD",
        deadline:             dateToMonth(editingGoal.deadline) || "",
        priority:             editingGoal.priority            || "MEDIUM",
        deadlineMode:         "manual",
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
  }, [editingGoal, isOpen]);

  // ── Auto-calculate deadline in "calculated" mode ───────────────────────────
  useEffect(() => {
    if (form.deadlineMode !== "calculated") return;
    const suggested = calcDeadline(
      form.targetAmount,
      form.savedAmount,
      form.monthlySavingsTarget
    );
    if (suggested) {
      setForm((prev) => ({ ...prev, deadline: suggested.slice(0, 7) }));
    }
  }, [form.targetAmount, form.savedAmount, form.monthlySavingsTarget, form.deadlineMode]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const deadlineFull    = monthToLastDay(form.deadline); // YYYY-MM-DD
  const monthsLeft      = monthsUntil(deadlineFull);
  const inferredMonthly = useMemo(() => {
    if (form.monthlySavingsTarget) return null;
    return inferMonthly(form.targetAmount, form.savedAmount, deadlineFull);
  }, [form.targetAmount, form.savedAmount, form.deadline, form.monthlySavingsTarget]); // eslint-disable-line

  const remaining    = (parseFloat(form.targetAmount) || 0) - (parseFloat(form.savedAmount) || 0);
  const progressPct  = form.targetAmount > 0 && form.savedAmount
    ? Math.min(100, (parseFloat(form.savedAmount) / parseFloat(form.targetAmount)) * 100)
    : 0;

  const showSummary =
    Boolean(form.name) &&
    parseFloat(form.targetAmount) > 0 &&
    form.deadline >= minDeadlineMonth();

  // ── Field change ───────────────────────────────────────────────────────────
  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));

    // Live cap enforcement for monthly target
    if (field === "monthlySavingsTarget" && maxAllocatable !== null) {
      if (parseFloat(value) > maxAllocatable) {
        setErrors((prev) => ({
          ...prev,
          monthlySavingsTarget: `Max available is BD ${maxAllocatable.toFixed(3)}`,
        }));
      }
    }
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = () => {
    const e        = {};
    const target   = parseFloat(form.targetAmount);
    const saved    = parseFloat(form.savedAmount);
    const monthly  = parseFloat(form.monthlySavingsTarget);
    const today_ym = dateToMonth(new Date().toISOString());

    if (!form.name.trim())
      e.name = "Goal name is required";

    if (!form.targetAmount || isNaN(target) || target <= 0)
      e.targetAmount = "Enter a valid target amount greater than 0";

    if (form.savedAmount !== "" && (isNaN(saved) || saved < 0))
      e.savedAmount = "Already saved must be 0 or more";

    if (form.savedAmount !== "" && !isNaN(saved) && !isNaN(target) && saved > target)
      e.savedAmount = "Amount saved cannot exceed the target amount";

    if (!form.deadline)
      e.deadline = "Deadline is required";
    else if (form.deadline <= today_ym)
      e.deadline = "Deadline must be in the future";

    if (form.monthlySavingsTarget !== "" && (isNaN(monthly) || monthly <= 0))
      e.monthlySavingsTarget = "Monthly savings must be greater than 0";

    if (
      form.monthlySavingsTarget !== "" &&
      !isNaN(monthly) &&
      maxAllocatable !== null &&
      monthly > maxAllocatable
    )
      e.monthlySavingsTarget = `Exceeds your available budget. Maximum: BD ${maxAllocatable.toFixed(3)}`;

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Build submission payload ───────────────────────────────────────────────
  const buildPayload = () => ({
    name:                 form.name.trim(),
    category:             form.category,
    targetAmount:         parseFloat(form.targetAmount),
    savedAmount:          parseFloat(form.savedAmount) || 0,
    monthlySavingsTarget: form.monthlySavingsTarget
      ? parseFloat(form.monthlySavingsTarget)
      : inferredMonthly
      ? parseFloat(inferredMonthly)
      : null,
    currency:             form.currency,
    deadline:             monthToLastDay(form.deadline),
    priority:             form.priority,
  });

  return {
    form,
    errors,
    handleChange,
    validate,
    buildPayload,
    // Derived
    inferredMonthly,
    monthsLeft,
    remaining,
    progressPct,
    showSummary,
    deadlineFull,
  };
};