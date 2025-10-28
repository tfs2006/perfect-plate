# Perfect‑Plate (improved)

A clean, secure AI meal planner that generates a 7‑day plan + grocery list and exports to PDF.

## Why this is better
- **Security**: No API keys in the client. Calls go through a serverless function.
- **GH Pages friendly**: Frontend can live on GitHub Pages. Functions live on Netlify.
- **Structured output**: Prompts enforce **strict JSON**, so rendering is reliable.
- **UX**: Stepper, saved form state, tabs per day, grocery list with checkboxes, PDF export.
- **A11y & mobile**: Keyboard focus styles, reduced‑motion support, responsive layout.
- **Robust error handling**: Automatic retries, detailed logging, and diagnostic tools.

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
test-api.html         # diagnostic tool for API troubleshooting
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

## Troubleshooting

If you experience issues with meal plan generation:

1. **Check browser console** (F12 → Console) for detailed error logs
2. **Use the diagnostic tool**: Open `test-api.html` in your browser
   - Tests API connectivity
   - Tests JSON generation
   - Tests meal plan prompts
   - Identifies which component is failing
3. **Read the guides**:
   - **[FIX_SUMMARY.md](FIX_SUMMARY.md)** - Overview of recent fixes and improvements
   - **[DEBUGGING_GUIDE.md](DEBUGGING_GUIDE.md)** - Step-by-step troubleshooting
   - **[TEST_API_README.md](TEST_API_README.md)** - How to use the diagnostic tool

### Common Issues

**"Model returned no text"**
- The app now automatically retries with different parameters
- Check console logs for detailed diagnostics
- Use test-api.html to identify the specific issue

**API connection errors**
- Verify `GEMINI_API_KEY` is set in Netlify environment variables
- Check `window.API_BASE` in js/config.js points to correct URL
- Ensure CORS is properly configured (ALLOWED_ORIGIN)

**Model not found / NOT_FOUND errors**
- The app uses "gemini-1.5-pro" which is the officially supported model name for Gemini API v1
- This prevents 404 NOT_FOUND errors from deprecated model names like "gemini-pro" or incorrect names like "gemini-1.5-pro-001"
- The full API endpoint is: `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent`
- Use test-api.html to verify model availability via the List Models feature
- **The backend now automatically checks model availability** before making requests and provides detailed error messages with alternatives

#### Checking and Upgrading Model Access

If you receive a "MODEL_NOT_FOUND" or 404 error:

1. **Check Available Models**
   - Open `test-api.html` in your browser
   - Click "List Models" to see all models available to your API key
   - Look for `models/gemini-1.5-pro` in the list

2. **Verify API Key Permissions**
   - Go to [Google AI Studio](https://aistudio.google.com/)
   - Check that your API key has access to Gemini models
   - Create a new API key if needed with proper permissions

3. **Enable Model in Google Cloud Console**
   - Visit [Vertex AI Models](https://console.cloud.google.com/vertex-ai/generative-ai/models)
   - Ensure your project has the Gemini API enabled
   - Check that `gemini-1.5-pro` is available in your region
   - Enable the model if it's not already activated

4. **Check API Documentation**
   - Review the [Gemini API Models documentation](https://ai.google.dev/gemini-api/docs/models)
   - Verify the correct model naming convention
   - Check for any regional restrictions or availability changes

5. **Use Alternative Models**
   - If `gemini-1.5-pro` is not available, the error message will list available alternatives
   - Consider using `models/gemini-1.5-flash` or `models/gemini-1.5-flash-8b` as fallbacks
   - Update the model name in `js/script.js` if you need to use a different model

6. **Backend Automatic Checks**
   - The backend function now automatically verifies model availability before making API calls
   - Check Netlify function logs for detailed model availability information
   - The system caches model lists for 1 hour to minimize API calls
   - Look for `[Model Check]` log entries to see what models were detected

**Important Notes:**
- Model availability depends on your Google Cloud project settings and API key permissions
- Some models may require billing to be enabled on your Google Cloud account
- Regional availability varies - check the Vertex AI console for your specific region
- The backend will log all available models on first request, helping diagnose access issues

## Recent Improvements

**2025-10-28**
- ✅ **Automated model availability checking** - Backend validates model access before requests
- ✅ Smart caching of model lists to reduce API calls
- ✅ Detailed error messages with alternative models when requested model is unavailable
- ✅ Enhanced troubleshooting documentation for model access issues
- ✅ Comprehensive logging for model availability diagnostics

**2025-10-27**
- ✅ Enhanced error handling with automatic retries
- ✅ Comprehensive logging for easier debugging
- ✅ Detection of blocked content and safety issues
- ✅ Interactive diagnostic tool (test-api.html)
- ✅ Better generation parameters (topP, topK)
- ✅ Clear, actionable error messages
- ✅ Complete troubleshooting documentation

## Notes
- If you prefer Cloudflare Workers/Vercel: change `API_BASE` to that endpoint—no other code changes required.
- If you later host everything on Netlify: leave `window.API_BASE=""` and the app will call same‑origin `/.netlify/functions/*`.

© 2025 Perfect‑Plate
