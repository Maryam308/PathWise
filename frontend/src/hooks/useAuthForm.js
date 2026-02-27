import { useState } from "react";

export const useAuthForm = (initialValues) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    // clear field error on change
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    if (serverError) setServerError("");
  };

  const validate = (rules) => {
    const newErrors = {};
    for (const [field, ruleFns] of Object.entries(rules)) {
      for (const rule of ruleFns) {
        const error = rule(values[field], values);
        if (error) {
          newErrors[field] = error;
          break;
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return { values, errors, loading, serverError, setLoading, setServerError, handleChange, validate };
};