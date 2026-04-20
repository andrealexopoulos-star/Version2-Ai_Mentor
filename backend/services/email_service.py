"""BIQc transactional email service — Resend-backed.

Single-file service that owns:
  - The shared BIQc-branded HTML layout (header, footer, lava accent)
  - Templates for the 11 transactional emails we send
  - The Resend HTTP client wrapper with retry-on-transient-error
  - A small public API: send_verification_email(user_id, ...),
    send_payment_receipt(user_id, invoice), etc.

Templates are inline HTML strings with `{placeholder}` substitution.
All CSS is inlined (email-client compat). No external assets.

2026-04-20 shipped as part of P0 email-verification sprint.
"""

from __future__ import annotations

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


# ── brand tokens (inline-CSS values) ──────────────────────────────
LAVA = "#E85D00"
LAVA_SOFT = "rgba(232,93,0,0.12)"
INK = "#0A0A0A"
INK_SEC = "#525252"
INK_MUTED = "#737373"
CANVAS = "#F2F4EC"
BORDER = "rgba(10,10,10,0.08)"
FONT_STACK = "Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
FONT_MONO = "'Geist Mono', ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace"


def _layout(*, preheader: str, body_html: str) -> str:
    """Shared BIQc-branded HTML email shell. Outer table structure for
    Outlook compat. Inline CSS only.

    `preheader` appears greyed-out in inbox previews (Gmail / Apple
    Mail) — use it as a one-line summary.
    """
    return f"""<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>BIQc</title>
</head>
<body style="margin:0;padding:0;background:{CANVAS};font-family:{FONT_STACK};color:{INK};">
<!-- Preheader (inbox preview text) -->
<div style="display:none;font-size:1px;color:{CANVAS};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
  {preheader}
</div>
<!-- Outer wrapper -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:{CANVAS};padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;background:#FFFFFF;border-radius:16px;border:1px solid {BORDER};overflow:hidden;">
      <!-- Header -->
      <tr><td style="padding:24px 32px 0;">
        <table role="presentation" width="100%"><tr>
          <td style="font-family:{FONT_STACK};font-size:20px;font-weight:600;color:{INK};letter-spacing:-0.02em;">
            <span style="color:{LAVA};">●</span>&nbsp; BIQc
          </td>
          <td align="right" style="font-family:{FONT_MONO};font-size:10px;color:{INK_MUTED};text-transform:uppercase;letter-spacing:0.08em;">
            Business Intelligence Centre
          </td>
        </tr></table>
      </td></tr>
      <!-- Body -->
      <tr><td style="padding:24px 32px 32px;font-family:{FONT_STACK};font-size:15px;line-height:1.55;color:{INK};">
        {body_html}
      </td></tr>
      <!-- Footer -->
      <tr><td style="padding:20px 32px;background:#FAFAFA;border-top:1px solid {BORDER};font-family:{FONT_STACK};font-size:12px;color:{INK_MUTED};line-height:1.5;">
        <div>BIQc — Business Intelligence Quotient Centre · Melbourne, Australia</div>
        <div style="margin-top:4px;">
          Questions? <a href="mailto:support@biqc.ai" style="color:{LAVA};text-decoration:none;">support@biqc.ai</a>
          &nbsp;·&nbsp;
          <a href="{APP_URL}/trust/privacy" style="color:{INK_MUTED};text-decoration:underline;">Privacy</a>
          &nbsp;·&nbsp;
          <a href="{APP_URL}/trust/terms" style="color:{INK_MUTED};text-decoration:underline;">Terms</a>
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""


def _button(label: str, url: str) -> str:
    """Lava-pill CTA. Wrapped in an MSO-conditional for Outlook's VML
    rendering (otherwise Outlook collapses the padding)."""
    return f"""<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{url}" style="height:44px;v-text-anchor:middle;width:240px;" arcsize="100%" stroke="f" fillcolor="{LAVA}"><w:anchorlock/><center style="color:#FFFFFF;font-family:{FONT_STACK};font-size:15px;font-weight:500;">{label}</center></v:roundrect><![endif]-->
