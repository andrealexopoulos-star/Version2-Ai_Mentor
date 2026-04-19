# Positioning proposal — BIQc Website Review response

**Date:** 2026-04-19 (overnight work, to review morning of 2026-04-20)
**Driving source:** external BIQc Website Review, item #2

---

## The problem in one paragraph

The reviewer flagged that BIQc currently presents **six different identities** across the site, and any one of them is plausible but the buyer can't form a single mental model. "Decision tool" → "AI executive team" → "Cognition-as-a-Platform" → "anti-BI brain" → "command centre" → "Cognition-as-a-Service". McKinsey principle the reviewer cited: *"one sentence, one page"* — lead with it, repeat it, don't vary it.

## The six identities currently in play

| Location | Current phrase | Reads as |
|---|---|---|
| Homepage hero | "one intelligence layer for every decision that matters" | Decision tool |
| Homepage mid | "Your AI Executive Team, Powered By BIQc Trinity Intelligence Layer" | AI agent team |
| Footer / logo | "Cognition as a Platform" | Infrastructure play |
| Intelligence page | "A brain that thinks like an operator, not a dashboard" | Anti-BI product |
| Platform page | "See Your Entire Business. In One Place." | Command centre |
| Cognition section | "Cognition-as-a-Service" | Framework / meta-product |

## Recommendation — three candidate positions, pick one

Rank order from most-concrete to most-ambitious. I recommend **A**. The reviewer proposed something close to A.

### A. Operator's morning brief (recommended)

**One sentence:** *"BIQc reads your Xero, CRM, and inbox every night and sends you a morning brief of what needs attention."*

- **Why it works:** concrete, verb-led, names the integrations the buyer already uses, implies the "reads / connects / briefs" work without jargon. Matches the Trust & Security page voice (which the reviewer praised).
- **What it forces:** the mid-page "AI Executive Team / Trinity" framing must go. The Intelligence page's "brain that thinks like an operator" survives and gets amplified. The Cognition-as-a-Service / Cognition-as-a-Platform lines become internal terminology only.
- **Cost:** retires the "Trinity Intelligence Layer" and "AI Executive Team" marketing that's already built. Visually that's ~3 homepage sections + 1 subpage section to rewrite.

### B. Silent integrator ("stop reacting, start preventing")

**One sentence:** *"BIQc connects your 40+ business systems read-only and surfaces what changed before it becomes a fire."*

- **Why it works:** leans into the Merge.dev integration count (reviewer called this out as a real strength). Frames the product as prevention, which the reviewer noted lands well when not drowned in jargon.
- **What it forces:** pricing page feature list gets collapsed to "detection" capabilities. Homepage "Intelligence Engine" keeps its role.
- **Cost:** "decision intelligence" homepage hero retires. Implies more downstream restyle.

### C. Ops operating system ("your business, in one place, with a brain")

**One sentence:** *"BIQc is the operating intelligence layer for your Xero / CRM / inbox — one place to see what's happening, and a brain to tell you what to do about it."*

- **Why it works:** unifies the "platform" and "decision tool" camps into a single coherent product. Most ambitious.
- **What it forces:** the product has to deliver on BOTH "observation" AND "recommendation". Current state is stronger on observation.
- **Cost:** biggest rewrite effort + highest product-claim risk.

## Where the one sentence goes

Wherever it's picked, it appears — **verbatim, not paraphrased** — in:

1. Homepage hero H1 sub-line
2. Meta description tag (also fixes PDF #4 SEO partially)
3. OG tags (LinkedIn / Twitter preview cards)
4. Footer tagline under logo
5. First line of every subpage (About / Platform / Intelligence / Pricing)
6. Trust & Security page intro
7. Register page hero ("Start your free trial" + one-liner)

Keep supporting sub-claims ("operator-first", "Australian-sovereign", "Cognition engine") as **supporting language**, not alternate positions.

## What to do with the retiring phrases

- "Cognition-as-a-Service" / "Cognition-as-a-Platform" → internal platform team terminology. Remove from public surfaces; keep in architecture docs.
- "AI Executive Team" / "Trinity Intelligence Layer" → technical feature names inside the product, not a top-line positioning. Rename the homepage "AI Executive Team" section to "How the brief gets made" or similar and move it below the fold.
- "Intelligence layer" → retain as a secondary technical term, never lead with it.

## Success criteria for the rewrite

- A new visitor can answer *"what does BIQc do in one sentence"* after 10 seconds on the site.
- Three random subpages use the same sentence; zero unique hero variants.
- The Register page's hero claim matches the homepage claim exactly.
- Meta description + OG image caption match the hero H1 sub-line.

## Next actions

1. **You pick A / B / C** (or propose D).
2. Once locked, I'll open a single PR that applies the change to all seven surfaces above + the meta/OG tags. Single PR so the change lands atomically — no mixed positioning state in prod.
3. Promo video (#6) stays deferred until this lock happens, per the reviewer's own sequencing.
