import {
  CALIBRATION_FLOW_SEQUENCE,
  getNextCalibrationState,
  buildAbnIdentityMetadata,
  isValidAbn,
  mergeSocialSignals,
  normalizeAbn,
  SOCIAL_PLATFORMS,
} from "../calibrationForensics";

describe("calibrationForensics helpers", () => {
  test("validates ABN format deterministically", () => {
    expect(normalizeAbn("12 345 678 901")).toBe("12345678901");
    expect(isValidAbn("12 345 678 901")).toBe(true);
    expect(isValidAbn("1234")).toBe(false);
  });

  test("social merge prioritises perplexity then html then search", () => {
    const merged = mergeSocialSignals({
      perplexity: { linkedin: "linkedin.com/company/a", facebook: "" },
      html: { facebook: "facebook.com/a", instagram: "instagram.com/a" },
      search: { youtube: "youtube.com/@a", twitter: "x.com/a" },
    });
    expect(merged.linkedin).toBe("https://linkedin.com/company/a");
    expect(merged.facebook).toBe("https://facebook.com/a");
    expect(merged.instagram).toBe("https://instagram.com/a");
    expect(merged.twitter).toBe("https://x.com/a");
    expect(merged.youtube).toBe("https://youtube.com/@a");
    expect(merged.source).toBe("perplexity");
    expect(merged.social_status).toBe("verified");
  });

  test("social merge returns not_detected when none found", () => {
    const merged = mergeSocialSignals({ perplexity: {}, html: {}, search: {} });
    expect(merged.social_status).toBe("not_detected");
    for (const platform of SOCIAL_PLATFORMS) {
      expect(merged[platform]).toBe("");
    }
  });

  test("abn metadata maps found/multiple/not_found deterministically", () => {
    const found = buildAbnIdentityMetadata({
      lookupResult: { status: "found", legal_name: "Acme Pty Ltd", address: "Sydney" },
      abnInputDetected: true,
    });
    expect(found.abn_verified).toBe(true);
    expect(found.abn_status).toBe("verified");
    expect(found.abn_source).toBe("website");

    const multiple = buildAbnIdentityMetadata({
      lookupResult: { status: "ambiguous", suggestions: [{ abn: "123" }] },
      abnInputDetected: false,
    });
    expect(multiple.abn_verified).toBe(false);
    expect(multiple.abn_status).toBe("multiple");
    expect(multiple.abn_source).toBe("gud_api");

    const notFound = buildAbnIdentityMetadata({
      lookupResult: { status: "not_found" },
      abnInputDetected: false,
    });
    expect(notFound.abn_verified).toBe(false);
    expect(notFound.abn_status).toBe("not_found");
    expect(notFound.abn_source).toBe("gud_api");
  });

  test("state flow enforces sequential next states", () => {
    expect(getNextCalibrationState("abn_validation")).toBe("social_enrichment");
    expect(getNextCalibrationState("social_enrichment")).toBe("identity_verification");
    expect(getNextCalibrationState("wow_cards")).toBe("deep_narrative");
    expect(getNextCalibrationState("deep_narrative")).toBe("roadmap");
    expect(getNextCalibrationState("roadmap")).toBe("report_generation");
    expect(CALIBRATION_FLOW_SEQUENCE.includes("report_generation")).toBe(true);
  });
});