<!--[if !mso]><!-- --><a href="{url}" style="background:{LAVA};color:#FFFFFF;display:inline-block;padding:13px 28px;border-radius:999px;font-family:{FONT_STACK};font-weight:500;font-size:15px;text-decoration:none;letter-spacing:-0.005em;">{label}</a><!--<![endif]-->"""


# ────────────────────────── Template: E1 verification ─────────────────────────

def tmpl_verification(*, full_name: str, verification_url: str, plan_name: str,
                      first_charge_date: str, first_charge_amount: str) -> Tuple[str, str, str]:
    """E1 — verification email. Must be clicked to activate account."""
    subject = "Verify your BIQc account to get started"
    greet = full_name.split(" ")[0] if full_name else "there"
    preheader = f"One click to activate your account — your trial is already live."
    body_html = f"""
<h1 style="margin:0 0 8px;font-family:{FONT_STACK};font-size:28px;font-weight:600;letter-spacing:-0.025em;line-height:1.15;color:{INK};">Welcome, {greet}.</h1>
<p style="margin:0 0 16px;color:{INK_SEC};">Your BIQc account is set up and your 14-day trial is active. One last step — click below to verify your email so we know it's really you.</p>
<p style="margin:0 0 28px;text-align:center;">{_button('Verify my email', verification_url)}</p>
<p style="margin:0 0 8px;font-size:13px;color:{INK_MUTED};">Or paste this link into your browser:</p>
<p style="margin:0 0 24px;font-family:{FONT_MONO};font-size:12px;color:{INK_SEC};word-break:break-all;background:#F6F7F9;padding:10px 12px;border-radius:8px;border:1px solid {BORDER};">{verification_url}</p>
<div style="margin:24px 0 0;padding:16px 18px;background:{LAVA_SOFT};border-radius:12px;border:1px solid rgba(232,93,0,0.18);">
  <div style="font-family:{FONT_MONO};font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:{LAVA};font-weight:600;margin-bottom:6px;">Your plan</div>
  <div style="color:{INK};font-weight:500;">{plan_name}</div>
  <div style="margin-top:6px;color:{INK_SEC};font-size:13px;">Free until <strong style="color:{INK};">{first_charge_date}</strong>. If you don't cancel before that date we'll charge <strong style="color:{INK};">{first_charge_amount}</strong> to your card on file.</div>
</div>
<p style="margin:24px 0 0;font-size:13px;color:{INK_MUTED};">The link above expires in 7 days. If you didn't sign up for BIQc, you can safely ignore this email.</p>
"""
    text = (
        f"Welcome, {greet}.\n\n"
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
    """E2 — after they click the verification link."""
    subject = "You're verified — welcome to BIQc"
    greet = full_name.split(" ")[0] if full_name else "there"
    preheader = "Your account is active. Here's what happens next."
    body_html = f"""
<h1 style="margin:0 0 8px;font-family:{FONT_STACK};font-size:28px;font-weight:600;letter-spacing:-0.025em;line-height:1.15;color:{INK};">You're in, {greet}.</h1>
<p style="margin:0 0 20px;color:{INK_SEC};">Your email is verified and your BIQc trial is live. Here's what you need to know:</p>
<table role="presentation" width="100%" style="margin:0 0 24px;">
  <tr><td style="padding:14px 16px;background:#F6F7F9;border:1px solid {BORDER};border-radius:12px;">
    <div style="font-family:{FONT_MONO};font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:{INK_MUTED};">Your plan</div>
    <div style="margin-top:4px;font-size:16px;color:{INK};font-weight:500;">{plan_name}</div>
    <div style="margin-top:8px;font-size:13px;color:{INK_SEC};">Free until <strong style="color:{INK};">{first_charge_date}</strong> · First charge <strong style="color:{INK};">{first_charge_amount}</strong></div>
    <div style="margin-top:6px;font-size:12px;color:{INK_MUTED};">Cancel any time before {first_charge_date} for $0.</div>
  </td></tr>
