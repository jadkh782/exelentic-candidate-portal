# CENIS Candidate Portal (RPA Training Target)

A deliberately awful, legacy-style recruitment portal used to train **UiPath + AI** resilience against
unstable selectors. Every element id/class is randomized on each page load, the DOM is deeply nested,
and decoy/ghost elements are scattered throughout.

> Training mock only. Not a real system.

## Login
- **Username:** `admin`
- **Password:** `admin123`

## Pages
- `/overview` – KPI dashboard (landing page after login)
- `/dashboard` – candidate list + search (`?q=`)
- `/candidates/new` – add a candidate (in-memory)
- `/archive` – rejected candidates
- `/reports` – analytics
- `/settings` – account preferences (mock)
- `/candidate/:id` – candidate detail
- `/download-cv/:id` – on-demand generated PDF CV

## Run locally
```bash
npm install
npm start          # http://localhost:3001
```

## Deploy to Vercel
This app is serverless-ready: it exports the Express app and streams PDFs on the fly (no disk writes).

1. Push this repo to GitHub.
2. In Vercel: **New Project → import this repo**. No build settings needed (`vercel.json` handles routing).
3. (Optional) set `SESSION_SECRET` env var.
4. Deploy.

### Note on serverless
Added candidates and login sessions live in a stateless cookie / in-memory list, so newly-added
candidates do not persist across cold starts. This is fine for a training target.
