# Netlify Environment Variables Setup

This guide explains how to configure environment variables for the Perfect Plate app on Netlify to use Vertex AI Gemini API.

## Required Environment Variables

The following environment variables must be set in your Netlify dashboard for the app to work with Vertex AI:

| Variable | Value | Description |
|----------|-------|-------------|
| `GEMINI_API_KEY` | `AQ.Ab8RN6ImPUN1939eRVlvZGbsreOFBPuu_6jhBW52_LBrSTVCOg` | Your Vertex AI Gemini API key |
| `GEMINI_API_ENDPOINT` | `vertex` | Specifies to use Vertex AI endpoint |
| `GEMINI_MODEL` | `gemini-2.5-pro` | The Gemini model to use |

## Step-by-Step Configuration

### 1. Access Netlify Dashboard

1. Go to [https://app.netlify.com](https://app.netlify.com)
2. Log in with your credentials
3. Select your Perfect Plate site from the sites list

### 2. Navigate to Environment Variables

1. Click on **"Site settings"** in the top navigation
2. In the left sidebar, click on **"Environment variables"** under "Build & deploy"

### 3. Add Environment Variables

For each variable, follow these steps:

1. Click the **"Add a variable"** or **"Add a single variable"** button
2. Enter the variable name (e.g., `GEMINI_API_KEY`)
3. Enter the corresponding value from the table above
4. Select the appropriate scopes:
   - ✅ **All scopes** (recommended) - Applies to all contexts
   - Or specifically select: **Production**, **Deploy previews**, and **Branch deploys**
5. Click **"Create variable"**

Repeat for all three variables:

```
GEMINI_API_KEY = AQ.Ab8RN6ImPUN1939eRVlvZGbsreOFBPuu_6jhBW52_LBrSTVCOg
GEMINI_API_ENDPOINT = vertex
GEMINI_MODEL = gemini-2.5-pro
```

### 4. Redeploy Your Site

**Important:** Environment variable changes do NOT take effect automatically. You must redeploy your site.

To trigger a redeploy:

1. Go to the **"Deploys"** tab in your Netlify dashboard
2. Click **"Trigger deploy"** button (top right)
3. Select **"Deploy site"** from the dropdown
4. Wait for the deployment to complete (usually 1-2 minutes)

### 5. Verify Configuration

After redeployment, verify your configuration is working:

#### Option 1: Health Check Endpoint

Visit your site's health check endpoint:
```
https://your-site-name.netlify.app/.netlify/functions/health-check
```

You should see output similar to:
```json
{
  "status": "ok",
  "configuration": {
    "apiKey": "AQ.Ab8RN6I...COg",
    "endpointType": "vertex",
    "baseUrl": "https://aiplatform.googleapis.com/v1/publishers/google/models/",
    "model": "gemini-2.5-pro"
  },
  "tests": {
    "vertexModelAccess": "SUCCESS",
    "modelAvailable": true
  }
}
```

#### Option 2: Test API Page

1. Open your site's test page:
   ```
   https://your-site-name.netlify.app/test-api.html
   ```

2. Click the **"1. Simple Text Generation Test"** button

3. You should see a success message with generated text

## Vertex AI Endpoint Details

When configured correctly, your app will:

- Use the Vertex AI endpoint: `https://aiplatform.googleapis.com/v1/publishers/google/models/`
- Authenticate using the provided API key: `AQ.Ab8RN6ImPUN1939eRVlvZGbsreOFBPuu_6jhBW52_LBrSTVCOg`
- Make requests to the `gemini-2.5-pro` model

### Vertex AI vs Generative Language API

| Aspect | Vertex AI (Current) | Generative Language API |
|--------|---------------------|-------------------------|
| Endpoint | `aiplatform.googleapis.com` | `generativelanguage.googleapis.com` |
| API Key Format | `AQ.*` | `AIza*` |
| List Models Support | ❌ No | ✅ Yes |
| Production Ready | ✅ Yes | Limited |
| Documentation | [Vertex AI Docs](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/inference) | [AI Studio Docs](https://ai.google.dev/docs) |

## Troubleshooting

### Configuration Not Working

1. **Check environment variables are set correctly**
   - Go to Site settings → Environment variables
   - Verify all three variables exist with correct values
   - Check for typos in variable names (they are case-sensitive)

2. **Ensure you've redeployed**
   - Environment changes require a redeploy
   - Check Deploys tab for the latest deployment status
   - Look for any build errors in the deploy log

3. **Test with health check endpoint**
   ```
   https://your-site.netlify.app/.netlify/functions/health-check
   ```
   - Check the `configuration` section for your values
   - Look for any `errors` or `warnings` in the response

### API Errors

**"GEMINI_API_KEY not configured"**
- The `GEMINI_API_KEY` environment variable is missing
- Add it in Site settings → Environment variables
- Redeploy the site

**"MODEL_NOT_FOUND" or 404 errors**
- Your API key might not have access to Vertex AI
- Verify the key format starts with `AQ.`
- Ensure your Google Cloud project has Vertex AI enabled

**"Vertex AI model access failed"**
- Check that the API key is correct
- Verify the model name is `gemini-2.5-pro`
- Ensure the endpoint is set to `vertex`

## Reference

- **Vertex AI Inference Documentation**: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/inference
- **Netlify Environment Variables**: https://docs.netlify.com/configure-builds/environment-variables/
- **Perfect Plate Repository**: https://github.com/tfs2006/perfect-plate

## Security Notes

⚠️ **Never commit API keys to version control**

- The `.env.example` file contains the actual API key for reference
- This is safe because it's meant for Netlify configuration, not local development
- For local testing, create a `.env` file (which is gitignored) with your keys
- Production keys should always be set in Netlify dashboard, not in code

---

*Last updated: 2025-10-28*
