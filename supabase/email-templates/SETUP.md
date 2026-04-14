# BIQc Supabase Email Template Setup

## How to install these templates

1. Go to **Supabase Dashboard** → your project → **Authentication** → **Email Templates**
2. For each template type below, paste the corresponding HTML file content
3. Update the **Subject** line as specified

### Template 1: Confirm signup
- **Subject:** `Confirm your BIQc account`
- **File:** `confirm-signup.html`

### Template 2: Reset password
- **Subject:** `Reset your BIQc password`
- **File:** `reset-password.html`

### Template 3: Magic link
- **Subject:** `Your BIQc login link`
- **File:** `magic-link.html`

### Template 4: Change email address
- **Subject:** `Confirm your new BIQc email`
- **File:** `change-email.html`

### Template 5: Invite user
- **Subject:** `You've been invited to BIQc`
- **File:** `invite-user.html`

## Enable email confirmation

In Supabase Dashboard → **Authentication** → **Providers** → **Email**:
- Toggle **Confirm email** to ON
- Set **Minimum password length** to 8

## Sender configuration

In Supabase Dashboard → **Authentication** → **SMTP Settings**:
- If using custom SMTP (Resend): configure with your Resend SMTP credentials
- **Sender name:** `BIQc`
- **Sender email:** `noreply@biqc.ai`

## Design system alignment

These templates use BIQc's design tokens:
- Primary brand: #E85D00 (Lava Orange)
- Text: #0A0A0A / #525252 / #737373
- Background: #FAFAFA (canvas-app) / #FFFFFF (surface)
- Border radius: 16px (card), 12px (button)
- Shadow: Apple-style elev-2
- Font: Inter with system fallbacks (email-safe)
- Contact email: support@biqc.ai
