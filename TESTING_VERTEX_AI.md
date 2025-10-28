# Testing Vertex AI Configuration

This guide explains how to test and verify that your Perfect Plate app is correctly configured to use the Vertex AI Gemini API.

## Quick Verification

Before deploying to Netlify, verify your local configuration:

```bash
node verify-config.js
```

This script checks:
- ✓ `.env.example` has correct Vertex AI settings
- ✓ All Netlify functions use environment variables
- ✓ No hardcoded API keys exist
- ✓ Default endpoint is set to 'vertex'
- ✓ Documentation is up to date

## Testing on Netlify

After deploying to Netlify with the environment variables set, test your configuration using these endpoints.

### 1. Health Check Endpoint

The health check endpoint verifies your API key, endpoint configuration, and model availability.

**URL Pattern:**
```
https://your-site-name.netlify.app/.netlify/functions/health-check
```

**Example:**
```
https://perfect-plate-app.netlify.app/.netlify/functions/health-check
```

**Expected Response (Success):**
```json
{
  "status": "ok",
  "timestamp": "2025-10-28T14:51:32.635Z",
  "configuration": {
    "apiKey": "AQ.Ab8RN6I...COg",
    "endpointType": "vertex",
    "baseUrl": "https://aiplatform.googleapis.com/v1/publishers/google/models/",
    "model": "gemini-2.5-pro"
  },
  "tests": {
    "modelListEndpoint": "N/A (Vertex AI)",
    "vertexModelAccess": "SUCCESS",
    "modelAvailable": true
  },
  "warnings": [
    "Vertex AI does not support list models endpoint - testing direct model access instead"
  ],
  "errors": []
}
```

**What to Check:**
- ✓ `status` should be `"ok"`
- ✓ `configuration.endpointType` should be `"vertex"`
- ✓ `configuration.baseUrl` should be `"https://aiplatform.googleapis.com/v1/publishers/google/models/"`
- ✓ `configuration.model` should be `"gemini-2.5-pro"`
- ✓ `tests.vertexModelAccess` should be `"SUCCESS"`
- ✓ `tests.modelAvailable` should be `true`
- ✓ `errors` array should be empty

**Possible Issues:**

| Status | Meaning | Solution |
|--------|---------|----------|
| `"error"` | Configuration problem | Check environment variables in Netlify |
| `vertexModelAccess: "FAILED"` | Cannot access Vertex AI | Verify API key is correct and has Vertex AI access |
| `apiKey: "NOT_CONFIGURED"` | API key missing | Set `GEMINI_API_KEY` in Netlify environment variables |

### 2. Test API Page

The test API page provides interactive tests for the Gemini API integration.

**URL Pattern:**
```
https://your-site-name.netlify.app/test-api.html
```

**Example:**
```
https://perfect-plate-app.netlify.app/test-api.html
```

**Tests Available:**

#### Test 1: Simple Text Generation
- Click "Run Simple Test"
- Should return: `"Say hello"` prompt generates a simple response
- Verifies basic API connectivity

**Expected Result:**
```
✅ Success! Received text: "Hello!"
```

#### Test 2: JSON Generation
- Click "Run JSON Test"
- Should return: Valid JSON structure
- Verifies structured output capability

**Expected Result:**
```
✅ Success! Parsed JSON successfully
```

#### Test 3: Meal Plan Test
- Click "Run Meal Plan Test"
- Should return: A complete meal plan with breakfast
- Verifies the actual meal planning functionality

**Expected Result:**
```
✅ Success! Generated meal plan

Token usage: 1234 total (567 prompt + 667 response)
```

#### Test 4: List Available Models
- Click "List Models"
- For Vertex AI, shows configured model
- For Generative Language API, lists all available models

**Expected Result (Vertex AI):**
```
Vertex AI endpoint does not support list models. Using configured model.
Configured model: gemini-2.5-pro
```

#### Test 5: Model Availability Test
- Click "Test Models"
- Tests different model names
- Shows which models work with your API key

**Expected Result:**
```
✅ gemini-1.5-pro:generateContent: Working! Text: "working"
```

### 3. Full Application Test

Test the complete meal planning workflow:

1. **Open the App:**
   ```
   https://your-site-name.netlify.app/
   ```

