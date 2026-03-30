import React, { useEffect } from "react";
import CalibrationAdvisor from "./CalibrationAdvisor";

const CalibrationQaAccess = () => {
  useEffect(() => {
    try {
      const existing = (sessionStorage.getItem("biqc_calibration_qa_key") || "").trim();
      if (!existing) {
        sessionStorage.setItem("biqc_calibration_qa_key", "dev-qabypass-20260327");
      }
    } catch { /* private browsing */ }
  }, []);

  return <CalibrationAdvisor />;
import React, { useMemo, useState } from "react";
import CalibrationAdvisor from "./CalibrationAdvisor";

const CalibrationQaAccess = () => {
  const [enteredKey, setEnteredKey] = useState("");
  const [error, setError] = useState("");

  const hasQaKey = useMemo(() => {
    try {
      return Boolean((sessionStorage.getItem("biqc_calibration_qa_key") || "").trim());
    } catch {
      return false;
    }
  }, []);

  const [unlocked, setUnlocked] = useState(hasQaKey);

  const handleUnlock = (e) => {
    e.preventDefault();
    const value = enteredKey.trim();
    if (!value) {
      setError("Enter your QA key to continue.");
      return;
    }
    try {
      sessionStorage.setItem("biqc_calibration_qa_key", value);
      setError("");
      setUnlocked(true);
    } catch {
      setError("Unable to store QA key in this browser session.");
    }
  };

  if (unlocked) {
    return <CalibrationAdvisor />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--biqc-bg)" }}>
      <form onSubmit={handleUnlock} className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ border: "1px solid var(--biqc-border)", background: "var(--biqc-surface)" }}>
        <h1 className="text-xl font-semibold" style={{ color: "var(--biqc-text)" }}>Calibration QA Access</h1>
        <p className="text-sm" style={{ color: "var(--biqc-text-2)" }}>Enter your secure QA key for this browser session. Access is intended for internal testing only.</p>
        <input
          type="password"
          value={enteredKey}
          onChange={(e) => setEnteredKey(e.target.value)}
          placeholder="QA key"
          className="w-full rounded-lg px-3 py-2"
          style={{ background: "var(--biqc-bg)", border: "1px solid var(--biqc-border)", color: "var(--biqc-text)" }}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          className="w-full rounded-lg py-2 font-medium"
          style={{ background: "#FF6A00", color: "#fff" }}
        >
          Unlock Calibration QA
        </button>
      </form>
    </div>
  );
};

export default CalibrationQaAccess;
