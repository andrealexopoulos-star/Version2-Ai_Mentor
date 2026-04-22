"""BIQc transactional email service — Resend-backed.

Single-file service that owns:
  - The shared BIQc-branded HTML layout (header, lava accent bar, footer)
  - Templates for the 14 transactional emails we send (E1–E14)
  - The Resend HTTP client wrapper with retry-on-transient-error
  - Public send_*_email wrappers used by backend routes + cron jobs

Templates are inline HTML strings with `{placeholder}` substitution.
All CSS is inlined (email-client compat). The only external asset is the
Google Fonts <link> in _layout() for Source Serif 4 + Geist (Outlook
desktop strips it and falls back to Georgia — honoured in FONT_DISPLAY).

2026-04-20 — E1–E11 shipped as P0 email-verification sprint.
2026-04-21 — Track C reskin (match biqc.ai homepage) + E12/E13/E14 added
             for Track B billing trust layer (80% warn, auto-top-up, fail).
"""

from __future__ import annotations

import html
import logging
import os
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

RESEND_API_KEY = (os.environ.get("RESEND_API_KEY") or "").strip()
RESEND_FROM_EMAIL = (os.environ.get("RESEND_FROM_EMAIL") or "noreply@biqc.ai").strip()
APP_URL = (os.environ.get("FRONTEND_URL") or os.environ.get("PUBLIC_FRONTEND_URL") or "https://biqc.ai").rstrip("/")


# ── brand tokens (inline-CSS values — match biqc.ai homepage) ─────
# Core lava palette
LAVA = "#E85D00"
LAVA_SOFT = "rgba(232,93,0,0.12)"
LAVA_DEEP = "#C24D00"                   # AA-safe on white for sub-15px text (~5.7:1)
LAVA_WARM = "#F37021"                   # hover/accent, >=15px only
LAVA_WASH = "rgba(232,93,0,0.08)"       # softer wash for cards
LAVA_RING = "rgba(194,77,0,0.24)"       # 1px borders on lava cards

# Ink
INK = "#0A0A0A"
INK_DISPLAY = "#0A0A0A"                 # alias of INK for semantic clarity in headlines
INK_SEC = "#525252"
INK_MUTED = "#737373"
INK_SUBTLE = "#8A8A8A"

# Surfaces
CANVAS = "#F2F4EC"                      # sage-wash page background
CANVAS_SAGE = "#F2F4EC"                 # alias of CANVAS
CANVAS_APP = "#FAFAF7"                  # warm off-white (footer)
SURFACE = "#FFFFFF"                     # card background
SURFACE_SUNK = "#F6F7F1"                # inline code / callout wash

# Borders
BORDER = "rgba(10,10,10,0.08)"
BORDER_STRONG = "rgba(10,10,10,0.14)"

# Status colors
DANGER = "#B91C1C"                      # >=7:1 on white — AA safe for all sizes
DANGER_WASH = "rgba(185,28,28,0.06)"
DANGER_RING = "rgba(185,28,28,0.18)"

# Typography — Source Serif 4 for display, Geist for body
# FONT_DISPLAY fallback chain puts Georgia BEFORE any sans so Outlook desktop
# (which strips the Google Fonts <link>) degrades to a serif cleanly.
FONT_DISPLAY = '"Source Serif 4", Georgia, "Times New Roman", serif'
FONT_BODY = "Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
FONT_MONO = "'Geist Mono', ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace"

# Backward-compat alias — FONT_STACK keeps its identical value via FONT_BODY.
# No external callers reference FONT_STACK (grep-verified), but internal
# references aren't all switched atomically — this keeps them safe.
FONT_STACK = FONT_BODY

# Footer — Andreas-locked decision #12 (2026-04-21): minimal legal address
BIQC_LEGAL_ADDRESS = "BIQc Pty Ltd &middot; Melbourne VIC &middot; Australia"

# Unsubscribe — Andreas-locked decision #13 (2026-04-21): mailto only
UNSUBSCRIBE_MAILTO = "mailto:unsubscribe@biqc.ai?subject=unsubscribe"


# ── helpers ──────────────────────────────────────────────────────────

def _esc(v: Any) -> str:
    """HTML-escape a user-supplied string for safe interpolation into
    HTML bodies AND href attributes. quote=True escapes both double and
    single quotes so the result is safe inside attribute values. None /
    missing values render as empty string (never literal 'None')."""
    if v is None:
        return ""
    return html.escape(str(v), quote=True)


def _preheader_pad() -> str:
    """~300 chars of zero-width / non-breaking whitespace. Prevents Gmail
    from pulling body text into the inbox preview next to the preheader.
    50 reps of combining-grapheme-joiner + zero-width-non-joiner alternation
    — above Gmail's ~150-char preview window, below SpamAssassin's
    HIDDEN_TEXT rule trigger (~600 chars)."""
    return ("&#847;&nbsp;&zwnj;&nbsp;" * 50)


# ── layout shell ─────────────────────────────────────────────────────

def _layout(*, preheader: str, body_html: str,
            headline_override: Optional[str] = None) -> str:
    """Shared BIQc email shell — Track C reskin (2026-04-21) matching
    biqc.ai homepage.

    - Source Serif 4 headlines via Google Fonts <link>; Georgia fallback
      for Outlook desktop (FONT_DISPLAY chain).
    - Geist body, JetBrains/Geist Mono for tokens + tech fragments.
    - Lava accent bar under the BIQc wordmark.
    - 560px container, white card on canvas-sage background.
    - Light-only @color-scheme hint; @media (prefers-color-scheme: dark)
      override forces BOTH background AND color so no ghost text.
    - [data-ogsc] selectors defend the lava palette against Outlook.com's
      dark-mode auto-invert.
    - Preheader is padded ~300 chars via _preheader_pad() (Gmail clip guard).
    - Outlook-compat outer table, inline CSS only, no JS, no external CSS
      beyond the Google Fonts link.
    - `headline_override` is plumbed for future campaigns; templates
      currently inject their own <h1> into body_html.
    """
    _ = headline_override  # future hook

    return f"""<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="only light" />
<meta name="supported-color-schemes" content="only light" />
<title>BIQc</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  body,table,td,a{{ -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }}
  table,td{{ mso-table-lspace:0; mso-table-rspace:0; border-collapse:collapse; }}
  img{{ border:0; outline:none; -ms-interpolation-mode:bicubic; display:block; }}
  a{{ text-decoration:none; }}
  @media only screen and (max-width:620px) {{
    .biqc-container{{ width:100% !important; max-width:100% !important; border-radius:0 !important; }}
    .biqc-pad-x{{ padding-left:20px !important; padding-right:20px !important; }}
    .biqc-h1{{ font-size:26px !important; line-height:1.18 !important; }}
    .biqc-btn{{ width:100% !important; display:block !important; }}
  }}
  @media (prefers-color-scheme: dark) {{
    .biqc-body{{ background:{CANVAS} !important; color:{INK} !important; }}
    .biqc-card{{ background:{SURFACE} !important; border-color:{BORDER} !important; }}
    .biqc-footer{{ background:{CANVAS_APP} !important; border-top-color:{BORDER} !important; }}
    .biqc-ink{{ color:{INK} !important; }}
    .biqc-ink-sec{{ color:{INK_SEC} !important; }}
    .biqc-ink-muted{{ color:{INK_MUTED} !important; }}
  }}
  [data-ogsc] .biqc-lava-bg{{ background-color:{LAVA} !important; }}
  [data-ogsc] .biqc-lava-text{{ color:{LAVA_DEEP} !important; }}
</style>
</head>
<body class="biqc-body" style="margin:0;padding:0;background:{CANVAS};font-family:{FONT_BODY};color:{INK};color-scheme:light only;">
<!-- Preheader (padded ~300 chars to stop Gmail clipping body text into preview) -->
<div style="display:none;font-size:1px;color:{CANVAS};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
  {preheader}{_preheader_pad()}
</div>
<!-- Outer wrapper -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:{CANVAS};padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" class="biqc-container biqc-card" border="0" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;background:{SURFACE};border-radius:16px;border:1px solid {BORDER};overflow:hidden;">
      <!-- Header -->
      <tr><td class="biqc-pad-x" style="padding:28px 32px 0;">
        <table role="presentation" width="100%"><tr>
          <td class="biqc-ink" style="font-family:{FONT_DISPLAY};font-size:22px;font-weight:600;color:{INK_DISPLAY};letter-spacing:-0.02em;line-height:1;">
            <span class="biqc-lava-text" style="color:{LAVA};">&#9679;</span>&nbsp;BIQc
          </td>
          <td align="right" class="biqc-ink-muted" style="font-family:{FONT_MONO};font-size:10px;color:{INK_MUTED};text-transform:uppercase;letter-spacing:0.08em;">
            Business Intelligence Centre
          </td>
        </tr></table>
      </td></tr>
      <!-- Lava accent bar under logo (biqc.ai homepage brand cue) -->
      <tr><td class="biqc-pad-x" style="padding:16px 32px 0;">
        <table role="presentation" width="100%"><tr>
          <td height="3" class="biqc-lava-bg" style="background:{LAVA};height:3px;line-height:3px;font-size:3px;border-radius:2px;">&nbsp;</td>
        </tr></table>
      </td></tr>
      <!-- Body -->
      <tr><td class="biqc-pad-x biqc-ink" style="padding:28px 32px 32px;font-family:{FONT_BODY};font-size:15px;line-height:1.55;color:{INK};">
        {body_html}
      </td></tr>
      <!-- Footer -->
      <tr><td class="biqc-pad-x biqc-footer" style="padding:20px 32px;background:{CANVAS_APP};border-top:1px solid {BORDER};font-family:{FONT_BODY};font-size:12px;color:{INK_SEC};line-height:1.55;">
        <div class="biqc-ink-sec" style="color:{INK_SEC};">{BIQC_LEGAL_ADDRESS}</div>
        <div style="margin-top:6px;">
          Questions? <a href="mailto:support@biqc.ai" class="biqc-lava-text" style="color:{LAVA_DEEP};text-decoration:none;font-weight:500;">support@biqc.ai</a>
          &nbsp;&middot;&nbsp;
          <a href="{APP_URL}/trust/privacy" class="biqc-ink-muted" style="color:{INK_MUTED};text-decoration:underline;">Privacy</a>
          &nbsp;&middot;&nbsp;
          <a href="{APP_URL}/trust/terms" class="biqc-ink-muted" style="color:{INK_MUTED};text-decoration:underline;">Terms</a>
          &nbsp;&middot;&nbsp;
          <a href="{UNSUBSCRIBE_MAILTO}" class="biqc-ink-muted" style="color:{INK_MUTED};text-decoration:underline;">Unsubscribe</a>
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""


# ── button helper ────────────────────────────────────────────────────

def _button(label: str, url: str, style: str = "primary") -> str:
    """Lava-pill CTA. Two styles:
      primary   — filled lava, white text (default)
      secondary — lava-deep outlined, lava-deep text, 2pt stroke for Outlook

    Contract: caller passes RAW `url`. _button escapes it once internally.
    DO NOT pre-escape the URL in the caller — `html.escape` is NOT idempotent
    on `&` (caller-escaped `&amp;` becomes `&amp;amp;` on second pass).
    """
    safe_label = html.escape(str(label or ""), quote=True)
    safe_url = html.escape(str(url or "#"), quote=True)

    if style == "secondary":
        return f"""<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{safe_url}" style="height:44px;v-text-anchor:middle;width:240px;" arcsize="100%" strokecolor="{LAVA_DEEP}" strokeweight="2pt" fillcolor="{SURFACE}"><w:anchorlock/><center style="color:{LAVA_DEEP};font-family:{FONT_BODY};font-size:15px;font-weight:600;">{safe_label}</center></v:roundrect><![endif]-->
