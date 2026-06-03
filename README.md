# TranslateAI

Translate and localize CSV content using natural language.

Upload a CSV file, describe what you want translated, preview the results, and download a translated CSV.

**TranslateAI • Built by Mengting Bao**

---

# Overview

TranslateAI is a CSV localization assistant designed for product managers, marketers, ecommerce teams, and content operations teams.

Instead of manually translating spreadsheet content column by column, users can upload a CSV and describe their translation requirements in plain English.

The system automatically identifies columns containing Chinese content, interprets the user's request, performs translations, and generates a downloadable CSV.

---

# Key Features

## Natural Language Translation Requests

Users simply describe:

* Which columns to translate
* Which language(s) to translate them into

Examples:

```text
Translate product_name to Japanese

Translate description to Korean

Translate marketing_copy to French

Translate category to English

Translate everything to German
```

Multiple columns can be translated simultaneously:

```text
Translate product_name to Japanese and description to Korean
```

Different columns can be translated into different target languages:

```text
Translate product_name to Japanese and description to Korean and marketing_copy to French
```

The same column can be translated into multiple languages:

```text
Translate product_name to Japanese and Korean
```

or

```text
Translate product_name to Japanese, Korean, and French
```

No manual mapping or configuration is required.

---

## Automatic Chinese Content Detection

After a CSV is uploaded, TranslateAI automatically identifies columns containing Chinese content.

Example:

```text
Chinese Content Found In 4 Columns:

• product_name
• description
• marketing_copy
• category
```

This helps users quickly identify which columns may require translation.

---

# Output Behavior

## Original Data Is Preserved

TranslateAI never overwrites the uploaded file.

The original CSV remains unchanged.

Instead, translated content is added as new columns in the generated output file.

---

## Single Column → Single Language

Request:

```text
Translate product_name to Japanese
```

Input:

| product_name |
| ------------ |
| 保温杯          |

Output:

| product_name | product_name (Japanese) |
| ------------ | ----------------------- |
| 保温杯          | 魔法瓶                     |

---

## Same Column → Multiple Languages

Request:

```text
Translate product_name to Japanese and Korean
```

Output:

| product_name | product_name (Japanese) | product_name (Korean) |
| ------------ | ----------------------- | --------------------- |
| 保温杯          | 魔法瓶                     | 보온병                   |

---

## Multiple Columns → Different Languages

Request:

```text
Translate product_name to Japanese and description to Korean
```

Output:

| product_name | product_name (Japanese) | description | description (Korean) |
| ------------ | ----------------------- | ----------- | -------------------- |
| 保温杯          | 魔法瓶                     | 高品质保温杯      | 고품질 보온병              |

---

## Multiple Columns → Multiple Languages

Request:

```text
Translate product_name to Japanese and Korean and marketing_copy to French
```

Output:

| product_name | product_name (Japanese) | product_name (Korean) | marketing_copy | marketing_copy (French)              |
| ------------ | ----------------------- | --------------------- | -------------- | ------------------------------------ |
| 保温杯          | 魔法瓶                     | 보온병                   | 高品质保温杯         | Bouteille isotherme de haute qualité |

---

## Column Ordering Rules

Translated columns should always appear immediately beside their source column.

Good:

```text
product_name
product_name (Japanese)
product_name (Korean)

description
description (French)
```

Bad:

```text
product_name
description
marketing_copy

product_name (Japanese)
product_name (Korean)
description (French)
```

This layout makes previewing and validation significantly easier.

---

# User Workflow

```text
Drop CSV into the chat composer

Optionally type the translation request in the same composer

Click send to read the file, or read and translate in one step

Describe what to translate in chat

↓

Preview results

↓

Download translated CSV
```

Example requests:

```text
Translate product_name to Japanese

Translate description to Korean

Translate product_name to Japanese and Korean

Translate product_name to Japanese and description to Korean

Translate everything to German
```

---

# Upload Experience

Users upload CSV files by dropping them into the chat composer.

Before upload, the composer shows:

```text
Drop a CSV file to get started…
```

After a CSV is dropped, the composer shows a GPT-style attachment card and the send button becomes active.

Users can either click send immediately to read the CSV, or type a translation request first and complete reading plus translation in one step.

```text
┌──────────────────────────────────────────┐
│ [Spreadsheet icon] products.csv          │
│                  Spreadsheet             │
└──────────────────────────────────────────┘

Tell me what to translate, or send to read the file.
```

If the user sends the CSV without a translation request, the chat immediately shows:

1. How many columns contain Chinese content
2. The detected column list, with expandable overflow for long lists
3. What information is required next
4. Example translation requests using detected or available columns

