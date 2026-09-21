# Exelentic Personal Services — Candidate Portal (RPA Training Target)

A deliberately awful, legacy-style recruitment portal used to train **UiPath + AI** resilience against
unstable selectors. Every element id/class is randomized on each page load, the DOM is deeply nested,
and decoy/ghost elements are scattered throughout.

> Training mock only. Not a real system, and not real people — all candidates and CVs are generated.

## Login
- **Username:** `admin`
- **Password:** `admin123`

### Login-page selector traps (trainer notes)
The two credential fields are deliberately hostile to naive selectors:

- **Username is not an `<input>`.** The visible box is a `<span role="textbox" contenteditable>`
  styled to look like a text field, with a misleading `aria-label="Kennung"`. A hidden
  `<input type="hidden" name="username">` is filled by script on input / Enter / submit.
  Selectors built on `tag=INPUT` + `type=text` find nothing typable. Enter inside the box submits.
- **Two password inputs, the first one is a decoy.** A second `<input type="password">` sits
  *before* the real one in DOM order with `aria-hidden=""` — an empty value, i.e. *false*, so unlike
  the other ghost fields it **stays in the accessibility tree**. Only its wrapper is pushed
  off-screen; the input's own attributes mirror the real field exactly. It has `tabindex="-1"` so
  keyboard users skip it, and its `name` is `pwd`, so anything typed into it is discarded by the
  server. A bot that grabs the *first* `type=password` logs in with an empty password.

Both fields work normally for a human: click, type, Tab, type, Enter.

## Candidate data
**171 generated candidates** across **7 talent categories**, ~20–30 per category. Each record carries a
full CV: profile summary, 1–3 work-history entries with achievement bullets, rated skills (1–5),
education, languages, certifications, availability and salary expectation.

### Talent categories → SAP department mapping
The portal and the SAP replica use **deliberately different wording for the same concept**. Mapping one
onto the other is part of the exercise:

| Portal talent category | key | SAP replica department |
|---|---|---|
| Technical & Engineering Talent | `TEC` | Engineering |
| Estates, Trades & Site Services | `EST` | Facility Management |
| Finance, Audit & Controlling | `FIN` | Finance & Controlling |
| Medical & Care Personnel | `MED` | Health Services |
| Commercial, Brand & Growth | `COM` | Sales & Marketing |
| Logistics, Freight & Warehousing | `LOG` | Supply Chain |
| People Operations & Recruitment | `PEO` | Human Capital Management |

### Regenerating the dataset
The generator is seeded, so it reproduces the identical dataset every run:
```bash
node scripts/generate-candidates.js
```

## Pages
- `/overview` – KPI dashboard (landing page after login); category rows link into the filtered list
- `/dashboard` – candidate list with **category filter, status filter, free-text search and pagination**
  - query params: `?category=TEC&status=New&q=python&page=2&page_size=50`
  - search matches name, id, position, city, category label **and skill names**
- `/candidates/new` – add a candidate (in-memory)
- `/archive` – rejected candidates
- `/reports` – analytics by status / city / talent category
- `/settings` – account preferences (mock)
- `/candidate/:id` – full profile: profile text, work history, rated skills, education, languages, certs
- `/download-cv/:id` – on-demand generated one-page PDF CV

## The CV PDFs
Generated on the fly with `pdfkit` (no files on disk). Each is a realistic one-page CV whose text layer is
**built for extraction** — the key values appear as `Label: value` pairs:

```
Candidate ID: CND-10001        Category: Technical & Engineering Talent
Total Experience: 12 years     Availability: 1 month
Desired Salary: EUR 68,000     Application Status: Under Review
Applied On: 2025-03-14         Location: Stuttgart, Germany
```

...followed by Profile, Professional Experience (with bullets), Skills with `n/5` ratings, Education,
Languages and Certifications. Good material for OCR / PDF-extraction activities and LLM parsing steps.

## Run locally
```bash
npm install
npm start          # http://localhost:3001
```

## Deploy to Vercel
Serverless-ready: exports the Express app and streams PDFs on the fly (no disk writes).

1. Push this repo to GitHub.
2. In Vercel: **New Project → import this repo**. No build settings needed (`vercel.json` handles routing).
3. (Optional) set `SESSION_SECRET` env var.
4. Deploy.

### Note on serverless
Candidates added through the UI live in an in-memory list, so they do not persist across cold starts.
The 171 generated records are read from `data/candidates.json` and are always present.