<!--[if !mso]><!-- --><a class="biqc-btn" href="{safe_url}" style="background:{SURFACE};color:{LAVA_DEEP};display:inline-block;padding:11px 26px;border-radius:999px;border:2px solid {LAVA_DEEP};font-family:{FONT_BODY};font-weight:600;font-size:15px;text-decoration:none;letter-spacing:-0.005em;">{safe_label}</a><!--<![endif]-->"""

    return f"""<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{safe_url}" style="height:44px;v-text-anchor:middle;width:240px;" arcsize="100%" stroke="f" fillcolor="{LAVA}"><w:anchorlock/><center style="color:#FFFFFF;font-family:{FONT_BODY};font-size:15px;font-weight:600;">{safe_label}</center></v:roundrect><![endif]-->
<!--[if !mso]><!-- --><a class="biqc-btn biqc-lava-bg" href="{safe_url}" style="background:{LAVA};color:#FFFFFF;display:inline-block;padding:13px 28px;border-radius:999px;font-family:{FONT_BODY};font-weight:600;font-size:15px;text-decoration:none;letter-spacing:-0.005em;">{safe_label}</a><!--<![endif]-->"""


# ────────────────────────── Template: E1 verification ─────────────────────────

def tmpl_verification(*, full_name: str, verification_url: str, plan_name: str,
                      first_charge_date: str, first_charge_amount: str) -> Tuple[str, str, str]:
    """E1 — verification email. Must be clicked to activate account."""
    subject = "Verify your BIQc account to get started"
    raw_first = (full_name or "").split(" ")[0] if full_name else "there"
    greet = _esc(raw_first)
    plan_e = _esc(plan_name)
    fcd_e = _esc(first_charge_date)
    fca_e = _esc(first_charge_amount)
    url_e = _esc(verification_url)
    preheader = "One click to activate your account — your trial is already live."
    body_html = f"""
<h1 class="biqc-h1 biqc-ink" style="margin:0 0 12px;font-family:{FONT_DISPLAY};font-size:30px;font-weight:600;letter-spacing:-0.02em;line-height:1.12;color:{INK_DISPLAY};">Welcome, {greet}.</h1>
<p class="biqc-ink-sec" style="margin:0 0 20px;color:{INK_SEC};font-size:15px;">Your BIQc account is set up and your 14-day trial is active. One last step &mdash; click below to verify your email so we know it&rsquo;s really you.</p>
<p style="margin:0 0 28px;text-align:center;">{_button('Verify my email', verification_url)}</p>
<p class="biqc-ink-muted" style="margin:0 0 8px;font-size:13px;color:{INK_MUTED};">Or paste this link into your browser:</p>
<p style="margin:0 0 24px;font-family:{FONT_MONO};font-size:12px;color:{INK_SEC};word-break:break-all;overflow-wrap:anywhere;background:{SURFACE_SUNK};padding:11px 13px;border-radius:10px;border:1px solid {BORDER};">{url_e}</p>
<div style="margin:24px 0 0;padding:18px 20px;background:{LAVA_WASH};border-radius:14px;border:1px solid {LAVA_RING};">
  <div class="biqc-lava-text" style="font-family:{FONT_MONO};font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:{LAVA_DEEP};font-weight:700;margin-bottom:8px;">Your plan</div>
  <div class="biqc-ink" style="color:{INK};font-weight:600;font-size:16px;">{plan_e}</div>
  <div class="biqc-ink-sec" style="margin-top:6px;color:{INK_SEC};font-size:13px;">Free until <strong style="color:{INK};">{fcd_e}</strong>. If you don&rsquo;t cancel before that date we&rsquo;ll charge <strong style="color:{INK};">{fca_e}</strong> to your card on file.</div>
</div>
<p class="biqc-ink-muted" style="margin:24px 0 0;font-size:13px;color:{INK_MUTED};">The link above expires in 7 days. If you didn&rsquo;t sign up for BIQc, you can safely ignore this email.</p>
"""
    text = (
        f"Welcome, {raw_first}.\n\n"
        f"Your BIQc account is set up and your 14-day trial is active. "
        f"Click the link below to verify your email:\n\n{verification_url}\n\n"
        f"Plan: {plan_name}\n"
        f"Free until {first_charge_date}. {first_charge_amount} will be charged after that unless you cancel.\n\n"
        f"This link expires in 7 days.\n\n— The BIQc team"
    )
    return subject, _layout(preheader=preheader, body_html=body_html), text


# ────────────────────────── Template: E2 verified confirm ─────────────────────

def tmpl_verified(*, full_name: str, login_url: str, plan_name: str,
                  first_charge_date: str, first_charge_amount: str) -> Tuple[str, str, str]:
    """E2 — after verification link clicked OR on OAuth signup (skips E1)."""
    subject = "You're verified — welcome to BIQc"
    raw_first = (full_name or "").split(" ")[0] if full_name else "there"
    greet = _esc(raw_first)
    plan_e = _esc(plan_name)
    fcd_e = _esc(first_charge_date)
    fca_e = _esc(first_charge_amount)
    preheader = "Your account is active. Here's what happens next."
    body_html = f"""