</table>
<p style="margin:0 0 24px;text-align:center;">{_button('Sign in to BIQc', login_url)}</p>
<div style="margin:12px 0 0;color:{INK_SEC};">
<p style="margin:0 0 10px;font-weight:500;color:{INK};">What to do in the next 5 minutes</p>
<ol style="margin:0;padding-left:20px;">
  <li style="margin-bottom:6px;">Connect your inbox (Outlook or Gmail) — BIQc needs it to start reading the room.</li>
  <li style="margin-bottom:6px;">Complete your business profile so we can benchmark you properly.</li>
  <li>Check back tomorrow morning — your first intelligence brief will be ready.</li>
</ol>
</div>
<p style="margin:24px 0 0;font-size:13px;color:{INK_MUTED};">Need help? Reply to this email — it goes to a real person.</p>
"""
    text = (
        f"You're in, {greet}.\n\n"
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
    greet = full_name.split(" ")[0] if full_name else "there"
    preheader = "Password reset link — expires in 1 hour."
    body_html = f"""
<h1 style="margin:0 0 8px;font-family:{FONT_STACK};font-size:28px;font-weight:600;letter-spacing:-0.025em;line-height:1.15;color:{INK};">Reset your password</h1>
<p style="margin:0 0 16px;color:{INK_SEC};">Hi {greet} — we got a request to reset your BIQc password. Click below to set a new one.</p>
<p style="margin:0 0 28px;text-align:center;">{_button('Reset password', reset_url)}</p>
<p style="margin:0 0 8px;font-size:13px;color:{INK_MUTED};">Or paste this link into your browser:</p>
<p style="margin:0 0 24px;font-family:{FONT_MONO};font-size:12px;color:{INK_SEC};word-break:break-all;background:#F6F7F9;padding:10px 12px;border-radius:8px;border:1px solid {BORDER};">{reset_url}</p>
<div style="margin:16px 0 0;padding:14px 16px;background:#F6F7F9;border-radius:12px;border:1px solid {BORDER};font-size:13px;color:{INK_SEC};">
  <strong style="color:{INK};">This link expires in 1 hour.</strong> If you didn't request this, you can safely ignore this email — your password won't change.
</div>
"""
    text = (
        f"Hi {greet} — reset your BIQc password at this link (expires in 1 hour):\n\n"
        f"{reset_url}\n\nIf you didn't request this, ignore this email.\n\n— The BIQc team"
    )
    return subject, _layout(preheader=preheader, body_html=body_html), text


# ────────────────────────── Template: E4 password reset confirm ───────────────

def tmpl_password_reset_confirm(*, full_name: str, login_url: str) -> Tuple[str, str, str]:
    subject = "Your BIQc password was changed"
    greet = full_name.split(" ")[0] if full_name else "there"
    preheader = "Your password was changed. If this wasn't you, contact support immediately."
    body_html = f"""
<h1 style="margin:0 0 8px;font-family:{FONT_STACK};font-size:26px;font-weight:600;letter-spacing:-0.025em;line-height:1.2;color:{INK};">Password changed</h1>
<p style="margin:0 0 16px;color:{INK_SEC};">Hi {greet} — your BIQc password was just updated. You can sign in with your new password now.</p>
<p style="margin:0 0 24px;text-align:center;">{_button('Sign in', login_url)}</p>
<div style="margin:0;padding:14px 16px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.18);border-radius:12px;font-size:13px;color:{INK_SEC};">
  <strong style="color:#B91C1C;">Didn't change your password?</strong> Reply to this email or contact <a href="mailto:support@biqc.ai" style="color:{LAVA};">support@biqc.ai</a> immediately — we'll lock the account while we investigate.