If the user sends the CSV with a complete translation request, TranslateAI still shows the detected Chinese-content columns, then starts translation immediately.

Examples of complete one-step requests:

```text
Translate everything into Japanese

Translate all Chinese content to Korean

Translate detected columns into German
```

TranslateAI also resolves natural scope language against the uploaded CSV. For example, "Translate first three columns into Japanese" selects the first three CSV columns in file order, while "Translate first three Chinese columns into Japanese" selects the first three detected Chinese-content columns.

Current upload message:

```text
Chinese Content Found In 4 Columns:

• product_name
• description
• marketing_copy
• category

Tell me which columns to translate and the target language.

Examples:

• Translate product_name to Japanese
• Translate description to Korean
• Translate product_name to Japanese and Korean
• Translate product_name to Japanese and description to Korean
• Translate everything to German
```

Avoid vague prompts such as:

```text
What would you like translated?
```

Avoid dumping a full "Available columns" list when the user asks an unclear follow-up. Instead, show concise examples using columns from the uploaded CSV.

---

# Input Placeholder Guidelines

Before upload, the chat input is disabled and shows:

```text
Drop a CSV file to get started…
```

After the file is read, the chat input is enabled and shows:

```text
Tell me which columns to translate and the target language…
```

Examples are shown in the chat upload message rather than inside the placeholder.

---

# Recents Sidebar & Header Guidelines

TranslateAI uses a GPT-style Recents sidebar for this tool's own conversation history.

On first launch, Recents is empty.

After the user uploads a CSV or starts a conversation, the chat is saved locally and appears in Recents.

The sidebar contains:

```text
TranslateAI
New chat
Recents
Conversation titles from this tool
Close sidebar
```

The sidebar can be closed and reopened using the sidebar toggle icon. New Chat resets the workspace to the initial CSV drop state without adding a fake recent item. Recent chats can be deleted from the sidebar using the hover delete control.

The main header contains:

```text
TranslateAI
Settings
```

All upload, detection, instruction, preview, and download interactions happen in the chat area.

---

# Large Dataset Handling

Many production CSV files contain dozens or hundreds of columns.

Long detected-column lists are compacted in the chat upload message.

Example:

```text
Chinese Content Found In 17 Columns:

• product_name
• description
• marketing_copy
• category
• product_title

+12 more  Expand to view all
```

Selecting **Expand to view all** expands the complete list. Selecting **Show Less** collapses it again.

When expanded, **Show Less** appears below the final column in the expanded list so it does not interrupt the column sequence.

---

# Conversation Design Principles

## Ask Only For Missing Information

If the user provides a column but not a language:

User:

```text
product_name
```

Response:

```text
Which language would you like product_name translated into?

• Japanese
• Korean
• English
• German
• French
```

Avoid:

```text
I wasn't sure what to translate or to which language.
```

The system should identify exactly what information is missing.

---

## Minimize Unnecessary Clarification

If the request is clear, translation should begin immediately.

Avoid unnecessary confirmation messages and approval steps.

---

# Footer & Attribution

A lightweight attribution should appear below the chat input area.

Example:

```text
TranslateAI • Built by Mengting Bao
```

Recommended placement:

```text
┌──────────────────────────────────────────┐
│ Tell me which columns to translate...    │
└──────────────────────────────────────────┘

TranslateAI • Built by Mengting Bao
```

The attribution should:

* Be visible but unobtrusive
* Be smaller than primary content
* Match the overall design language
* Remain visible whether or not a CSV is uploaded

---

# How It Works

1. Upload a CSV file.
2. Chinese content is detected automatically.
3. The user's request is interpreted.
4. Relevant content is identified.
5. Translation is performed using GPT-4o-mini.
6. New translated columns are generated.
7. Translated columns are inserted immediately beside their source columns.
8. Results are displayed in a preview table.
9. A translated CSV becomes available for download.

---

# Project Structure

```text
src/
  index.html
  style.css
  app.js

server.js
README.md
DESIGN.md
```

---

# Run Locally

Create a local `.env` file:

```text
OPENAI_API_KEY=sk-your-key-here
```

Start the app:

```bash
node server.js
```

Then open:

```text
http://localhost:8787
```

Translation requests use the local `/api/chat` proxy so end users do not need to enter an API key in the browser.

---

# Requirements

* Modern browser (Chrome, Firefox, Safari, Edge)
* OpenAI API key configured on the server
* CSV file containing content to translate

---

# Creator

TranslateAI was designed and built by Mengting Bao.
