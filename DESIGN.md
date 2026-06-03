# Design Document — TranslateAI

## Product Philosophy

TranslateAI is a focused AI translation agent, not a developer tool. The experience is designed around the user's job-to-be-done: take a CSV with Chinese content and get back a translated version. Every design decision serves that goal.

---

## UX Principles

**Product-first, credentials-last.**
Users land directly on the translation interface. The OpenAI API key lives behind a settings gear icon — visible but never in the way. If a user tries to translate without a key, they see a contextual nudge with a direct link to open Settings.

**Conversation-driven, not form-driven.**
Translation instructions are typed in natural language. There are no dropdowns, no language pickers, no column checkboxes. The agent parses intent from the user's words.

**Chat = upload and action.**
The chat composer is the file drop target. After a CSV is dropped, it appears as a spreadsheet attachment card. The user can either send immediately to read the file, or type a translation request in the same composer and complete reading plus translation in one step. The chat panel is where detection results, translation requests, progress, preview, and download actions happen. This keeps the product close to modern AI assistant workflows.

**Sidebar = context, not workflow.**
A GPT-style sidebar provides conversation context from this tool's own saved chats and can be closed or reopened. It has a brand header, a full-width New Chat row, and a Recents section that starts empty for a new user, then fills as CSV translation conversations are created. It does not contain upload controls, column controls, or translation settings; the core workflow stays in the chat.

---

## User Flow

```
1. Open app → see translation interface (no onboarding modal)
2. Drop a CSV into the chat composer
3. Optionally type a natural-language translation instruction
4. Click send to read the CSV
5. Agent announces which columns contain Chinese content
6. If the request is complete, Agent starts translation immediately; otherwise it asks for the missing instruction
7. Preview table appears with translated columns highlighted
8. User copies or downloads the full CSV
```

---

## Key Design Decisions

### No modal on launch
A key-entry modal as the first screen signals "developer tool". Users want to accomplish a task, not configure infrastructure. The settings panel is a power-user escape hatch.

### Natural language input only
A language dropdown or column picker adds cognitive overhead and breaks the conversational metaphor. The placeholder text teaches the interface implicitly through examples.

### Attachment-first upload state
Dropped CSV files are represented as spreadsheet attachment cards instead of raw filename text. This makes the pending upload state visible, removable, and familiar to users who already understand modern chat assistants.

### Real recents, no fake history
Recents should only show conversations created inside TranslateAI. New Chat clears the current workspace back to the initial CSV drop state, while saved conversations can be reopened from local history. Each recent row exposes a delete control on hover so users can remove stale conversations.

### Semantic translation intent
The agent should resolve natural-language scope against the uploaded CSV, not require rigid command phrasing. Plain column scopes such as "first three columns" use the CSV's file order; explicit Chinese/detected scopes such as "first three Chinese columns" use the detected Chinese-content order. Requests such as "translate everything into Japanese", "translate all Chinese content to Korean", "translate detected columns into German", and "translate first three columns into Japanese" should become executable translation tasks. If the user has already specified the target scope and language, the agent should not ask which columns to translate.

### Translated columns are additive
Original columns are never overwritten. A translated column named `product_name (Japanese)` is appended alongside the original. This preserves the source data and makes the diff obvious in the preview.

### Batching for real-world scale
Rows are sent to OpenAI in batches of 20, with a live progress bar. This handles large files gracefully without hitting token limits or appearing frozen.

### Graceful key handling
If translation is attempted without a key, the error message includes a clickable "Open Settings" link — no interruption, just a direct path to resolution. A 401 from OpenAI automatically opens the Settings panel.

---

## Visual Design

- **Dark theme** — neutral dark (ChatGPT-inspired), not loud or branded
- **Accent color** — #10a37f (OpenAI green), used sparingly for primary actions and highlights
- **Typography** — Inter, 14px base, 600 weight for headings
- **Translated cells** — #6ee7b7 (soft green), distinct but not distracting
- **Layout** — GPT-style Recents sidebar, fluid chat column, compact top-left brand header, max 720px message width

---

## Technical Choices

| Decision | Rationale |
|---|---|
| Vanilla JS, no framework | Zero build step, opens directly in browser |
| Client-side CSV parsing | No server needed, no data leaves the browser |
| gpt-4o-mini | Fast, cheap, accurate for translation tasks |
| Batches of 20 rows per API call | Balances throughput vs. token limits |
| Additive columns `col (Language)` | Non-destructive, clear naming convention |

### Composer Layout

The chat composer should not span the full width of the chat area.

Recommended:

- Max width: 800–900px
- Horizontally centered
- Similar visual proportions to ChatGPT or Claude

Avoid full-width input boxes because they dominate the interface and distract from the conversation content.

The placeholder should already communicate the next action, therefore helper text such as:

"Drop a CSV file to get started"

should be hidden once a CSV has been uploaded.

Once a CSV has been dropped, the composer should show a spreadsheet attachment card above the input. The input remains available so the user can add a request such as "Translate everything to Japanese" before sending. Clicking send moves the uploaded file into the chat history as a file card; if text was included, that text appears with the file card.