<h1 class="biqc-h1 biqc-ink" style="margin:0 0 12px;font-family:{FONT_DISPLAY};font-size:30px;font-weight:600;letter-spacing:-0.02em;line-height:1.12;color:{INK_DISPLAY};">You&rsquo;re in, {greet}.</h1>
<p class="biqc-ink-sec" style="margin:0 0 22px;color:{INK_SEC};font-size:15px;">Your email is verified and your BIQc trial is live. Here&rsquo;s what you need to know:</p>
<table role="presentation" width="100%" style="margin:0 0 26px;">
  <tr><td style="padding:16px 18px;background:{SURFACE_SUNK};border:1px solid {BORDER};border-radius:14px;">
    <div class="biqc-lava-text" style="font-family:{FONT_MONO};font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:{LAVA_DEEP};font-weight:700;">Your plan</div>
    <div class="biqc-ink" style="margin-top:6px;font-family:{FONT_DISPLAY};font-size:20px;color:{INK};font-weight:600;letter-spacing:-0.015em;">{plan_e}</div>
    <div class="biqc-ink-sec" style="margin-top:10px;font-size:13px;color:{INK_SEC};">Free until <strong style="color:{INK};">{fcd_e}</strong> &middot; First charge <strong style="color:{INK};">{fca_e}</strong></div>
    <div class="biqc-ink-muted" style="margin-top:6px;font-size:12px;color:{INK_MUTED};">Cancel any time before {fcd_e} for $0.</div>
  </td></tr>
</table>
<p style="margin:0 0 24px;text-align:center;">{_button('Sign in to BIQc', login_url)}</p>
<div class="biqc-ink-sec" style="margin:12px 0 0;color:{INK_SEC};">
<p class="biqc-ink" style="margin:0 0 12px;font-weight:600;color:{INK};font-size:15px;">What to do in the next 5 minutes</p>
<ol style="margin:0;padding-left:22px;font-size:14px;line-height:1.65;">
  <li style="margin-bottom:8px;">Connect your inbox (Outlook or Gmail) &mdash; BIQc needs it to start reading the room.</li>
  <li style="margin-bottom:8px;">Complete your business profile so we can benchmark you properly.</li>
  <li>Check back tomorrow morning &mdash; your first intelligence brief will be ready.</li>
</ol>
</div>
<p class="biqc-ink-muted" style="margin:26px 0 0;font-size:13px;color:{INK_MUTED};">Need help? Reply to this email &mdash; it goes to a real person.</p>
"""
    text = (
        f"You're in, {raw_first}.\n\n"
        f"Your email is verified and your BIQc trial is live.\n\n"
        f"Plan: {plan_name}\n"
        f"Free until {first_charge_date}. First charge: {first_charge_amount}. "
        f"Cancel before {first_charge_date} for $0.\n\n"
        f"Sign in: {login_url}\n\n"
        f"Next 5 minutes:\n"
        f"  1. Connect your inbox (Outlook or Gmail)\n"
        f"  2. Complete your business profile\n"
        f"  3. Check back tomorrow for your first intelligence brief\n\n"
        f"— The BIQc team"
    )
    return subject, _layout(preheader=preheader, body_html=body_html), text


# ────────────────────────── Template: E3 password reset request ───────────────

def tmpl_password_reset(*, full_name: str, reset_url: str) -> Tuple[str, str, str]:
    subject = "Reset your BIQc password"
    raw_first = (full_name or "").split(" ")[0] if full_name else "there"
    greet = _esc(raw_first)
    url_e = _esc(reset_url)
    preheader = "Password reset link — expires in 1 hour."
    body_html = f"""
<h1 class="biqc-h1 biqc-ink" style="margin:0 0 12px;font-family:{FONT_DISPLAY};font-size:30px;font-weight:600;letter-spacing:-0.02em;line-height:1.12;color:{INK_DISPLAY};">Reset your password</h1>
<p class="biqc-ink-sec" style="margin:0 0 20px;color:{INK_SEC};font-size:15px;">Hi {greet} &mdash; we got a request to reset your BIQc password. Click below to set a new one.</p>
<p style="margin:0 0 28px;text-align:center;">{_button('Reset password', reset_url)}</p>
<p class="biqc-ink-muted" style="margin:0 0 8px;font-size:13px;color:{INK_MUTED};">Or paste this link into your browser:</p>
<p style="margin:0 0 24px;font-family:{FONT_MONO};font-size:12px;color:{INK_SEC};word-break:break-all;overflow-wrap:anywhere;background:{SURFACE_SUNK};padding:11px 13px;border-radius:10px;border:1px solid {BORDER};">{url_e}</p>
<div style="margin:16px 0 0;padding:14px 16px;background:{SURFACE_SUNK};border-radius:12px;border:1px solid {BORDER};font-size:13px;color:{INK_SEC};line-height:1.55;">
  <strong style="color:{INK};">This link expires in 1 hour.</strong> If you didn&rsquo;t request this, you can safely ignore this email &mdash; your password won&rsquo;t change.
</div>
"""
    text = (
        f"Hi {raw_first} — reset your BIQc password at this link (expires in 1 hour):\n\n"
        f"{reset_url}\n\nIf you didn't request this, ignore this email.\n\n— The BIQc team"
    )
    return subject, _layout(preheader=preheader, body_html=body_html), text


# ────────────────────────── Template: E4 password reset confirm ───────────────

def tmpl_password_reset_confirm(*, full_name: str, login_url: str) -> Tuple[str, str, str]:
    subject = "Your BIQc password was changed"
    raw_first = (full_name or "").split(" ")[0] if full_name else "there"
    greet = _esc(raw_first)
    preheader = "Your password was changed. If this wasn't you, contact support immediately."
    body_html = f"""
<h1 class="biqc-h1 biqc-ink" style="margin:0 0 12px;font-family:{FONT_DISPLAY};font-size:28px;font-weight:600;letter-spacing:-0.02em;line-height:1.18;color:{INK_DISPLAY};">Password changed</h1>
<p class="biqc-ink-sec" style="margin:0 0 20px;color:{INK_SEC};font-size:15px;">Hi {greet} &mdash; your BIQc password was just updated. You can sign in with your new password now.</p>
<p style="margin:0 0 26px;text-align:center;">{_button('Sign in', login_url)}</p>
<div style="margin:0;padding:16px 18px;background:{DANGER_WASH};border:1px solid {DANGER_RING};border-radius:14px;font-size:13px;color:{INK_SEC};line-height:1.55;">
  <strong style="color:{DANGER};">Didn&rsquo;t change your password?</strong> Reply to this email or contact <a href="mailto:support@biqc.ai" class="biqc-lava-text" style="color:{LAVA_DEEP};font-weight:600;">support@biqc.ai</a> immediately &mdash; we&rsquo;ll lock the account while we investigate.
</div>
"""
    text = (
        f"Hi {raw_first} — your BIQc password was changed.\n\n"
        f"Sign in: {login_url}\n\n"
        f"Didn't do this? Email support@biqc.ai immediately."
    )
    return subject, _layout(preheader=preheader, body_html=body_html), text


# ────────────────────────── Template: E5 trial-end charge succeeded ───────────

def tmpl_trial_ended_paid(*, full_name: str, amount: str, plan_name: str,
                          next_charge_date: str, dashboard_url: str, invoice_url: str) -> Tuple[str, str, str]:
    subject = f"Trial ended — {amount} charged · BIQc"
    raw_first = (full_name or "").split(" ")[0] if full_name else "there"
    greet = _esc(raw_first)
    amt_e = _esc(amount)
    plan_e = _esc(plan_name)
    ncd_e = _esc(next_charge_date)
    inv_url_e = _esc(invoice_url)
    preheader = f"Your BIQc trial converted. Next charge {next_charge_date}."
    body_html = f"""
<h1 class="biqc-h1 biqc-ink" style="margin:0 0 12px;font-family:{FONT_DISPLAY};font-size:28px;font-weight:600;letter-spacing:-0.02em;line-height:1.18;color:{INK_DISPLAY};">Your trial just converted</h1>
<p class="biqc-ink-sec" style="margin:0 0 16px;color:{INK_SEC};font-size:15px;">Hi {greet} &mdash; your 14-day trial wrapped up and we successfully charged <strong style="color:{INK};">{amt_e}</strong> to your card for your first {plan_e} billing cycle.</p>
<p class="biqc-ink-sec" style="margin:0 0 8px;color:{INK_SEC};font-size:14px;">Next billing: <strong style="color:{INK};">{ncd_e}</strong></p>
<p style="margin:18px 0 28px;"><a href="{inv_url_e}" class="biqc-lava-text" style="color:{LAVA_DEEP};font-weight:600;text-decoration:underline;font-size:14px;">Download receipt (PDF) &rarr;</a></p>
<p style="margin:0 0 26px;text-align:center;">{_button('Open dashboard', dashboard_url)}</p>
<p class="biqc-ink-muted" style="margin:0;font-size:13px;color:{INK_MUTED};line-height:1.55;">Thanks for paying BIQc &mdash; we take it seriously. If anything feels off about the platform, reply here and tell us.</p>
"""
    text = (
        f"Hi {raw_first} — your 14-day trial wrapped up and we charged {amount} for your first {plan_name} cycle.\n\n"
        f"Next billing: {next_charge_date}\n"
        f"Receipt: {invoice_url}\n"
        f"Dashboard: {dashboard_url}\n\n"
        f"Questions? Reply to this email.\n\n— The BIQc team"
    )
    return subject, _layout(preheader=preheader, body_html=body_html), text


# ────────────────────────── Template: E6 trial cancelled ──────────────────────

def tmpl_trial_cancelled(*, full_name: str, plan_name: str, reactivate_url: str) -> Tuple[str, str, str]:
    subject = "Your BIQc trial is cancelled — no charge"
    raw_first = (full_name or "").split(" ")[0] if full_name else "there"
    greet = _esc(raw_first)
    plan_e = _esc(plan_name)
    preheader = "No charge will be made. Come back anytime."
    body_html = f"""
