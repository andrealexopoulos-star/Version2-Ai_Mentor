# BIQC Platform — PRD

## Strategic Console Light Theme Sprint (Feb 2026)

### Part 1 — Chat Scroll Mechanics — IMPLEMENTED
- Single scroll container with `ref={chatContainerRef}`
- Bottom-anchored: auto-scrolls on new messages unless user manually scrolled up
- `userScrolledUpRef` tracks manual scroll via `onScroll` handler
- `scrollRef` anchor at bottom of chat
- Mobile: `WebkitOverflowScrolling: touch`, flex-based layout, input at bottom

### Part 2 — Typography — IMPLEMENTED
- Font: Inter / system-ui stack
- Base: 15px body, 1.6 line height
- Headers: 600 weight
- Body: 400 weight
- No tiny captions, no monospace

### Part 3 — Light Executive Theme — IMPLEMENTED
- Background: #F6F7F9 (soft neutral)
- Cards: #fff with subtle box-shadow
- Header: white with #E5E7EB border
- Progress: #3B82F6 blue
- User messages: #3B82F6 blue bubbles, white text
- AI messages: white cards, #1F2937 text
- Input: #F9FAFB bg, #D1D5DB border, 12px border-radius
- Status badge: green/amber pills
- Removed: scanlines, dot grids, neon amber, black backgrounds, monospace

### Files Modified
- `frontend/src/components/WarRoomConsole.js` — full render rewrite
- `frontend/src/pages/AdvisorWatchtower.js` — console container style
