# Exelentic Personal Services — Candidate Portal (RPA Training Target)

A deliberately awful, legacy-style recruitment portal used to train **UiPath + AI** resilience against
unstable selectors. Every element id/class is randomized on each page load, the DOM is deeply nested,
and decoy/ghost elements are scattered throughout.

> Training mock only. Not a real system, and not real people — all candidates and CVs are generated.

## Login
- **Username:** `admin`
- **Password:** `admin123`

### Login-page selector traps (trainer notes)
The three real credential controls are deliberately the **first three INPUT elements on the page**,
so index-based selectors resolve predictably:

| idx | element | note |
|----:|---------|------|
| 1 | `input[type=text][name=username]` | the real username field |
| 2 | `input[type=password][name=pwd]` | **decoy** — see below |
| 3 | `input[type=password][name=password]` | the real password field |

**The trap is idx 2.** It is a genuine `type="password"` whose own attributes mirror the real field
exactly (identical `style`, same type) — only its wrapper is pushed off-screen, so it is invisible
to a human but indistinguishable from the real field by attributes alone. It carries
`aria-hidden=""` — an *empty* value, i.e. *false* — so unlike the other ghost fields it deliberately
**stays in the accessibility tree**. `tabindex="-1"` keeps keyboard users on the real field, and its
name (`pwd`) is ignored by the server.

Net effect: **the first `type=password` in DOM order is the decoy.** A bot that grabs
`tag=INPUT type=password idx=1` types into the void and submits an empty password →
"Invalid credentials".

All other decoy fields — the two ghost forms and the bottom noise form — are placed **after** the
real form in DOM order, so they never disturb idx 1–3.

Working selectors:
```
<webctrl tag='INPUT' type='text'     name='username' />
<webctrl tag='INPUT' type='password' name='password' />
```

Everything behaves normally for a human: click, type, Tab (skips the hidden field automatically),
type, Enter.

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