<h1 class="biqc-h1 biqc-ink" style="margin:0 0 12px;font-family:{FONT_DISPLAY};font-size:28px;font-weight:600;letter-spacing:-0.02em;line-height:1.18;color:{INK_DISPLAY};">Trial cancelled &mdash; you&rsquo;re all clear</h1>
<p class="biqc-ink-sec" style="margin:0 0 16px;color:{INK_SEC};font-size:15px;">Hi {greet} &mdash; you cancelled your {plan_e} trial before the 14-day mark. <strong style="color:{INK};">No charge will be made.</strong> Your card is off file.</p>
<p class="biqc-ink-sec" style="margin:0 0 26px;color:{INK_SEC};font-size:15px;">If you change your mind, your account and any calibration data we captured will be here waiting.</p>
<p style="margin:0 0 26px;text-align:center;">{_button('Reactivate BIQc', reactivate_url, 'secondary')}</p>
<p class="biqc-ink-muted" style="margin:0;font-size:13px;color:{INK_MUTED};line-height:1.55;">Out of curiosity &mdash; if anything was missing or felt rough, reply and let us know. Every bit of feedback makes BIQc better for the next SMB that tries us.</p>
"""
    text = (
        f"Hi {raw_first} — your {plan_name} trial is cancelled. No charge will be made.\n\n"
        f"Reactivate anytime: {reactivate_url}\n\n"
        f"What felt rough? Reply here.\n\n— The BIQc team"
    )
    return subject, _layout(preheader=preheader, body_html=body_html), text


# ────────────────────────── Template: E7 payment receipt ──────────────────────

def tmpl_payment_receipt(*, full_name: str, amount: str, plan_name: str,
                         invoice_number: str, paid_date: str, next_charge_date: str,
                         invoice_url: str) -> Tuple[str, str, str]:
    subject = f"Receipt — {amount} · BIQc · {invoice_number}"
    raw_first = (full_name or "").split(" ")[0] if full_name else "there"
    greet = _esc(raw_first)
    amt_e = _esc(amount)
    plan_e = _esc(plan_name)
    inv_e = _esc(invoice_number)
    paid_e = _esc(paid_date)
    ncd_e = _esc(next_charge_date)
    inv_url_e = _esc(invoice_url)
    preheader = f"Receipt for {amount}. Next charge {next_charge_date}."
    body_html = f"""
<h1 class="biqc-h1 biqc-ink" style="margin:0 0 12px;font-family:{FONT_DISPLAY};font-size:28px;font-weight:600;letter-spacing:-0.02em;line-height:1.18;color:{INK_DISPLAY};">Thanks for your payment</h1>
<p class="biqc-ink-sec" style="margin:0 0 22px;color:{INK_SEC};font-size:15px;">Hi {greet} &mdash; your {plan_e} subscription renewed successfully. Here&rsquo;s the breakdown:</p>
<table role="presentation" width="100%" style="border-collapse:collapse;margin:0 0 26px;">
  <tr><td class="biqc-ink-muted" style="padding:12px 0;border-bottom:1px solid {BORDER};font-size:13px;color:{INK_MUTED};">Invoice</td><td align="right" class="biqc-ink" style="padding:12px 0;border-bottom:1px solid {BORDER};font-family:{FONT_MONO};font-size:13px;color:{INK};">{inv_e}</td></tr>
  <tr><td class="biqc-ink-muted" style="padding:12px 0;border-bottom:1px solid {BORDER};font-size:13px;color:{INK_MUTED};">Paid on</td><td align="right" class="biqc-ink" style="padding:12px 0;border-bottom:1px solid {BORDER};font-size:13px;color:{INK};">{paid_e}</td></tr>
  <tr><td class="biqc-ink-muted" style="padding:12px 0;border-bottom:1px solid {BORDER};font-size:13px;color:{INK_MUTED};">Plan</td><td align="right" class="biqc-ink" style="padding:12px 0;border-bottom:1px solid {BORDER};font-size:13px;color:{INK};">{plan_e}</td></tr>
  <tr><td class="biqc-ink" style="padding:14px 0 12px;font-family:{FONT_DISPLAY};font-size:16px;color:{INK};font-weight:600;letter-spacing:-0.01em;">Amount</td><td align="right" class="biqc-ink" style="padding:14px 0 12px;font-family:{FONT_DISPLAY};font-size:18px;color:{INK_DISPLAY};font-weight:700;letter-spacing:-0.015em;">{amt_e}</td></tr>
</table>
<p class="biqc-ink-sec" style="margin:0 0 8px;color:{INK_SEC};font-size:14px;">Next charge: <strong style="color:{INK};">{ncd_e}</strong></p>
<p style="margin:18px 0 26px;"><a href="{inv_url_e}" class="biqc-lava-text" style="color:{LAVA_DEEP};font-weight:600;text-decoration:underline;font-size:14px;">Download full receipt (PDF) &rarr;</a></p>
<p class="biqc-ink-muted" style="margin:0;font-size:13px;color:{INK_MUTED};line-height:1.55;">Want to change plan or cancel? Manage your subscription in the dashboard.</p>
"""
    text = (
        f"Hi {raw_first} — receipt for your {plan_name} subscription:\n\n"
        f"  Invoice: {invoice_number}\n"
        f"  Paid on: {paid_date}\n"
        f"  Amount: {amount}\n\n"
        f"Next charge: {next_charge_date}\n"
        f"Full receipt (PDF): {invoice_url}\n\n— The BIQc team"
    )
    return subject, _layout(preheader=preheader, body_html=body_html), text


# ────────────────────────── Template: E8 payment failed ───────────────────────

def tmpl_payment_failed(*, full_name: str, amount: str, plan_name: str,
                        update_payment_url: str, retry_date: str) -> Tuple[str, str, str]:
    subject = "Payment failed — action required · BIQc"
    raw_first = (full_name or "").split(" ")[0] if full_name else "there"
    greet = _esc(raw_first)
    amt_e = _esc(amount)
    plan_e = _esc(plan_name)
    rd_e = _esc(retry_date)
    preheader = f"We couldn't charge {amount}. Update your card to keep your subscription."
    body_html = f"""
<h1 class="biqc-h1" style="margin:0 0 12px;font-family:{FONT_DISPLAY};font-size:28px;font-weight:600;letter-spacing:-0.02em;line-height:1.18;color:{DANGER};">We couldn&rsquo;t charge your card</h1>
<p class="biqc-ink-sec" style="margin:0 0 16px;color:{INK_SEC};font-size:15px;">Hi {greet} &mdash; your bank declined the <strong style="color:{INK};">{amt_e}</strong> charge for your {plan_e} subscription.</p>
<p class="biqc-ink-sec" style="margin:0 0 26px;color:{INK_SEC};font-size:15px;">We&rsquo;ll retry automatically on <strong style="color:{INK};">{rd_e}</strong>. If the card is no longer valid, please update it now to avoid interruption.</p>
<p style="margin:0 0 26px;text-align:center;">{_button('Update payment method', update_payment_url)}</p>
<div style="margin:0;padding:16px 18px;background:{DANGER_WASH};border:1px solid {DANGER_RING};border-radius:14px;font-size:13px;color:{INK_SEC};line-height:1.55;">
  If we can&rsquo;t collect after multiple retries your BIQc access will be suspended. Don&rsquo;t let the intelligence you&rsquo;ve built go dark &mdash; update your card now.
