# Perfect‑Plate (improved)

A clean, secure AI meal planner that generates a 7‑day plan + grocery list and exports to PDF.

## Why this is better
- **Security**: No API keys in the client. Calls go through a serverless function.
- **GH Pages friendly**: Frontend can live on GitHub Pages. Functions live on Netlify.
- **Structured output**: Prompts enforce **strict JSON**, so rendering is reliable.
- **UX**: Stepper, saved form state, tabs per day, grocery list with checkboxes, PDF export.
- **A11y & mobile**: Keyboard focus styles, reduced‑motion support, responsive layout.

## Repo structure
```
/ (GitHub Pages frontend)
  index.html
  css/style.css
  js/config.js        # set window.API_BASE here
  js/script.js
/netlify/functions/   # deploy to Netlify
  generate-plan.js
netlify.toml          # for Netlify (if you also host static there)
```

## Deploy (recommended split: GH Pages + Netlify Functions)

1) **Create GitHub repo** (e.g., `perfect-plate`) and push these files.
   - Settings → Pages → Source: `main` → `/ (root)` → Save.
   - Your site will be at: `https://<you>.github.io/perfect-plate/`.

2) **Create a Netlify site** just for functions:
   - New site → Import from Git → Pick the same repo or a fork.
   - Build cmd: _none_ ; Publish dir: `/` ; Functions dir: `netlify/functions`
   - In Netlify site → **Site settings → Environment variables**:
     - `GEMINI_API_KEY` = `YOUR_KEY`
     - (optional) `ALLOWED_ORIGIN` = `https://<you>.github.io`
   - Deploy → copy your site URL, e.g. `https://perfect-plate-fns.netlify.app`

3) **Point the frontend to functions**:
   - Edit `js/config.js` and set:
     ```js
     window.API_BASE = "https://perfect-plate-fns.netlify.app/.netlify/functions";
     ```
   - Commit & push. Wait a minute for GH Pages to update.

## Local test (no keys in client)
You can run a simple static server (e.g., `npx http-server .`) but the app still needs the deployed Netlify function to work.

## Notes
- If you prefer Cloudflare Workers/Vercel: change `API_BASE` to that endpoint—no other code changes required.
- If you later host everything on Netlify: leave `window.API_BASE=""` and the app will call same‑origin `/.netlify/functions/*`.

© 2025 Perfect‑Plate
