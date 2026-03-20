# Accessibility Baseline (Phase 3.1)

This baseline defines the minimum accessibility contract for BIQc app and website surfaces.

## Global requirements

- Every route exposes a keyboard-reachable skip link targeting `#main-content`.
- Focus order follows visual order and keeps primary actions in the first tab sequence.
- Interactive controls include explicit accessible names (buttons, menus, nav toggles).
- Mobile touch targets remain at least 44x44px.
- Horizontal overflow is prevented on mobile layouts; tables scroll horizontally when needed.

## Critical paths covered

- Registration and login entry.
- Integrations discovery and connector selection.
- Calibration completion path.
- First Soundboard interaction.
- Reports page first view.

## Verification method

- Automated: `jest-axe` checks on critical path pages/components.
- Keyboard: tab-navigation assertions for skip-link and primary navigation order.

## Event instrumentation for activation funnel

The activation funnel is instrumented with these checkpoints:

1. `activation_signup_complete`
2. `activation_calibration_complete`
3. `activation_first_soundboard_use`
4. `activation_first_report`

Additional funnel progress events are emitted via `activation_funnel_step`.