</div>
<p class="biqc-ink-muted" style="margin:24px 0 0;font-size:13px;color:{INK_MUTED};">Think this is wrong? Reply to this email &mdash; we&rsquo;ll dig in.</p>
"""
    text = (
        f"Hi {raw_first} — your bank declined the {amount} charge for your {plan_name} subscription.\n\n"
        f"We'll retry on {retry_date}. To avoid interruption, update your card now:\n\n"
        f"{update_payment_url}\n\n— The BIQc team"
    )
    return subject, _layout(preheader=preheader, body_html=body_html), text


# ────────────────────────── Template: E9 account suspended ────────────────────

def tmpl_account_suspended(*, full_name: str, plan_name: str, update_payment_url: str) -> Tuple[str, str, str]:
    subject = "Your BIQc access is suspended — update payment"
    raw_first = (full_name or "").split(" ")[0] if full_name else "there"
    greet = _esc(raw_first)
    plan_e = _esc(plan_name)
    preheader = "Access suspended after multiple failed charges. Update your card to resume."
    body_html = f"""
<h1 class="biqc-h1" style="margin:0 0 12px;font-family:{FONT_DISPLAY};font-size:28px;font-weight:600;letter-spacing:-0.02em;line-height:1.18;color:{DANGER};">Access suspended</h1>
<p class="biqc-ink-sec" style="margin:0 0 16px;color:{INK_SEC};font-size:15px;">Hi {greet} &mdash; we tried multiple times to charge your card for your {plan_e} subscription and the bank declined each time. <strong style="color:{INK};">Your BIQc access is now suspended.</strong></p>
<p class="biqc-ink-sec" style="margin:0 0 26px;color:{INK_SEC};font-size:15px;">Your data, calibration, and intelligence history are intact. Update your payment method to resume instantly.</p>
<p style="margin:0 0 26px;text-align:center;">{_button('Update card + reactivate', update_payment_url)}</p>
<p class="biqc-ink-muted" style="margin:0;font-size:13px;color:{INK_MUTED};line-height:1.55;">No resolution after 30 days and we&rsquo;ll archive the account per our data-retention policy. Need help? Reply here.</p>
"""
    text = (
        f"Hi {raw_first} — your BIQc access is suspended after multiple failed charges on your {plan_name} subscription.\n\n"
        f"Your data is intact. Update your card to resume:\n\n"
        f"{update_payment_url}\n\n"
        f"No resolution after 30 days = archive per our retention policy.\n\n— The BIQc team"
    )
    return subject, _layout(preheader=preheader, body_html=body_html), text


# ────────────────────────── Template: E10 subscription cancelled ──────────────

def tmpl_subscription_cancelled(*, full_name: str, plan_name: str, access_end_date: str, reactivate_url: str) -> Tuple[str, str, str]:
    subject = "Your BIQc subscription is cancelled"
    raw_first = (full_name or "").split(" ")[0] if full_name else "there"
    greet = _esc(raw_first)
    plan_e = _esc(plan_name)
    aed_e = _esc(access_end_date)
    preheader = f"Cancelled. Access continues until {access_end_date}."
    body_html = f"""
<h1 class="biqc-h1 biqc-ink" style="margin:0 0 12px;font-family:{FONT_DISPLAY};font-size:28px;font-weight:600;letter-spacing:-0.02em;line-height:1.18;color:{INK_DISPLAY};">Your subscription is cancelled</h1>
<p class="biqc-ink-sec" style="margin:0 0 20px;color:{INK_SEC};font-size:15px;">Hi {greet} &mdash; we&rsquo;ve cancelled your {plan_e} subscription as requested. No further charges will be made.</p>
<table role="presentation" width="100%" style="margin:0 0 26px;">
  <tr><td style="padding:16px 18px;background:{SURFACE_SUNK};border:1px solid {BORDER};border-radius:14px;">
    <div class="biqc-lava-text" style="font-family:{FONT_MONO};font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:{LAVA_DEEP};font-weight:700;">Access continues until</div>
    <div class="biqc-ink" style="margin-top:6px;font-family:{FONT_DISPLAY};font-size:22px;color:{INK_DISPLAY};font-weight:600;letter-spacing:-0.015em;">{aed_e}</div>
    <div class="biqc-ink-sec" style="margin-top:6px;font-size:13px;color:{INK_SEC};">Use it while you have it &mdash; then the account will go read-only.</div>
  </td></tr>
</table>
<p style="margin:0 0 26px;text-align:center;">{_button('Reactivate', reactivate_url, 'secondary')}</p>
<p class="biqc-ink-muted" style="margin:0;font-size:13px;color:{INK_MUTED};line-height:1.55;">If you cancelled by mistake, reactivate with one click &mdash; your data and intelligence history are untouched.</p>
"""
    text = (
        f"Hi {raw_first} — your {plan_name} subscription is cancelled. No further charges.\n\n"
        f"Access continues until {access_end_date}, then read-only.\n\n"
        f"Reactivate: {reactivate_url}\n\n— The BIQc team"
    )
    return subject, _layout(preheader=preheader, body_html=body_html), text


# ────────────────────────── Template: E11 plan changed ────────────────────────

def tmpl_plan_changed(*, full_name: str, old_plan: str, new_plan: str,
                      new_amount: str, effective_date: str, dashboard_url: str) -> Tuple[str, str, str]:
    # Preserved cosmetic bug: string compare is wrong for e.g. Business > Pro.
    # Tracked for post-Track-B cleanup. Affects subject + h1 text only, no data impact.
    direction = "upgraded" if (new_plan or "").lower() > (old_plan or "").lower() else "changed"
    subject = f"Plan {direction} — {new_plan} · BIQc"
    raw_first = (full_name or "").split(" ")[0] if full_name else "there"
    greet = _esc(raw_first)
    op_e = _esc(old_plan)
    np_e = _esc(new_plan)
    na_e = _esc(new_amount)
    ed_e = _esc(effective_date)
    dir_e = _esc(direction)
    preheader = f"You're on {new_plan} from {effective_date}."
    body_html = f"""
<h1 class="biqc-h1 biqc-ink" style="margin:0 0 12px;font-family:{FONT_DISPLAY};font-size:28px;font-weight:600;letter-spacing:-0.02em;line-height:1.18;color:{INK_DISPLAY};">Plan {dir_e}</h1>
<p class="biqc-ink-sec" style="margin:0 0 20px;color:{INK_SEC};font-size:15px;">Hi {greet} &mdash; your BIQc plan changed from <strong>{op_e}</strong> to <strong style="color:{INK};">{np_e}</strong>.</p>
<table role="presentation" width="100%" style="margin:0 0 26px;border-collapse:collapse;">
  <tr><td class="biqc-ink-muted" style="padding:10px 0;border-bottom:1px solid {BORDER};font-size:13px;color:{INK_MUTED};">New plan</td><td align="right" class="biqc-ink" style="padding:10px 0;border-bottom:1px solid {BORDER};font-size:13px;color:{INK};font-weight:600;">{np_e}</td></tr>
  <tr><td class="biqc-ink-muted" style="padding:10px 0;border-bottom:1px solid {BORDER};font-size:13px;color:{INK_MUTED};">New price</td><td align="right" class="biqc-ink" style="padding:10px 0;border-bottom:1px solid {BORDER};font-size:13px;color:{INK};">{na_e}</td></tr>
  <tr><td class="biqc-ink-muted" style="padding:10px 0;font-size:13px;color:{INK_MUTED};">Effective from</td><td align="right" class="biqc-ink" style="padding:10px 0;font-size:13px;color:{INK};">{ed_e}</td></tr>
</table>
<p style="margin:0 0 26px;text-align:center;">{_button('View dashboard', dashboard_url)}</p>
<p class="biqc-ink-muted" style="margin:0;font-size:13px;color:{INK_MUTED};line-height:1.55;">Wrong plan? Reply here and we&rsquo;ll sort it out.</p>
"""
    text = (
        f"Hi {raw_first} — your BIQc plan changed from {old_plan} to {new_plan}.\n\n"
        f"  New price: {new_amount}\n  Effective from: {effective_date}\n\n"
        f"Dashboard: {dashboard_url}\n\n— The BIQc team"
    )
    return subject, _layout(preheader=preheader, body_html=body_html), text


# ────────────────────────── Template: E12 approaching allowance (B6) ──────────

def tmpl_approaching_allowance(*, full_name: str, plan_name: str, used: str,
                               allowance: str, pct: str, billing_url: str) -> Tuple[str, str, str]:
    """E12 — fires at 80% allowance (B6 daily cron)."""
    subject = f"You're at {pct} of your {plan_name} allowance"
    raw_first = (full_name or "").split(" ")[0] if full_name else "there"
    greet = _esc(raw_first)
    plan_e = _esc(plan_name)
    used_e = _esc(used)
    allow_e = _esc(allowance)
    pct_e = _esc(pct)
    preheader = f"Heads-up: {used} of {allowance} used this cycle. No action needed yet."
    body_html = f"""