</div>
"""
    text = (
        f"Hi {greet} — your BIQc password was changed.\n\n"
        f"Sign in: {login_url}\n\n"
        f"Didn't do this? Email support@biqc.ai immediately."
    )
    return subject, _layout(preheader=preheader, body_html=body_html), text


# ────────────────────────── Template: E5 trial-end charge succeeded ───────────

def tmpl_trial_ended_paid(*, full_name: str, amount: str, plan_name: str,
                          next_charge_date: str, dashboard_url: str, invoice_url: str) -> Tuple[str, str, str]:
    subject = f"Trial ended — {amount} charged · BIQc"
    greet = full_name.split(" ")[0] if full_name else "there"
    preheader = f"Your BIQc trial converted. Next charge {next_charge_date}."
    body_html = f"""
<h1 style="margin:0 0 8px;font-family:{FONT_STACK};font-size:26px;font-weight:600;letter-spacing:-0.025em;line-height:1.2;color:{INK};">Your trial just converted</h1>
<p style="margin:0 0 16px;color:{INK_SEC};">Hi {greet} — your 14-day trial wrapped up and we successfully charged <strong style="color:{INK};">{amount}</strong> to your card for your first {plan_name} billing cycle.</p>
<p style="margin:0 0 8px;color:{INK_SEC};">Next billing: <strong style="color:{INK};">{next_charge_date}</strong></p>
<p style="margin:16px 0 24px;"><a href="{invoice_url}" style="color:{LAVA};">Download receipt (PDF)</a></p>
<p style="margin:0 0 24px;text-align:center;">{_button('Open dashboard', dashboard_url)}</p>
<p style="margin:0;font-size:13px;color:{INK_MUTED};">Thanks for paying BIQc — we take it seriously. If anything feels off about the platform, reply here and tell us.</p>
"""
    text = (
        f"Hi {greet} — your 14-day trial wrapped up and we charged {amount} for your first {plan_name} cycle.\n\n"
        f"Next billing: {next_charge_date}\n"
        f"Receipt: {invoice_url}\n"
        f"Dashboard: {dashboard_url}\n\n"
        f"Questions? Reply to this email.\n\n— The BIQc team"
    )
    return subject, _layout(preheader=preheader, body_html=body_html), text


# ────────────────────────── Template: E6 trial cancelled ──────────────────────

def tmpl_trial_cancelled(*, full_name: str, plan_name: str, reactivate_url: str) -> Tuple[str, str, str]:
    subject = "Your BIQc trial is cancelled — no charge"
    greet = full_name.split(" ")[0] if full_name else "there"
    preheader = "No charge will be made. Come back anytime."
    body_html = f"""
<h1 style="margin:0 0 8px;font-family:{FONT_STACK};font-size:26px;font-weight:600;letter-spacing:-0.025em;line-height:1.2;color:{INK};">Trial cancelled — you're all clear</h1>
<p style="margin:0 0 16px;color:{INK_SEC};">Hi {greet} — you cancelled your {plan_name} trial before the 14-day mark. <strong style="color:{INK};">No charge will be made.</strong> Your card is off file.</p>
<p style="margin:0 0 24px;color:{INK_SEC};">If you change your mind, your account and any calibration data we captured will be here waiting.</p>
<p style="margin:0 0 24px;text-align:center;">{_button('Reactivate BIQc', reactivate_url)}</p>
<p style="margin:0;font-size:13px;color:{INK_MUTED};">Out of curiosity — if anything was missing or felt rough, reply and let us know. Every bit of feedback makes BIQc better for the next SMB that tries us.</p>
"""
    text = (
        f"Hi {greet} — your {plan_name} trial is cancelled. No charge will be made.\n\n"
        f"Reactivate anytime: {reactivate_url}\n\n"
        f"What felt rough? Reply here.\n\n— The BIQc team"
    )
    return subject, _layout(preheader=preheader, body_html=body_html), text


# ────────────────────────── Template: E7 payment receipt ──────────────────────

def tmpl_payment_receipt(*, full_name: str, amount: str, plan_name: str,
                         invoice_number: str, paid_date: str, next_charge_date: str,
                         invoice_url: str) -> Tuple[str, str, str]:
    subject = f"Receipt — {amount} · BIQc · {invoice_number}"
    greet = full_name.split(" ")[0] if full_name else "there"
    preheader = f"Receipt for {amount}. Next charge {next_charge_date}."
    body_html = f"""
