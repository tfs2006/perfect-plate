# API Configuration Quick Reference

This guide provides quick instructions for configuring the Perfect-Plate Gemini API integration.

## TL;DR - Quick Setup

### For API Key Restricted to gemini-2.5-pro

```bash
# In Netlify Dashboard → Site Settings → Environment Variables, set:
GEMINI_API_KEY=YOUR_API_KEY_HERE
GEMINI_API_ENDPOINT=generativelanguage
GEMINI_MODEL=gemini-2.5-pro
```

Then redeploy your site.

### For Google AI Studio (Generative Language API)

```bash
# In Netlify Dashboard → Site Settings → Environment Variables, set:
GEMINI_API_KEY=AIzaSy...your_key_here
GEMINI_API_ENDPOINT=generativelanguage  # or leave unset for default
GEMINI_MODEL=gemini-2.5-pro  # Only allowed model for this configuration
```

Then redeploy your site.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | ✅ Yes | - | Your Google AI or Vertex AI API key |
| `GEMINI_API_ENDPOINT` | ❌ No | `generativelanguage` | API endpoint type: `generativelanguage` or `vertex` |
| `GEMINI_MODEL` | ❌ No | `gemini-2.5-pro` | Model to use (overrides frontend) |
| `ALLOWED_ORIGIN` | ❌ No | `*` | CORS allowed origins (comma-separated) |

## Endpoint Options

### Option 1: Generative Language API (Google AI Studio)
- **Endpoint Type**: `generativelanguage`
- **API Key Format**: `AIzaSy...`
- **Get Key From**: [Google AI Studio](https://aistudio.google.com/app/apikey)
- **Best For**: Quick setup, personal projects
- **Allowed Models**:
  - `gemini-2.5-pro` - Only model available for current API key configuration

### Option 2: Vertex AI (Google Cloud)
- **Endpoint Type**: `vertex` or `vertexai`
- **API Key Format**: `AQ.Ab8...`
- **Get Key From**: [Google Cloud Console](https://console.cloud.google.com/)
- **Best For**: Production, enterprise, need for control
- **Allowed Models**:
  - `gemini-2.5-pro` - Only model available for current API key configuration

## Testing Your Configuration

### 1. Health Check Endpoint
Visit: `https://your-site.netlify.app/.netlify/functions/health-check`

**What it checks**:
- ✅ API key is configured
- ✅ Endpoint type is set
- ✅ Model is available
- ✅ API connectivity works

**Example response**:
```json
{
  "status": "ok",
  "timestamp": "2025-10-28T01:00:00.000Z",
  "configuration": {
    "apiKey": "AQ.YOUR_VERT...HERE",
    "endpointType": "vertex",
    "baseUrl": "https://aiplatform.googleapis.com/v1/publishers/google/models/",
    "model": "gemini-2.5-pro"
  },
  "tests": {
    "vertexModelAccess": "SUCCESS",
    "modelAvailable": true
  },
  "warnings": [],
  "errors": []
}
```

### 2. List Models Endpoint
Visit: `https://your-site.netlify.app/.netlify/functions/list-models`

**What it shows**:
- All available models for your API key
- Models that support content generation
- Endpoint type being used

**Note**: For Vertex AI, this endpoint returns common models since Vertex doesn't support a list endpoint.

### 3. Check Netlify Function Logs
1. Go to Netlify Dashboard
2. Navigate to: Functions → generate-plan (or health-check)
3. Click "Logs"
4. Look for lines starting with `[Gemini Proxy]` or `[Health Check]`

**What to look for**:
```
[Gemini Proxy] Using vertex endpoint: https://aiplatform.googleapis.com/v1/publishers/google/models/
[Gemini Proxy] Model endpoint: gemini-2.5-pro:generateContent
[Gemini Proxy] API Key: YOUR_API_...HERE
[Gemini Proxy] ✅ Model 'models/gemini-2.5-pro' check passed
```

## Switching Between Endpoints

### Changing API Endpoints

**Note**: This configuration is restricted to `gemini-2.5-pro` only due to API key limitations.

```bash
# Update these environment variables in Netlify:
GEMINI_API_KEY=YOUR_API_KEY_HERE
GEMINI_API_ENDPOINT=generativelanguage  # or vertex
GEMINI_MODEL=gemini-2.5-pro  # Only allowed model
```

Then trigger a redeploy.

## Model Configuration

### Allowed Models
This configuration is restricted to:
```bash
GEMINI_MODEL=gemini-2.5-pro  # Only allowed model for current API key
```

The backend will automatically use this model for all requests.

### Model Selection Priority
1. **Backend environment variable** (`GEMINI_MODEL`) - Highest priority
2. **Frontend code** (`gemini-2.5-pro` by default) - Used if no env var set

This means you can switch models without touching the frontend code (though only gemini-2.5-pro is allowed for this configuration).

## Troubleshooting

### Issue: "GEMINI_API_KEY not configured"
**Solution**: 
- Verify the environment variable is set in Netlify
- Check the spelling is exactly `GEMINI_API_KEY`
- Trigger a new deploy after adding the variable

### Issue: "MODEL_NOT_FOUND"
**Solution**:
- Check health-check endpoint to verify model availability
- This configuration only supports gemini-2.5-pro
- Ensure gemini-2.5-pro is enabled for your API key
- Contact your API key provider if model is not available

### Issue: 404 or API errors
**Solution**:
- Verify API key format matches endpoint type
- Vertex AI keys start with `AQ.`
- Google AI Studio keys start with `AIzaSy`
- Check endpoint type matches your key type

### Issue: CORS errors
**Solution**:
- Set `ALLOWED_ORIGIN` to your GitHub Pages URL
- Example: `https://yourusername.github.io`
- For multiple origins: `https://site1.com,https://site2.com`

## Common Configurations

### Configuration 1: Vertex AI with latest model
```bash
GEMINI_API_KEY=AQ.YOUR_VERTEX_AI_KEY_HERE
GEMINI_API_ENDPOINT=vertex
GEMINI_MODEL=gemini-2.5-flash-lite
ALLOWED_ORIGIN=https://yourusername.github.io
```

### Configuration 2: Google AI Studio with gemini-2.5-pro
```bash
GEMINI_API_KEY=AIzaSy...your_key_here
GEMINI_API_ENDPOINT=generativelanguage
GEMINI_MODEL=gemini-2.5-pro
ALLOWED_ORIGIN=https://yourusername.github.io
```

### Configuration 3: Quick testing (any origin)
```bash
GEMINI_API_KEY=your_key_here
GEMINI_API_ENDPOINT=generativelanguage
GEMINI_MODEL=gemini-2.5-pro
ALLOWED_ORIGIN=*
```

## Additional Resources

- **Main README**: [README.md](README.md) - Comprehensive documentation
- **Environment Variables**: [.env.example](.env.example) - All options with examples
- **Debugging Guide**: [DEBUGGING_GUIDE.md](DEBUGGING_GUIDE.md) - Step-by-step troubleshooting
- **Test API Tool**: `test-api.html` - Interactive diagnostic tool

## Need Help?

1. Check the health-check endpoint first
2. Review Netlify function logs
3. Use test-api.html for interactive testing
4. Check the main README for detailed troubleshooting