<h1 class="biqc-h1 biqc-ink" style="margin:0 0 12px;font-family:{FONT_DISPLAY};font-size:28px;font-weight:600;letter-spacing:-0.02em;line-height:1.18;color:{INK_DISPLAY};">Heads-up &mdash; you&rsquo;re at {pct_e}</h1>
<p class="biqc-ink-sec" style="margin:0 0 22px;color:{INK_SEC};font-size:15px;">Hi {greet} &mdash; a quick note that your {plan_e} plan is {pct_e} of the way through this billing cycle&rsquo;s allowance.</p>
<table role="presentation" width="100%" style="margin:0 0 26px;">
  <tr><td style="padding:16px 18px;background:{LAVA_WASH};border:1px solid {LAVA_RING};border-radius:14px;">
    <div class="biqc-lava-text" style="font-family:{FONT_MONO};font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:{LAVA_DEEP};font-weight:700;">Usage this cycle</div>
    <div class="biqc-ink" style="margin-top:6px;font-family:{FONT_DISPLAY};font-size:20px;color:{INK_DISPLAY};font-weight:600;letter-spacing:-0.015em;">{used_e}</div>
    <div class="biqc-ink-sec" style="margin-top:6px;font-size:13px;color:{INK_SEC};">of {allow_e} included in your plan.</div>
  </td></tr>
</table>
<p class="biqc-ink-sec" style="margin:0 0 16px;color:{INK_SEC};font-size:15px;">Nothing breaks when you hit 100% &mdash; we&rsquo;ll email you again if you go over, and you can top up or upgrade any time.</p>
<p style="margin:0 0 26px;text-align:center;">{_button('Review usage & plan', billing_url)}</p>
<p class="biqc-ink-muted" style="margin:0;font-size:13px;color:{INK_MUTED};">Questions? Reply to this email.</p>
"""
    text = (
        f"Hi {raw_first} — you're at {pct} of your {plan_name} allowance this cycle.\n\n"
        f"Usage: {used} of {allowance}\n\n"
        f"Review: {billing_url}\n\n"
        f"Nothing breaks at 100% — we'll email you if you go over.\n\n— The BIQc team"
    )
    return subject, _layout(preheader=preheader, body_html=body_html), text


# ────────────────────────── Template: E13 topup processed (B7) ────────────────

def tmpl_topup_processed(*, full_name: str, plan_name: str, tokens_added: str,
                         amount: str, new_allowance: str,
                         invoice_url: str, dashboard_url: str) -> Tuple[str, str, str]:
    """E13 — fires on successful auto-top-up purchase (B7)."""
    subject = f"Top-up added — {tokens_added} · BIQc"
    raw_first = (full_name or "").split(" ")[0] if full_name else "there"
    greet = _esc(raw_first)
    plan_e = _esc(plan_name)
    tok_e = _esc(tokens_added)
    amt_e = _esc(amount)
    na_e = _esc(new_allowance)
    inv_url_e = _esc(invoice_url)
    preheader = f"Your top-up of {tokens_added} is live. Charged {amount}."
    body_html = f"""
<h1 class="biqc-h1 biqc-ink" style="margin:0 0 12px;font-family:{FONT_DISPLAY};font-size:28px;font-weight:600;letter-spacing:-0.02em;line-height:1.18;color:{INK_DISPLAY};">Top-up processed</h1>
<p class="biqc-ink-sec" style="margin:0 0 22px;color:{INK_SEC};font-size:15px;">Hi {greet} &mdash; your {plan_e} top-up is live. You can keep using BIQc without interruption.</p>
<table role="presentation" width="100%" style="border-collapse:collapse;margin:0 0 26px;">
  <tr><td class="biqc-ink-muted" style="padding:12px 0;border-bottom:1px solid {BORDER};font-size:13px;color:{INK_MUTED};">Top-up</td><td align="right" class="biqc-ink" style="padding:12px 0;border-bottom:1px solid {BORDER};font-family:{FONT_MONO};font-size:13px;color:{INK};">{tok_e}</td></tr>
  <tr><td class="biqc-ink-muted" style="padding:12px 0;border-bottom:1px solid {BORDER};font-size:13px;color:{INK_MUTED};">Amount charged</td><td align="right" class="biqc-ink" style="padding:12px 0;border-bottom:1px solid {BORDER};font-size:13px;color:{INK};font-weight:600;">{amt_e}</td></tr>
  <tr><td class="biqc-ink-muted" style="padding:12px 0;font-size:13px;color:{INK_MUTED};">New allowance this cycle</td><td align="right" class="biqc-ink" style="padding:12px 0;font-size:13px;color:{INK};font-weight:600;">{na_e}</td></tr>
</table>
<p style="margin:0 0 18px;"><a href="{inv_url_e}" class="biqc-lava-text" style="color:{LAVA_DEEP};font-weight:600;text-decoration:underline;font-size:14px;">Download receipt (PDF) &rarr;</a></p>
<p style="margin:0 0 26px;text-align:center;">{_button('Back to dashboard', dashboard_url)}</p>
<p class="biqc-ink-muted" style="margin:0;font-size:13px;color:{INK_MUTED};">Top-ups don&rsquo;t change your monthly plan &mdash; you stay on {plan_e}.</p>
"""
    text = (
        f"Hi {raw_first} — your {plan_name} top-up is live.\n\n"
        f"  Top-up: {tokens_added}\n"
        f"  Amount: {amount}\n"
        f"  New allowance this cycle: {new_allowance}\n\n"
        f"Receipt: {invoice_url}\n"
        f"Dashboard: {dashboard_url}\n\n— The BIQc team"
    )
    return subject, _layout(preheader=preheader, body_html=body_html), text


# ────────────────────────── Template: E14 topup failed (B7/B8) ────────────────

def tmpl_topup_failed(*, full_name: str, plan_name: str, amount: str,
                      reason: str, update_payment_url: str) -> Tuple[str, str, str]:
    """E14 — fires on declined auto-top-up (B7). User is blocked (B8) until card fixed."""
    subject = "Top-up failed — action required · BIQc"
    raw_first = (full_name or "").split(" ")[0] if full_name else "there"
    greet = _esc(raw_first)
    plan_e = _esc(plan_name)
    amt_e = _esc(amount)
    reason_e = _esc(reason or "the card was declined")
    preheader = f"We couldn't process your {amount} top-up. Update your card to retry."
    body_html = f"""
<h1 class="biqc-h1" style="margin:0 0 12px;font-family:{FONT_DISPLAY};font-size:28px;font-weight:600;letter-spacing:-0.02em;line-height:1.18;color:{DANGER};">Top-up failed</h1>
<p class="biqc-ink-sec" style="margin:0 0 16px;color:{INK_SEC};font-size:15px;">Hi {greet} &mdash; we couldn&rsquo;t process your <strong style="color:{INK};">{amt_e}</strong> top-up on your {plan_e} plan.</p>
<div style="margin:0 0 22px;padding:16px 18px;background:{DANGER_WASH};border:1px solid {DANGER_RING};border-radius:14px;font-size:13px;color:{INK_SEC};line-height:1.55;">
  <strong style="color:{DANGER};">Reason:</strong> {reason_e}
