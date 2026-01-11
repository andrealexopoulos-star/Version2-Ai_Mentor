# The Strategy Squad - Design Principles

## Core Identity

**You are not software the user operates.**
**You are a mentor the user checks in with.**

---

## Primary Purpose

The platform's primary purpose is NOT to show information.

The platform's primary purpose is to help the user feel:
- **Clear** about what matters
- **Supported** in their decisions
- **Confident** about the next step

---

## Non-Negotiable Rules

### 1. ONE Question Per Screen
Every screen must answer ONE human question only.

| Wrong | Right |
|-------|-------|
| Dashboard with 12 metrics | "Here's what needs your attention today" |
| Settings with 30 options | "How would you like me to communicate with you?" |
| Profile with all fields visible | "Let's start with the basics about your business" |

### 2. Reduce Cognitive Load
At all times. No exceptions.

- Fewer words
- Fewer options
- Fewer clicks
- Fewer decisions

If the user has to think about how to use the interface, we've failed.

### 3. Never Overwhelm
Forbidden patterns:
- Multiple CTAs competing for attention
- Metrics dashboards with 5+ numbers
- Configuration screens with many toggles
- Dense text blocks
- Multiple notifications at once

### 4. Silence is a Feature
When nothing meaningful requires attention:
- Show calm, empty states
- Don't manufacture urgency
- Don't fill space with "tips" or "suggestions"
- Let the user feel that everything is okay

**"Nothing to see here" is a valid, valuable state.**

### 5. Reassurance is a Feature
The user is often anxious, overwhelmed, or uncertain.

- Confirm that things are working
- Acknowledge that they're doing okay
- Let them know when nothing needs their attention
- Celebrate small wins quietly

---

## Design Tests

Before shipping any screen, ask:

### The Mentor Test
"Would a calm, experienced mentor present information this way?"

If it feels like software → redesign
If it feels like a mentor → ship

### The Anxiety Test
"Will this screen make an anxious business owner feel better or worse?"

If worse → simplify
If better → ship

### The Cognitive Load Test
"How many decisions does this screen ask the user to make?"

If more than 1 → reduce
If 0-1 → ship

### The Silence Test
"If there's nothing important, does this screen feel calm?"

If it feels empty or broken → add reassurance
If it feels peaceful → ship

---

## What RIGHT Looks Like

### Calm
- Generous whitespace
- Muted colors for secondary elements
- Single focal point per screen
- Slow, gentle animations (or none)

### Obvious
- The most important thing is immediately clear
- No hunting for information
- Labels in plain English
- Actions are self-explanatory

### Human
- Conversational copy, not UI labels
- "You" and "your", not "User" or "Account"
- Acknowledges emotions
- Speaks like a supportive peer

---

## What WRONG Looks Like

### Clever
- Unusual navigation patterns
- Innovative but confusing layouts
- Technical terminology
- Hidden features behind gestures

### Dense
- Multiple columns of information
- Small text to fit more content
- Collapsed sections that need expanding
- Scrolling required to see key info

### Technical
- System language ("Configure", "Settings", "Parameters")
- Error codes or technical messages
- Database field names as labels
- Developer-facing terminology

### Impressive
- Animations for the sake of animations
- Features shown because we built them
- Metrics shown because we can calculate them
- Options shown because they exist

---

## Screen-by-Screen Philosophy

### Home / Dashboard
**Question it answers:** "What needs my attention right now?"

- If nothing: Show calm reassurance
- If something: Show ONE thing clearly
- Never: List of widgets/metrics

### MySoundboard
**Question it answers:** "Can I think through something with support?"

- Conversational, not transactional
- History accessible but not prominent
- Voice feels like talking to a person

### MyAdvisor
**Question it answers:** "What should I do about this?"

- ONE recommendation at a time
- Clear next step
- Consequences stated simply

### MyIntel
**Question it answers:** "Is there something I should know?"

- Only surfaces what matters
- Empty state is valid and calm
- Never manufactures alerts

### Business Profile
**Question it answers:** "Do you understand my business?"

- Progressive disclosure
- One section at a time
- Celebrates completion, doesn't nag

### Integrations
**Question it answers:** "What can you see about my business?"

- Simple on/off states
- Clear benefit statements
- No configuration complexity

---

## Copy Guidelines

### Tone
- Calm, not urgent
- Supportive, not pushy
- Human, not corporate
- Brief, not verbose

### Words to Use
- "Your", "You"
- "Let's", "We"
- Simple verbs: "See", "Start", "Done"
- Emotional: "Good", "Ready", "Clear"

### Words to Avoid
- "Configure", "Settings", "Options"
- "Dashboard", "Metrics", "Analytics"
- "Submit", "Process", "Execute"
- "Error", "Failed", "Invalid"

### Example Transformations

| Software Language | Mentor Language |
|-------------------|-----------------|
| "No notifications" | "All clear. Nothing needs your attention." |
| "Profile incomplete" | "I'd love to know more about your business when you're ready." |
| "Error: Invalid input" | "That doesn't look quite right. Mind checking it?" |
| "Submit" | "Done" or "Save" |
| "Configure integrations" | "Connect your tools" |
| "View analytics" | "See how things are going" |

---

## Empty States

Empty states are NOT errors. They are moments of peace.

### Good Empty State
```
All clear.

Nothing needs your attention right now.
Take a breath. You're doing fine.
```

### Bad Empty State
```
No data available.

Connect your integrations to see insights here.
[Configure Integrations] [Learn More] [Dismiss]
```

---

## Loading States

Loading is a moment of trust, not anxiety.

### Good Loading
```
Getting things ready...
```

### Bad Loading
```
Loading... Please wait...
[Progress: 47%] [Cancel]
```

---

## Error States

Errors should feel recoverable and human.

### Good Error
```
Something went wrong on our end.

Your work is safe. Try again in a moment.
```

### Bad Error
```
Error 500: Internal Server Error
Request ID: a3f8b2c1-...
[View Details] [Report Issue] [Retry]
```

---

## Final Reminder

If something feels:
- Clever → Make it obvious
- Dense → Make it spacious  
- Technical → Make it human
- Impressive → Make it calm

**You are a mentor the user checks in with.**
**Not software they operate.**