<h1 style="margin:0 0 8px;font-family:{FONT_STACK};font-size:26px;font-weight:600;letter-spacing:-0.025em;line-height:1.2;color:{INK};">Thanks for your payment</h1>
<p style="margin:0 0 20px;color:{INK_SEC};">Hi {greet} — your {plan_name} subscription renewed successfully. Here's the breakdown:</p>
<table role="presentation" width="100%" style="border-collapse:collapse;margin:0 0 24px;">
  <tr><td style="padding:12px 0;border-bottom:1px solid {BORDER};font-size:13px;color:{INK_MUTED};">Invoice</td><td align="right" style="padding:12px 0;border-bottom:1px solid {BORDER};font-family:{FONT_MONO};font-size:13px;color:{INK};">{invoice_number}</td></tr>
  <tr><td style="padding:12px 0;border-bottom:1px solid {BORDER};font-size:13px;color:{INK_MUTED};">Paid on</td><td align="right" style="padding:12px 0;border-bottom:1px solid {BORDER};font-size:13px;color:{INK};">{paid_date}</td></tr>
  <tr><td style="padding:12px 0;border-bottom:1px solid {BORDER};font-size:13px;color:{INK_MUTED};">Plan</td><td align="right" style="padding:12px 0;border-bottom:1px solid {BORDER};font-size:13px;color:{INK};">{plan_name}</td></tr>
  <tr><td style="padding:12px 0;font-size:15px;color:{INK};font-weight:500;">Amount</td><td align="right" style="padding:12px 0;font-size:15px;color:{INK};font-weight:600;">{amount}</td></tr>
</table>
<p style="margin:0 0 8px;color:{INK_SEC};">Next charge: <strong style="color:{INK};">{next_charge_date}</strong></p>
<p style="margin:0 0 24px;"><a href="{invoice_url}" style="color:{LAVA};">Download full receipt (PDF)</a></p>
<p style="margin:0;font-size:13px;color:{INK_MUTED};">Want to change plan or cancel? Manage your subscription in the dashboard.</p>
"""
    text = (
        f"Hi {greet} — receipt for your {plan_name} subscription:\n\n"
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
    subject = f"Payment failed — action required · BIQc"
    greet = full_name.split(" ")[0] if full_name else "there"
    preheader = f"We couldn't charge {amount}. Update your card to keep your subscription."
    body_html = f"""
<h1 style="margin:0 0 8px;font-family:{FONT_STACK};font-size:26px;font-weight:600;letter-spacing:-0.025em;line-height:1.2;color:#B91C1C;">We couldn't charge your card</h1>
<p style="margin:0 0 16px;color:{INK_SEC};">Hi {greet} — your bank declined the <strong style="color:{INK};">{amount}</strong> charge for your {plan_name} subscription.</p>
<p style="margin:0 0 24px;color:{INK_SEC};">We'll retry automatically on <strong style="color:{INK};">{retry_date}</strong>. If the card is no longer valid, please update it now to avoid interruption.</p>
<p style="margin:0 0 24px;text-align:center;">{_button('Update payment method', update_payment_url)}</p>
<div style="margin:0;padding:14px 16px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.18);border-radius:12px;font-size:13px;color:{INK_SEC};">
  If we can't collect after multiple retries your BIQc access will be suspended. Don't let the intelligence you've built go dark — update your card now.