</div>
<p class="biqc-ink-sec" style="margin:0 0 26px;color:{INK_SEC};font-size:15px;">No tokens were added and you weren&rsquo;t charged. Update your card and we&rsquo;ll try again right away.</p>
<p style="margin:0 0 26px;text-align:center;">{_button('Update payment method', update_payment_url)}</p>
<p class="biqc-ink-muted" style="margin:0;font-size:13px;color:{INK_MUTED};">Think this is wrong? Reply to this email &mdash; we&rsquo;ll dig in.</p>
"""
    text = (
        f"Hi {raw_first} — we couldn't process your {amount} top-up on your {plan_name} plan.\n\n"
        f"Reason: {reason}\n\n"
        f"No tokens were added and you weren't charged.\n"
        f"Update your card: {update_payment_url}\n\n— The BIQc team"
    )
    return subject, _layout(preheader=preheader, body_html=body_html), text


# ────────────────────────── Template: E15 morning brief ───────────────────────

def tmpl_morning_brief(*, full_name: str, greeting: str,
                       top_actions: Optional[list] = None,
                       overnight_signals: Optional[list] = None,
                       advisor_url: str = "",
                       unsubscribe_url: str = "") -> Tuple[str, str, str]:
    """E15 — daily Morning Brief (05:00 AEST). Consumed by
    backend/jobs/morning_brief_worker.py reading from intelligence_queue.

    Contract
    --------
    top_actions       : list[dict{'text': str, 'impact': str}]  (0..N)
    overnight_signals : list[dict{'title': str, 'description': str}]  (0..3)

    Empty-state (both lists empty) uses the "All quiet" copy per spec.
    We still always render a valid, brand-consistent email — Track A
    commitment is that retention depends on daily out-of-app value, so
    a silent morning (real signal in itself) still gets an email.

    Args
    ----
    greeting        : date-string rendered in the eyebrow (caller computes
                      in Australia/Sydney tz so we don't couple this
                      module to a timezone library).
    unsubscribe_url : per-user unsub link. Falls back to the global
                      mailto when empty (matches footer default).
    """
    top_actions = list(top_actions or [])[:5]
    overnight_signals = list(overnight_signals or [])[:3]
    n = len(top_actions)

    raw_first = (full_name or "").split(" ")[0] if full_name else "there"
    greet_name = _esc(raw_first)
    greet_date = _esc(greeting)
    advisor_e = _esc(advisor_url or f"{APP_URL}/advisor")

    # Empty state: both lists literally empty -> all-quiet copy.
    is_quiet = (n == 0 and not overnight_signals)

    if is_quiet:
        subject = "Your morning brief — all quiet"
        preheader = "No alerts overnight. We'll keep watching."
    else:
        # Subject uses the count of ACTIONS (not signals). Spec:
        # "Your morning brief — {N} things to act on". When N=0 (signals
        # only) we fall back to a signals-led subject so it never reads
        # "0 things to act on" (nonsensical).
        if n == 0:
            subject = "Your morning brief — overnight signals"
            preheader = f"{len(overnight_signals)} thing(s) changed overnight. No actions yet."
        else:
            word = "thing" if n == 1 else "things"
            subject = f"Your morning brief — {n} {word} to act on"
            # Short preheader — leading card of top action (truncated).
            first_action_text = (top_actions[0].get("text") if top_actions else "") or ""
            snippet = first_action_text.strip()
            if len(snippet) > 120:
                snippet = snippet[:117].rstrip() + "..."
            preheader = f"{snippet or f'{n} action(s) lined up for you today.'}"

    # ── Body sections ──────────────────────────────────────────────────
    if is_quiet:
        actions_block = f"""
<div style="margin:0 0 24px;padding:18px 20px;background:{LAVA_WASH};border:1px solid {LAVA_RING};border-radius:14px;">
  <div class="biqc-lava-text" style="font-family:{FONT_MONO};font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:{LAVA_DEEP};font-weight:700;margin-bottom:6px;">This morning</div>
  <div class="biqc-ink" style="color:{INK};font-weight:600;font-size:16px;">All quiet this morning.</div>
  <div class="biqc-ink-sec" style="margin-top:6px;color:{INK_SEC};font-size:13px;">We&rsquo;ll keep watching your business and nudge you when something changes.</div>
</div>
"""
        signals_block = ""
    else:
        # Top actions section
        if top_actions:
            items_html_parts = []
            for a in top_actions:
                action_text = _esc(a.get("text") or "Review this item.")
                impact_text = _esc(a.get("impact") or "")
                impact_html = (
                    f'<div class="biqc-ink-sec" style="margin-top:4px;color:{INK_SEC};font-size:13px;line-height:1.55;">{impact_text}</div>'
                    if impact_text else ""
                )
                items_html_parts.append(
                    f'<li style="margin-bottom:14px;padding-left:4px;">'
                    f'<div class="biqc-ink" style="color:{INK};font-weight:600;font-size:15px;line-height:1.45;">{action_text}</div>'
                    f'{impact_html}'
                    f'</li>'
                )
            items_html = "".join(items_html_parts)
            title_word = "thing" if n == 1 else "things"
            actions_block = f"""
<div class="biqc-lava-text" style="font-family:{FONT_MONO};font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:{LAVA_DEEP};font-weight:700;margin:0 0 10px;">Top {n} {title_word} to act on</div>
<ul style="margin:0 0 24px;padding-left:20px;list-style:disc;color:{INK};">
  {items_html}
</ul>
"""
        else:
            actions_block = ""

        # Overnight signals section
        if overnight_signals:
            sig_rows = []
            last_idx = len(overnight_signals) - 1
            for i, s in enumerate(overnight_signals):
                title = _esc(s.get("title") or "Signal")
                desc = _esc(s.get("description") or "")
                desc_html = (
                    f'<div class="biqc-ink-sec" style="margin-top:4px;color:{INK_SEC};font-size:13px;line-height:1.55;">{desc}</div>'
                    if desc else ""
                )
                sig_rows.append(
                    f'<tr><td style="padding:14px 16px;background:{SURFACE_SUNK};border:1px solid {BORDER};border-radius:12px;">'
                    f'<div class="biqc-ink" style="color:{INK};font-weight:600;font-size:14px;line-height:1.45;">{title}</div>'
                    f'{desc_html}'
                    f'</td></tr>'
                )
                # Inter-card spacer (not after the last row)
                if i != last_idx:
                    sig_rows.append('<tr><td style="height:10px;line-height:10px;font-size:10px;">&nbsp;</td></tr>')
            sig_html = "".join(sig_rows)
            signals_block = f"""
<div class="biqc-lava-text" style="font-family:{FONT_MONO};font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:{LAVA_DEEP};font-weight:700;margin:4px 0 10px;">What changed overnight</div>
<table role="presentation" width="100%" style="margin:0 0 24px;border-collapse:separate;border-spacing:0;">
  {sig_html}
</table>
"""
        else:
            signals_block = ""

    body_html = f"""
