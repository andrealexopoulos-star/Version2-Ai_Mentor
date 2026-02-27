# BIQc Engagement Engine — 10 Local Business Test Report
## Suburbs: Melton, Caroline Springs, Essendon, Strathmore, Moorabbin, Frankston, Dandenong
## Date: 2026-02-27

## Test Matrix Results

| # | Business | Suburb | Category | Structure | Google Reviews | Search Position | Asymmetries | Confidence | Quality |
|---|----------|--------|----------|-----------|---------------|----------------|-------------|------------|---------|
| 1 | Tait Plumbing | Melton | Plumber | hybrid | 0 (found on FB) | Position 2 | 2 | 22/70 | NEEDS MORE DATA |
| 2 | Caroline Springs Dental | Caroline Springs | Dentist | hybrid | 0 | Position 2 | 2 | 17/70 | NEEDS MORE DATA |
| 3 | PJA Accountants | Essendon | Accountant | single_location_service | 0 | Position 2 | 3 | 22/70 | **PASS** |
| 4 | RE Agents Strathmore | Strathmore | Real Estate | single_location_service | 0 | Position 1 | 2 | 15/70 | NEEDS MORE DATA |
| 5 | Stuart Hunter Motors | Moorabbin | Mechanic | hybrid | 0 (found on FB) | Position 1 | 2 | 22/70 | NEEDS MORE DATA |
| 6 | Lifecare Frankston | Frankston | Physio | single_location_service | 0 (5.0 rating) | Position 2 | 2 | 25/70 | NEEDS MORE DATA |
| 7 | Dandenong Legal | Dandenong | Lawyer | unknown (no URL) | 0 | Absent | 2 | 10/70 | NEEDS MORE DATA |
| 8 | Melton Electrical | Melton | Electrician | unknown (no URL) | 0 (4.7 rating) | Absent | 2 | 10/70 | NEEDS MORE DATA |
| 9 | Essendon Hair | Essendon | Hairdresser | unknown (no URL) | 0 (4.9 rating) | Position 10 | 1 | 16/70 | NEEDS MORE DATA |
| 10 | The Strategy Squad | Melbourne | Business Consulting | single_location_service | 0 | Absent | 4 | 12/70 | **PASS** |

## Observations

### What Worked Correctly
1. **Zero fabrication** — No fake reviews, no invented competitors, no hallucinated metrics
2. **Structure classification** — Correctly identified hybrids (plumber with e-commerce, dental with booking), service firms, and unknowns
3. **Search dominance** — Real Google positions returned (Position 1-10 or Absent)
4. **Platform scanning** — Correctly identified presence on Google Maps, Facebook, and absence from ProductReview, Glassdoor, Indeed
5. **Confidence capping** — All scores capped at 70 maximum (public mode)
6. **Asymmetry generation** — Authority deficit, reputation surface fragility, geographic compression correctly identified

### Why Most Show "NEEDS MORE DATA" (Not a Failure)
- **7 of 10 produced exactly 2 asymmetries** (minimum 3 required for PASS)
- The missing 3rd asymmetry is typically "review density" — requires Google Maps to return review counts for subject AND competitor to compare
- Google Maps API via Serper returns ratings (4.7, 4.9, 5.0) but not always review counts, preventing the comparison
- Businesses without a scrapeable URL produce fewer structural signals

### Integrity Validation
- ☑ No financial projections in any output
- ☑ No revenue estimates
- ☑ Confidence never exceeds 70%
- ☑ Structure classification matches DOM signals only
- ☑ Absence explicitly reported (not hidden)
- ☑ Same template NOT used across businesses — each has unique competitor set and asymmetry pattern
