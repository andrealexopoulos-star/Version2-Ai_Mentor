# Live Forensic Validation — biqc.ai
Date: 2026-03-20 (16:13 UTC)  
Environment tested: **live production URL** `https://biqc.ai`

---

## 1) Scope executed

This live run focused on:
1. Calibration entry and progression integrity  
2. CMO report reachability and detail generation  
3. Competitor intelligence runtime behavior (UI + API)

Accounts tested:
- `auto10x_20260320_093459_01@biqctest.io`
- `auto10x_20260320_093459_02@biqctest.io`
- `auto10x_20260320_093459_03@biqctest.io`

Evidence root:
- `/workspace/.screenshots/deep_calibration_probe_20260320_154901/`
- JSON evidence: `/workspace/.screenshots/deep_calibration_probe_20260320_154901/deep_probe_results.json`

---

## 2) Hard outcomes

From the completed deep probe:
- `accounts_tested = 3`
- `cmo_report_reached = 0`
- `cmo_snapshot_reached = 0`

Per account, calibration page URL was reached (`entry_url` showed `/calibration`) but no handshake input or analyzing/identity stages appeared.

---

## 3) Calibration forensic scoring (live)

| Calibration item | Live score | Evidence |
|---|---:|---|
| `/calibration` route reachable | 5/10 | `entry_url` is `/calibration` for all 3 accounts |
| Welcome website input present (`website-url-input`) | 1/10 | `has_welcome_website_input=false` on all 3 |
| Analyzing state present | 1/10 | `has_analyzing_state=false` on all 3 |
| Identity verification stage | 1/10 | `identity_stage_reached=false` on all 3 |
| Chief Marketing Summary stage | 1/10 | `cmo_report.reached=false` on all 3 |
| Executive CMO snapshot stage | 1/10 | `cmo_snapshot.reached=false` on all 3 |

### Calibration verdict
**Live calibration execution is still blocked before meaningful progression.**

---

## 4) CMO report detail audit (live)

CMO stage did not render in this production run:
- No `chief-marketing-summary`
- No `business-summary`
- No `presence-score`
- No `communication-audit`
- No `geographic-presence`
- No `competitor-intelligence`
- No `recommendations`

### CMO report score
**1/10 (unreachable in live test path).**

---

## 5) Competitor intelligence audit (live)

## 5.1 UI behavior

Competitive benchmark page renders (`has_page=true`) but remains in no-score state:
- “Complete calibration with your business website to generate your Digital Footprint score.”
- “Loading benchmark data…”
- After competitor analyze click, no visible scored comparison result appears in captured flow.

Screenshots:
- `.../08_competitive_benchmark_page.png`
- `.../09_competitor_analyze_result.png`

## 5.2 API behavior (authenticated, per account)

| Endpoint | Live response | Score |
|---|---|---:|
| `GET /api/marketing/benchmark/latest` | `200 {"status":"no_benchmark"}` | 4/10 |
| `POST /api/marketing/benchmark` | `400 {"detail":"Business profile required"}` | 3/10 |
| `GET /api/competitive-benchmark/scores` | `200 {"status":"no_benchmark","scores":null}` | 5/10 |
| `POST /api/competitive-benchmark/refresh` | `400 {"detail":"Business profile required"}` | 3/10 |

### Competitor intelligence verdict
**Partially wired but not delivering usable scoring output in tested live user path.**

Overall competitor intelligence score: **3/10**.

---

## 6) What still blocks 10/10 on live

1. Calibration flow does not progress from `/calibration` into website handshake/analyzing/identity/CMO stages for tested accounts.  
2. CMO report is therefore unreachable in practical flow.  
3. Competitor intelligence remains gated by missing benchmark artifacts and strict profile prerequisites; page stays in no-score mode.

---

## 7) Direct evidence pointers

Account 01:
- `/workspace/.screenshots/deep_calibration_probe_20260320_154901/auto10x_20260320_093459_01_at_biqctest.io/01_after_login.png`
- `/workspace/.screenshots/deep_calibration_probe_20260320_154901/auto10x_20260320_093459_01_at_biqctest.io/02_calibration_landing.png`
- `/workspace/.screenshots/deep_calibration_probe_20260320_154901/auto10x_20260320_093459_01_at_biqctest.io/08_competitive_benchmark_page.png`
- `/workspace/.screenshots/deep_calibration_probe_20260320_154901/auto10x_20260320_093459_01_at_biqctest.io/09_competitor_analyze_result.png`

Account 02:
- `/workspace/.screenshots/deep_calibration_probe_20260320_154901/auto10x_20260320_093459_02_at_biqctest.io/01_after_login.png`
- `/workspace/.screenshots/deep_calibration_probe_20260320_154901/auto10x_20260320_093459_02_at_biqctest.io/02_calibration_landing.png`
- `/workspace/.screenshots/deep_calibration_probe_20260320_154901/auto10x_20260320_093459_02_at_biqctest.io/08_competitive_benchmark_page.png`
- `/workspace/.screenshots/deep_calibration_probe_20260320_154901/auto10x_20260320_093459_02_at_biqctest.io/09_competitor_analyze_result.png`

Account 03:
- `/workspace/.screenshots/deep_calibration_probe_20260320_154901/auto10x_20260320_093459_03_at_biqctest.io/01_after_login.png`
- `/workspace/.screenshots/deep_calibration_probe_20260320_154901/auto10x_20260320_093459_03_at_biqctest.io/02_calibration_landing.png`
- `/workspace/.screenshots/deep_calibration_probe_20260320_154901/auto10x_20260320_093459_03_at_biqctest.io/08_competitive_benchmark_page.png`
- `/workspace/.screenshots/deep_calibration_probe_20260320_154901/auto10x_20260320_093459_03_at_biqctest.io/09_competitor_analyze_result.png`