<div class="biqc-ink-muted" style="font-family:{FONT_MONO};font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:{INK_MUTED};font-weight:700;margin:0 0 6px;">{greet_date}</div>
<h1 class="biqc-h1 biqc-ink" style="margin:0 0 18px;font-family:{FONT_DISPLAY};font-size:30px;font-weight:600;letter-spacing:-0.02em;line-height:1.12;color:{INK_DISPLAY};">Good morning, {greet_name}.</h1>
{actions_block}
{signals_block}
<p style="margin:0 0 26px;text-align:center;">{_button('Open advisor', advisor_url or f"{APP_URL}/advisor")}</p>
<p class="biqc-ink-muted" style="margin:0;font-size:13px;color:{INK_MUTED};line-height:1.55;">This is your daily BIQc brief. Reply to this email if anything doesn&rsquo;t feel right &mdash; it goes to a real person.</p>
"""

    # ── Plain-text version ────────────────────────────────────────────
    lines: list = []
    lines.append(f"{greeting}")
    lines.append("")
    lines.append(f"Good morning, {raw_first}.")
    lines.append("")
    if is_quiet:
        lines.append("All quiet this morning. We'll keep watching.")
        lines.append("")
    else:
        if top_actions:
            title_word = "thing" if n == 1 else "things"
            lines.append(f"TOP {n} {title_word.upper()} TO ACT ON")
            for i, a in enumerate(top_actions, 1):
                lines.append(f"  {i}. {a.get('text') or 'Review this item.'}")
                impact = (a.get("impact") or "").strip()
                if impact:
                    lines.append(f"     {impact}")
            lines.append("")
        if overnight_signals:
            lines.append("WHAT CHANGED OVERNIGHT")
            for s in overnight_signals:
                lines.append(f"  - {s.get('title') or 'Signal'}")
                desc = (s.get("description") or "").strip()
                if desc:
                    lines.append(f"    {desc}")
            lines.append("")
    lines.append(f"Open advisor: {advisor_url or f'{APP_URL}/advisor'}")
    lines.append("")
    lines.append("— The BIQc team")
    text = "\n".join(lines)

    return subject, _layout(preheader=preheader, body_html=body_html), text


# ────────────────────────── Resend HTTP client ────────────────────────────────

def _send_via_resend(*, to: str, subject: str, html: str, text: str,
                     reply_to: Optional[str] = None) -> Optional[str]:
    """POST to Resend. Returns the Resend email id on success, None on
    failure (logged, not raised — transactional emails shouldn't block
    the calling request if they fail).
    """
    if not RESEND_API_KEY:
        logger.error("[email] RESEND_API_KEY not configured; cannot send email to %s", to)
        return None
    payload: Dict[str, Any] = {
        "from": RESEND_FROM_EMAIL,
        "to": [to],
        "subject": subject,
        "html": html,
        "text": text,
    }
    if reply_to:
        payload["reply_to"] = reply_to
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.post(
                "https://api.resend.com/emails",
                json=payload,
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
            )
        if r.status_code >= 200 and r.status_code < 300:
            try:
                data = r.json()
            except Exception:
                data = {}
            email_id = data.get("id")
            logger.info("[email] sent to=%s subject=%r id=%s", to, subject, email_id)
            return email_id
        logger.error("[email] send failed to=%s status=%s body=%s", to, r.status_code, r.text[:300])
        return None
    except Exception as exc:
        logger.error("[email] send exception to=%s subject=%r: %s", to, subject, exc)
        return None


# ────────────────────────── Public API ────────────────────────────────────────

def make_verification_token() -> Tuple[str, str]:
    """Return (raw_token, sha256_hash). Store the hash, email the raw."""
    raw = secrets.token_urlsafe(32)
    h = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return raw, h


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def send_verification_email(*, to: str, full_name: str, token: str,
                            plan_name: str, first_charge_date: str,
                            first_charge_amount: str) -> Optional[str]:
    url = f"{APP_URL}/verify-email?token={token}"
    subject, html_body, text = tmpl_verification(
        full_name=full_name, verification_url=url,
        plan_name=plan_name, first_charge_date=first_charge_date,
        first_charge_amount=first_charge_amount,
    )
    return _send_via_resend(to=to, subject=subject, html=html_body, text=text,
                            reply_to="support@biqc.ai")


def send_verified_email(*, to: str, full_name: str, plan_name: str,
                        first_charge_date: str, first_charge_amount: str) -> Optional[str]:
    url = f"{APP_URL}/login-supabase"
    subject, html_body, text = tmpl_verified(
        full_name=full_name, login_url=url,
        plan_name=plan_name, first_charge_date=first_charge_date,
        first_charge_amount=first_charge_amount,
    )
    return _send_via_resend(to=to, subject=subject, html=html_body, text=text,
                            reply_to="support@biqc.ai")


def send_password_reset_email(*, to: str, full_name: str, reset_url: str) -> Optional[str]:
    subject, html_body, text = tmpl_password_reset(full_name=full_name, reset_url=reset_url)
    return _send_via_resend(to=to, subject=subject, html=html_body, text=text,
                            reply_to="support@biqc.ai")


def send_password_reset_confirm_email(*, to: str, full_name: str) -> Optional[str]:
    subject, html_body, text = tmpl_password_reset_confirm(
        full_name=full_name, login_url=f"{APP_URL}/login-supabase",
    )
    return _send_via_resend(to=to, subject=subject, html=html_body, text=text,
                            reply_to="support@biqc.ai")


def send_trial_ended_paid_email(*, to: str, full_name: str, amount: str, plan_name: str,
                                next_charge_date: str, invoice_url: str) -> Optional[str]:
    subject, html_body, text = tmpl_trial_ended_paid(
        full_name=full_name, amount=amount, plan_name=plan_name,
        next_charge_date=next_charge_date,
        dashboard_url=f"{APP_URL}/advisor", invoice_url=invoice_url,
    )
    return _send_via_resend(to=to, subject=subject, html=html_body, text=text,
                            reply_to="support@biqc.ai")


def send_trial_cancelled_email(*, to: str, full_name: str, plan_name: str) -> Optional[str]:
    subject, html_body, text = tmpl_trial_cancelled(
        full_name=full_name, plan_name=plan_name,
        reactivate_url=f"{APP_URL}/register-supabase",
    )
    return _send_via_resend(to=to, subject=subject, html=html_body, text=text,
                            reply_to="support@biqc.ai")


def send_payment_receipt_email(*, to: str, full_name: str, amount: str, plan_name: str,
                               invoice_number: str, paid_date: str,
                               next_charge_date: str, invoice_url: str) -> Optional[str]:
    subject, html_body, text = tmpl_payment_receipt(
        full_name=full_name, amount=amount, plan_name=plan_name,
        invoice_number=invoice_number, paid_date=paid_date,
        next_charge_date=next_charge_date, invoice_url=invoice_url,
    )
    return _send_via_resend(to=to, subject=subject, html=html_body, text=text,
                            reply_to="support@biqc.ai")


def send_payment_failed_email(*, to: str, full_name: str, amount: str, plan_name: str,
                              retry_date: str) -> Optional[str]:
    subject, html_body, text = tmpl_payment_failed(
        full_name=full_name, amount=amount, plan_name=plan_name,
        update_payment_url=f"{APP_URL}/settings/billing", retry_date=retry_date,
    )
    return _send_via_resend(to=to, subject=subject, html=html_body, text=text,
                            reply_to="support@biqc.ai")


def send_account_suspended_email(*, to: str, full_name: str, plan_name: str) -> Optional[str]:
    subject, html_body, text = tmpl_account_suspended(
        full_name=full_name, plan_name=plan_name,
        update_payment_url=f"{APP_URL}/settings/billing",
    )
    return _send_via_resend(to=to, subject=subject, html=html_body, text=text,
                            reply_to="support@biqc.ai")


def send_subscription_cancelled_email(*, to: str, full_name: str, plan_name: str,
                                      access_end_date: str) -> Optional[str]:
    subject, html_body, text = tmpl_subscription_cancelled(
        full_name=full_name, plan_name=plan_name,
        access_end_date=access_end_date,
        reactivate_url=f"{APP_URL}/register-supabase",
    )
    return _send_via_resend(to=to, subject=subject, html=html_body, text=text,
                            reply_to="support@biqc.ai")


def send_plan_changed_email(*, to: str, full_name: str, old_plan: str, new_plan: str,
                            new_amount: str, effective_date: str) -> Optional[str]:
    subject, html_body, text = tmpl_plan_changed(
        full_name=full_name, old_plan=old_plan, new_plan=new_plan,
        new_amount=new_amount, effective_date=effective_date,
        dashboard_url=f"{APP_URL}/advisor",
    )
    return _send_via_resend(to=to, subject=subject, html=html_body, text=text,
                            reply_to="support@biqc.ai")


# ────────────────────────── B6/B7/B8 new wrappers ─────────────────────────────

def send_approaching_allowance_email(*, to: str, full_name: str, plan_name: str,
                                     used: str, allowance: str, pct: str) -> Optional[str]:
    """E12 — 80% allowance warning. Fired from backend/jobs/usage_threshold_check.py."""
    subject, html_body, text = tmpl_approaching_allowance(
        full_name=full_name, plan_name=plan_name,
        used=used, allowance=allowance, pct=pct,
        billing_url=f"{APP_URL}/settings/billing",
    )
    return _send_via_resend(to=to, subject=subject, html=html_body, text=text,
                            reply_to="support@biqc.ai")


def send_topup_processed_email(*, to: str, full_name: str, plan_name: str,
                               tokens_added: str, amount: str, new_allowance: str,
                               invoice_url: str) -> Optional[str]:
    """E13 — successful auto-top-up. Fired from Stripe invoice.payment_succeeded
    handler when the invoice is a top-up (not a subscription renewal)."""
    subject, html_body, text = tmpl_topup_processed(
        full_name=full_name, plan_name=plan_name,
        tokens_added=tokens_added, amount=amount,
        new_allowance=new_allowance,
        invoice_url=invoice_url,
        dashboard_url=f"{APP_URL}/advisor",
    )
    return _send_via_resend(to=to, subject=subject, html=html_body, text=text,
                            reply_to="support@biqc.ai")


def send_topup_failed_email(*, to: str, full_name: str, plan_name: str,
                            amount: str, reason: str) -> Optional[str]:
    """E14 — declined auto-top-up. User is also flagged payment_required=true
    (B8 middleware blocks consume routes until card fixed)."""
    subject, html_body, text = tmpl_topup_failed(
        full_name=full_name, plan_name=plan_name,
        amount=amount, reason=reason,
        update_payment_url=f"{APP_URL}/settings/billing",
    )
    return _send_via_resend(to=to, subject=subject, html=html_body, text=text,
                            reply_to="support@biqc.ai")


# ────────────────────────── Morning brief (E15) ───────────────────────────────

def send_morning_brief_email(*, to: str, full_name: str, greeting: str,
                             top_actions: Optional[list] = None,
                             overnight_signals: Optional[list] = None,
                             advisor_url: Optional[str] = None) -> Optional[str]:
    """E15 — daily Morning Brief. Fired from backend/jobs/morning_brief_worker.py
    which drains intelligence_queue rows with schedule_key='morning_brief'.

    Empty-state handling lives inside `tmpl_morning_brief` — the caller
    should pass whatever lists they have (may be empty) and the template
    renders the "all quiet" copy when both are empty.
    """
    subject, html_body, text = tmpl_morning_brief(
        full_name=full_name, greeting=greeting,
        top_actions=top_actions or [], overnight_signals=overnight_signals or [],
        advisor_url=advisor_url or f"{APP_URL}/advisor",
        unsubscribe_url=UNSUBSCRIBE_MAILTO,
    )
    return _send_via_resend(to=to, subject=subject, html=html_body, text=text,
                            reply_to="support@biqc.ai")
