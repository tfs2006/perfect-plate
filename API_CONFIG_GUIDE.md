# API Configuration Quick Reference

This guide provides quick instructions for configuring the Perfect-Plate Gemini API integration.

## TL;DR - Quick Setup

### For New Vertex AI API Key

```bash
# In Netlify Dashboard → Site Settings → Environment Variables, set:
GEMINI_API_KEY=AQ.YOUR_VERTEX_AI_KEY_HERE
GEMINI_API_ENDPOINT=vertex
GEMINI_MODEL=gemini-2.5-flash-lite
```

Then redeploy your site.

### For Google AI Studio (Generative Language API)

```bash
# In Netlify Dashboard → Site Settings → Environment Variables, set:
GEMINI_API_KEY=AIzaSy...your_key_here
GEMINI_API_ENDPOINT=generativelanguage  # or leave unset for default
GEMINI_MODEL=gemini-1.5-pro  # or gemini-1.5-flash
```

Then redeploy your site.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | ✅ Yes | - | Your Google AI or Vertex AI API key |
| `GEMINI_API_ENDPOINT` | ❌ No | `generativelanguage` | API endpoint type: `generativelanguage` or `vertex` |
| `GEMINI_MODEL` | ❌ No | `gemini-2.5-flash-lite` | Model to use (overrides frontend) |
| `ALLOWED_ORIGIN` | ❌ No | `*` | CORS allowed origins (comma-separated) |

## Endpoint Options

### Option 1: Generative Language API (Google AI Studio)
- **Endpoint Type**: `generativelanguage`
- **API Key Format**: `AIzaSy...`
- **Get Key From**: [Google AI Studio](https://aistudio.google.com/app/apikey)
- **Best For**: Quick setup, personal projects
- **Recommended Models**:
  - `gemini-1.5-pro` - Best quality
  - `gemini-1.5-flash` - Fast and economical
  - `gemini-1.5-flash-8b` - Lightweight

### Option 2: Vertex AI (Google Cloud)
- **Endpoint Type**: `vertex` or `vertexai`
- **API Key Format**: `AQ.Ab8...`
- **Get Key From**: [Google Cloud Console](https://console.cloud.google.com/)
- **Best For**: Production, enterprise, need for control
- **Recommended Models**:
  - `gemini-2.5-flash-lite` - Latest lite model
  - `gemini-1.5-flash` - Fast and reliable
  - `gemini-1.5-pro` - High quality

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
    "apiKey": "AQ.Ab8RN6I...COg",
    "endpointType": "vertex",
    "baseUrl": "https://aiplatform.googleapis.com/v1/publishers/google/models/",
    "model": "gemini-2.5-flash-lite"
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
[Gemini Proxy] Model endpoint: gemini-2.5-flash-lite:generateContent
[Gemini Proxy] API Key: AQ.Ab8RN6I...COg
[Gemini Proxy] ✅ Model 'models/gemini-2.5-flash-lite' check passed
```

## Switching Between Endpoints

### From Generative Language to Vertex AI

```bash
# Update these environment variables in Netlify:
GEMINI_API_KEY=AQ.YOUR_VERTEX_AI_KEY_HERE  # New Vertex key
GEMINI_API_ENDPOINT=vertex  # Change from generativelanguage to vertex
GEMINI_MODEL=gemini-2.5-flash-lite  # Use Vertex-compatible model
```

Then trigger a redeploy.

### From Vertex AI to Generative Language

```bash
# Update these environment variables in Netlify:
GEMINI_API_KEY=AIzaSy...your_key_here  # Google AI Studio key
GEMINI_API_ENDPOINT=generativelanguage  # Change from vertex
GEMINI_MODEL=gemini-1.5-pro  # Use Gen Language model
```

Then trigger a redeploy.

## Changing Models

### Without Code Changes
Simply update the `GEMINI_MODEL` environment variable:
```bash
GEMINI_MODEL=gemini-2.5-flash-lite  # For Vertex AI
# or
GEMINI_MODEL=gemini-1.5-flash  # For faster responses
```

The backend will automatically use this model for all requests.

### Model Selection Priority
1. **Backend environment variable** (`GEMINI_MODEL`) - Highest priority
2. **Frontend code** (`gemini-1.5-pro` by default) - Used if no env var set

This means you can switch models without touching the frontend code.

## Troubleshooting

### Issue: "GEMINI_API_KEY not configured"
**Solution**: 
- Verify the environment variable is set in Netlify
- Check the spelling is exactly `GEMINI_API_KEY`
- Trigger a new deploy after adding the variable

### Issue: "MODEL_NOT_FOUND"
**Solution**:
- Check health-check endpoint to verify model availability
- For Vertex AI, ensure model is enabled in Google Cloud Console
- Try an alternative model from the list-models endpoint

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

### Configuration 2: Google AI Studio with Pro model
```bash
GEMINI_API_KEY=AIzaSy...your_key_here
GEMINI_API_ENDPOINT=generativelanguage
GEMINI_MODEL=gemini-1.5-pro
ALLOWED_ORIGIN=https://yourusername.github.io
```

### Configuration 3: Quick testing (any origin)
```bash
GEMINI_API_KEY=your_key_here
GEMINI_API_ENDPOINT=generativelanguage
GEMINI_MODEL=gemini-1.5-flash
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