</div>
<p style="margin:24px 0 0;font-size:13px;color:{INK_MUTED};">Think this is wrong? Reply to this email — we'll dig in.</p>
"""
    text = (
        f"Hi {greet} — your bank declined the {amount} charge for your {plan_name} subscription.\n\n"
        f"We'll retry on {retry_date}. To avoid interruption, update your card now:\n\n"
        f"{update_payment_url}\n\n— The BIQc team"
    )
    return subject, _layout(preheader=preheader, body_html=body_html), text


# ────────────────────────── Template: E9 account suspended ────────────────────

def tmpl_account_suspended(*, full_name: str, plan_name: str, update_payment_url: str) -> Tuple[str, str, str]:
    subject = "Your BIQc access is suspended — update payment"
    greet = full_name.split(" ")[0] if full_name else "there"
    preheader = "Access suspended after multiple failed charges. Update your card to resume."
    body_html = f"""
<h1 style="margin:0 0 8px;font-family:{FONT_STACK};font-size:26px;font-weight:600;letter-spacing:-0.025em;line-height:1.2;color:#B91C1C;">Access suspended</h1>
<p style="margin:0 0 16px;color:{INK_SEC};">Hi {greet} — we tried multiple times to charge your card for your {plan_name} subscription and the bank declined each time. <strong style="color:{INK};">Your BIQc access is now suspended.</strong></p>
<p style="margin:0 0 24px;color:{INK_SEC};">Your data, calibration, and intelligence history are intact. Update your payment method to resume instantly.</p>
<p style="margin:0 0 24px;text-align:center;">{_button('Update card + reactivate', update_payment_url)}</p>
<p style="margin:0;font-size:13px;color:{INK_MUTED};">No resolution after 30 days and we'll archive the account per our data-retention policy. Need help? Reply here.</p>
"""
    text = (
        f"Hi {greet} — your BIQc access is suspended after multiple failed charges on your {plan_name} subscription.\n\n"
        f"Your data is intact. Update your card to resume:\n\n"
        f"{update_payment_url}\n\n"
        f"No resolution after 30 days = archive per our retention policy.\n\n— The BIQc team"
    )
    return subject, _layout(preheader=preheader, body_html=body_html), text


# ────────────────────────── Template: E10 subscription cancelled ──────────────

def tmpl_subscription_cancelled(*, full_name: str, plan_name: str, access_end_date: str, reactivate_url: str) -> Tuple[str, str, str]:
    subject = "Your BIQc subscription is cancelled"
    greet = full_name.split(" ")[0] if full_name else "there"
    preheader = f"Cancelled. Access continues until {access_end_date}."
    body_html = f"""
<h1 style="margin:0 0 8px;font-family:{FONT_STACK};font-size:26px;font-weight:600;letter-spacing:-0.025em;line-height:1.2;color:{INK};">Your subscription is cancelled</h1>
<p style="margin:0 0 16px;color:{INK_SEC};">Hi {greet} — we've cancelled your {plan_name} subscription as requested. No further charges will be made.</p>
<table role="presentation" width="100%" style="margin:0 0 24px;">
  <tr><td style="padding:14px 16px;background:#F6F7F9;border:1px solid {BORDER};border-radius:12px;">
    <div style="font-family:{FONT_MONO};font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:{INK_MUTED};">Access continues until</div>
    <div style="margin-top:4px;font-size:18px;color:{INK};font-weight:500;">{access_end_date}</div>
    <div style="margin-top:6px;font-size:13px;color:{INK_SEC};">Use it while you have it — then the account will go read-only.</div>
  </td></tr>
