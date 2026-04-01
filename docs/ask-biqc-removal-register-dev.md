# Ask BIQc Redo - Removal and Change Register (Dev)

## Scope

This register covers the Ask BIQc platform redo implementation in dev, including route canonicalization, chat surface consolidation, UI updates, and calibration gating controls.

## Removal and Replacement Matrix

| Changed or Removed | Why | Replacement Path | Rollback Path |
|---|---|---|---|
| Dedicated `/soundboard` chat route as primary entry | Canonical chat entry must be Ask BIQc | `/ask-biqc` is now primary; `/soundboard` redirects to `/ask-biqc` | Restore `/soundboard` page element in `frontend/src/App.js` |
| Sidebar/mobile nav label `Soundboard` | IA alignment with product naming | Label now `Ask BIQc` | Revert nav labels in `frontend/src/components/DashboardLayout.js` and `frontend/src/components/MobileNav.js` |
| Embedded full duplicate chat engine in right rail (`SoundboardPanel`) | Remove behavior drift between two chat implementations | Embedded panel is now a launcher into single canonical `Ask BIQc` surface (`MySoundBoard`) | Reintroduce old `SoundboardPanel` implementation if dual-surface model is required |
| Old user-message visual bubble style in main chat | Reduce chatbot feel and improve readability | User bubble now uses BIQc-accented neutral style with bordered contrast | Revert message style block in `frontend/src/pages/MySoundBoard.js` |
| Implicit forensic calibration availability | Free entitlement must be explicit and enforceable | CTA now visible under Market Insights and free gating enforced server-side | Disable cooldown guard in `backend/routes/calibration.py` |

## Net-New Behavior Notes

- `Ask BIQc` is now the canonical chat route and navigation entry.
- A create-anything rail is present in composer (`SOP`, `Code`, `Image`, `Video` quick actions).
- Market Insights now includes a visible calibration CTA with free cooldown awareness.
- Free-tier forensic calibration is blocked server-side when attempted inside the cooldown window.

## Rollback Safety

- Route rollback is isolated to `frontend/src/App.js`, `frontend/src/config/routeAccessConfig.js`, and `frontend/src/config/launchConfig.js`.
- Chat-surface rollback is isolated to `frontend/src/components/SoundboardPanel.js`.
- Entitlement rollback is isolated to `backend/routes/calibration.py`.
- No database migrations were introduced in this change set.
