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
};

export default CalibrationQaAccess;