</table>
<p style="margin:0 0 24px;text-align:center;">{_button('Reactivate', reactivate_url)}</p>
<p style="margin:0;font-size:13px;color:{INK_MUTED};">If you cancelled by mistake, reactivate with one click — your data and intelligence history are untouched.</p>
"""
    text = (
        f"Hi {greet} — your {plan_name} subscription is cancelled. No further charges.\n\n"
        f"Access continues until {access_end_date}, then read-only.\n\n"
        f"Reactivate: {reactivate_url}\n\n— The BIQc team"
    )
    return subject, _layout(preheader=preheader, body_html=body_html), text


# ────────────────────────── Template: E11 plan changed ────────────────────────

def tmpl_plan_changed(*, full_name: str, old_plan: str, new_plan: str,
                      new_amount: str, effective_date: str, dashboard_url: str) -> Tuple[str, str, str]:
    direction = "upgraded" if new_plan.lower() > old_plan.lower() else "changed"
    subject = f"Plan {direction} — {new_plan} · BIQc"
    greet = full_name.split(" ")[0] if full_name else "there"
    preheader = f"You're on {new_plan} from {effective_date}."
    body_html = f"""
<h1 style="margin:0 0 8px;font-family:{FONT_STACK};font-size:26px;font-weight:600;letter-spacing:-0.025em;line-height:1.2;color:{INK};">Plan {direction}</h1>
<p style="margin:0 0 16px;color:{INK_SEC};">Hi {greet} — your BIQc plan changed from <strong>{old_plan}</strong> to <strong style="color:{INK};">{new_plan}</strong>.</p>
<table role="presentation" width="100%" style="margin:0 0 24px;border-collapse:collapse;">
  <tr><td style="padding:10px 0;border-bottom:1px solid {BORDER};font-size:13px;color:{INK_MUTED};">New plan</td><td align="right" style="padding:10px 0;border-bottom:1px solid {BORDER};font-size:13px;color:{INK};font-weight:500;">{new_plan}</td></tr>
  <tr><td style="padding:10px 0;border-bottom:1px solid {BORDER};font-size:13px;color:{INK_MUTED};">New price</td><td align="right" style="padding:10px 0;border-bottom:1px solid {BORDER};font-size:13px;color:{INK};">{new_amount}</td></tr>
  <tr><td style="padding:10px 0;font-size:13px;color:{INK_MUTED};">Effective from</td><td align="right" style="padding:10px 0;font-size:13px;color:{INK};">{effective_date}</td></tr>