2. **Fill in the Form:**
   - Days: 7
   - Target Calories: 2000
   - Dietary Preferences: (any)
   - Goal: Weight Loss (or any goal)
   - Age: 30
   - Sex: Male
   - Meals per day: 3

3. **Generate Plan:**
   - Click "Generate My Plan"
   - Wait for generation (30-60 seconds for 7 days)

4. **Verify Results:**
   - ✓ Plan generates without errors
   - ✓ All days have meals
   - ✓ Meals have ingredients and steps
   - ✓ Grocery list is populated
   - ✓ PDF export works

**Expected Behavior:**
- Console shows: `[Gemini Proxy] Using vertex endpoint`
- No "MODEL_NOT_FOUND" errors
- No "GEMINI_API_KEY not configured" errors
- Token usage is logged in console

## Troubleshooting Test Failures

### "GEMINI_API_KEY not configured"

**Problem:** API key environment variable not set

**Solution:**
1. Go to Netlify dashboard
2. Navigate to: Site settings → Environment variables
3. Add `GEMINI_API_KEY` with value: `AQ.Ab8RN6ImPUN1939eRVlvZGbsreOFBPuu_6jhBW52_LBrSTVCOg`
4. Redeploy site

### "Vertex AI model access failed"

**Problem:** Cannot connect to Vertex AI endpoint

**Solution:**
1. Verify API key format starts with `AQ.`
2. Check that `GEMINI_API_ENDPOINT` is set to `vertex`
3. Ensure Google Cloud project has Vertex AI enabled
4. Verify API key has Vertex AI permissions

### "MODEL_NOT_FOUND" or 404 errors

**Problem:** Model doesn't exist or not accessible

**Solution:**
1. Verify model name is `gemini-2.5-pro`
2. Check health-check endpoint shows correct model
3. Ensure API key has access to this model
4. Try health check to see available models

### CORS errors in browser console

**Problem:** Cross-origin request blocked

**Solution:**
1. Check `ALLOWED_ORIGIN` environment variable
2. Set to your domain or `*` for testing
3. Verify functions return proper CORS headers
4. Clear browser cache and retry

### Empty or truncated responses

**Problem:** Response has no text or is cut off

**Solution:**
1. Check token limits in console logs
2. Look for `finishReason: "MAX_TOKENS"`
3. Reduce prompt complexity
4. Split into smaller requests (fewer days)

## Monitoring in Production

### Check Netlify Function Logs

1. Go to Netlify dashboard
2. Navigate to: Functions tab
3. Click on `generate-plan` function
4. View recent invocations and logs

**Look for:**
- `[Gemini Proxy] Using vertex endpoint`
- `[Gemini Proxy] Model endpoint: gemini-2.5-pro:generateContent`
- `[Gemini Proxy] Response status: 200`
- Token usage logs

**Warning signs:**
- Repeated 404 errors → Model not available
- 403 errors → API key invalid or no permissions
- 500 errors → Server configuration issue
- Empty responses → Token limit hit

### Monitor API Usage

Track your Vertex AI API usage:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to: APIs & Services → Dashboard
3. Select: Vertex AI API
4. View: Quotas and metrics

**Monitor:**
- Requests per day
- Tokens consumed
- Error rates
- Latency

## Test Checklist

Before marking configuration as complete, verify:

- [ ] `node verify-config.js` passes all checks
- [ ] Health check endpoint returns `"status": "ok"`
- [ ] Health check shows `"endpointType": "vertex"`
- [ ] Health check shows `"vertexModelAccess": "SUCCESS"`
- [ ] Test API page - Simple Test works
- [ ] Test API page - JSON Test works
- [ ] Test API page - Meal Plan Test works
- [ ] Full app generates meal plan successfully
- [ ] No console errors about API key or model
- [ ] PDF export works
- [ ] Grocery list populates correctly

## Reference

- **Health Check Endpoint:** `/.netlify/functions/health-check`
- **Test API Page:** `/test-api.html`
- **Verification Script:** `node verify-config.js`
- **Setup Guide:** [NETLIFY_SETUP.md](NETLIFY_SETUP.md)
- **Vertex AI Docs:** https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/inference

---

*Last updated: 2025-10-28*