</table>
<p style="margin:0 0 24px;text-align:center;">{_button('View dashboard', dashboard_url)}</p>
<p style="margin:0;font-size:13px;color:{INK_MUTED};">Wrong plan? Reply here and we'll sort it out.</p>
"""
    text = (
        f"Hi {greet} — your BIQc plan changed from {old_plan} to {new_plan}.\n\n"
        f"  New price: {new_amount}\n  Effective from: {effective_date}\n\n"
        f"Dashboard: {dashboard_url}\n\n— The BIQc team"
    )
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
    subject, html, text = tmpl_verification(
        full_name=full_name, verification_url=url,
        plan_name=plan_name, first_charge_date=first_charge_date,
        first_charge_amount=first_charge_amount,
    )
    return _send_via_resend(to=to, subject=subject, html=html, text=text,
                            reply_to="support@biqc.ai")


def send_verified_email(*, to: str, full_name: str, plan_name: str,
                        first_charge_date: str, first_charge_amount: str) -> Optional[str]:
    url = f"{APP_URL}/login-supabase"
    subject, html, text = tmpl_verified(
        full_name=full_name, login_url=url,
        plan_name=plan_name, first_charge_date=first_charge_date,
        first_charge_amount=first_charge_amount,
    )
    return _send_via_resend(to=to, subject=subject, html=html, text=text,
                            reply_to="support@biqc.ai")


def send_password_reset_email(*, to: str, full_name: str, reset_url: str) -> Optional[str]:
    subject, html, text = tmpl_password_reset(full_name=full_name, reset_url=reset_url)
    return _send_via_resend(to=to, subject=subject, html=html, text=text,
                            reply_to="support@biqc.ai")


def send_password_reset_confirm_email(*, to: str, full_name: str) -> Optional[str]:
    subject, html, text = tmpl_password_reset_confirm(
        full_name=full_name, login_url=f"{APP_URL}/login-supabase",
    )
    return _send_via_resend(to=to, subject=subject, html=html, text=text,
                            reply_to="support@biqc.ai")


def send_trial_ended_paid_email(*, to: str, full_name: str, amount: str, plan_name: str,
                                next_charge_date: str, invoice_url: str) -> Optional[str]:
    subject, html, text = tmpl_trial_ended_paid(
        full_name=full_name, amount=amount, plan_name=plan_name,
        next_charge_date=next_charge_date,
        dashboard_url=f"{APP_URL}/advisor", invoice_url=invoice_url,
    )
    return _send_via_resend(to=to, subject=subject, html=html, text=text,
                            reply_to="support@biqc.ai")


def send_trial_cancelled_email(*, to: str, full_name: str, plan_name: str) -> Optional[str]:
    subject, html, text = tmpl_trial_cancelled(
        full_name=full_name, plan_name=plan_name,
        reactivate_url=f"{APP_URL}/register-supabase",
    )
    return _send_via_resend(to=to, subject=subject, html=html, text=text,
                            reply_to="support@biqc.ai")


def send_payment_receipt_email(*, to: str, full_name: str, amount: str, plan_name: str,
                               invoice_number: str, paid_date: str,
                               next_charge_date: str, invoice_url: str) -> Optional[str]:
    subject, html, text = tmpl_payment_receipt(
        full_name=full_name, amount=amount, plan_name=plan_name,
        invoice_number=invoice_number, paid_date=paid_date,
        next_charge_date=next_charge_date, invoice_url=invoice_url,
    )
    return _send_via_resend(to=to, subject=subject, html=html, text=text,
                            reply_to="support@biqc.ai")


def send_payment_failed_email(*, to: str, full_name: str, amount: str, plan_name: str,
                              retry_date: str) -> Optional[str]:
    subject, html, text = tmpl_payment_failed(
        full_name=full_name, amount=amount, plan_name=plan_name,
        update_payment_url=f"{APP_URL}/settings/billing", retry_date=retry_date,
    )
    return _send_via_resend(to=to, subject=subject, html=html, text=text,
                            reply_to="support@biqc.ai")


def send_account_suspended_email(*, to: str, full_name: str, plan_name: str) -> Optional[str]:
    subject, html, text = tmpl_account_suspended(
        full_name=full_name, plan_name=plan_name,
        update_payment_url=f"{APP_URL}/settings/billing",
    )
    return _send_via_resend(to=to, subject=subject, html=html, text=text,
                            reply_to="support@biqc.ai")


def send_subscription_cancelled_email(*, to: str, full_name: str, plan_name: str,
                                      access_end_date: str) -> Optional[str]:
    subject, html, text = tmpl_subscription_cancelled(
        full_name=full_name, plan_name=plan_name,
        access_end_date=access_end_date,
        reactivate_url=f"{APP_URL}/register-supabase",
    )
    return _send_via_resend(to=to, subject=subject, html=html, text=text,
                            reply_to="support@biqc.ai")


def send_plan_changed_email(*, to: str, full_name: str, old_plan: str, new_plan: str,
                            new_amount: str, effective_date: str) -> Optional[str]:
    subject, html, text = tmpl_plan_changed(
        full_name=full_name, old_plan=old_plan, new_plan=new_plan,
        new_amount=new_amount, effective_date=effective_date,
        dashboard_url=f"{APP_URL}/advisor",
    )
    return _send_via_resend(to=to, subject=subject, html=html, text=text,
                            reply_to="support@biqc.ai")
