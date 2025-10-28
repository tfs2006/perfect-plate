# Vertex AI OAuth2 Authentication Implementation

**Date:** 2025-10-28  
**Update:** Changed Vertex AI authentication from API key to OAuth2 Bearer tokens

## Overview

This update implements OAuth2 authentication for Vertex AI endpoints using Google service account credentials. The change improves security by:

- Removing API keys from URLs (for Vertex AI)
- Using OAuth2 Bearer tokens in Authorization headers
- Following Google Cloud best practices for authentication
- Maintaining backward compatibility with Generative Language API

## What Changed

### Before (API Key Authentication)
```javascript
// Vertex AI used API key in URL
const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${apiKey}`;
await fetch(url, { 
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
});
```

### After (OAuth2 Bearer Token)
```javascript
// Vertex AI uses Bearer token in Authorization header
const accessToken = await getAccessToken();
const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent`;
await fetch(url, { 
  method: "POST",
  headers: { 
    "Content-Type": "application/json",
    "Authorization": `Bearer ${accessToken}`
  },
  body: JSON.stringify(payload)
});
```

## Required Environment Variables

### For Vertex AI (New)
```bash
# Service account email
GOOGLE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com

# Service account private key (with literal \n characters)
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvQI...\n-----END PRIVATE KEY-----\n

# Endpoint configuration
GEMINI_API_ENDPOINT=vertex

# Model selection
GEMINI_MODEL=gemini-2.5-pro
```

### For Generative Language API (Unchanged)
```bash
# API key
GEMINI_API_KEY=AIzaSyC...your_key_here

# Endpoint configuration
GEMINI_API_ENDPOINT=generativelanguage

# Model selection
GEMINI_MODEL=gemini-2.5-pro
```

## Setup Instructions

### Creating a Service Account

1. **Open Google Cloud Console**:
   - Navigate to https://console.cloud.google.com/

2. **Enable Vertex AI API**:
   - Go to APIs & Services → Library
   - Search for "Vertex AI API"
   - Click "Enable"

3. **Create Service Account**:
   - Go to IAM & Admin → Service Accounts
   - Click "Create Service Account"
   - Name: `perfect-plate-vertex-ai`
   - Description: `Service account for Vertex AI authentication`
   - Click "Create and Continue"

4. **Grant Permissions**:
   - Select role: `Vertex AI User`
   - Click "Continue"
   - Click "Done"

5. **Create JSON Key**:
   - Click on the newly created service account
   - Go to "Keys" tab
   - Click "Add Key" → "Create new key"
   - Select "JSON"
   - Click "Create"
   - Save the downloaded JSON file securely

6. **Extract Credentials**:
   - Open the JSON file
   - Copy the value of `client_email`
   - Copy the value of `private_key` (including `\n` characters)

### Configuring Netlify

1. **Navigate to Netlify Dashboard**:
   - Go to your site's dashboard
   - Click "Site settings"
   - Click "Environment variables"

2. **Add Variables**:
   - Click "Add a variable"
   - Add `GOOGLE_CLIENT_EMAIL` with the value from JSON
   - Add `GOOGLE_PRIVATE_KEY` with the value from JSON (paste as-is, with `\n`)
   - Add/Update `GEMINI_API_ENDPOINT` = `vertex`
   - Add/Update `GEMINI_MODEL` = `gemini-2.5-pro`

3. **Deploy**:
   - Go to "Deploys"
   - Click "Trigger deploy"
   - Select "Deploy site"

4. **Verify**:
   - Visit `https://your-site.netlify.app/.netlify/functions/health-check`
   - Check for successful authentication
   - Look for `"authentication": "OAuth2 (Service Account)"`

## Implementation Details

### Token Generation

The `getAccessToken()` function:
- Uses `google-auth-library` JWT client
- Authenticates with service account credentials
- Requests scope: `https://www.googleapis.com/auth/cloud-platform`
- Returns an OAuth2 access token
- Caches tokens until expiration (with 5-minute buffer)

### Token Caching

Tokens are cached in memory to reduce authentication overhead:
```javascript
let tokenCache = {
  token: null,
  expiryTime: null
};
```

- Tokens are typically valid for 1 hour
- Cache checks expiry before each request
- Regenerates token if expired or missing
- Reduces latency and API calls

### Private Key Handling

The private key from the JSON file contains literal `\n` characters that need to be converted to actual newlines:
```javascript
const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
```

This is automatically handled in the code.

## Files Modified

1. **netlify/functions/package.json** (New)
   - Added `google-auth-library` dependency

2. **netlify/functions/generate-plan.js**
   - Added OAuth2 authentication for Vertex AI
   - Maintained API key support for Generative Language API
   - Added token caching
   - Updated logging to avoid exposing sensitive data

3. **netlify/functions/health-check.js**
   - Added OAuth2 authentication testing for Vertex AI
   - Updated credential checking logic
   - Enhanced error reporting

4. **netlify/functions/list-models.js**
   - Updated authentication check logic
   - Improved endpoint type handling

5. **.env.example**
   - Added `GOOGLE_CLIENT_EMAIL` documentation
   - Added `GOOGLE_PRIVATE_KEY` documentation
   - Updated examples for both authentication methods

6. **.gitignore**
   - Added `node_modules/` exclusion
   - Added `package-lock.json` exclusion

7. **README.md**
   - Updated Vertex AI setup instructions
   - Documented OAuth2 authentication
   - Updated environment variables reference

## Security Improvements

### Before
- API keys visible in URLs (in logs, network traces)
- Single credential type for all operations
- Less granular access control

### After
- OAuth2 tokens in headers (not logged)
- Service account with specific roles
- Follows Google Cloud IAM best practices
- Tokens expire automatically
- No sensitive data in logs

## Backward Compatibility

The implementation maintains full backward compatibility:

- **Generative Language API**: Still uses API key authentication
- **Conditional Logic**: Code checks endpoint type and uses appropriate auth
- **No Breaking Changes**: Existing Generative Language API setups continue to work
- **Graceful Fallback**: Clear error messages if wrong credentials are provided

## Testing

### Manual Validation Script

A validation script (`/tmp/test-auth.js`) was created to verify:
- ✅ google-auth-library dependency installed
- ✅ OAuth2 implementation in generate-plan.js
- ✅ OAuth2 implementation in health-check.js
- ✅ Environment variables documented
- ✅ Backward compatibility maintained
- ✅ Security: node_modules in .gitignore

### Security Scanning

CodeQL security scanning was run and all vulnerabilities were fixed:
- ✅ No sensitive data logged in clear text
- ✅ API keys sanitized in logs
- ✅ Proper error handling for auth failures

### Health Check Testing

Test your configuration:
```bash
curl https://your-site.netlify.app/.netlify/functions/health-check
```

Expected response for Vertex AI:
```json
{
  "status": "ok",
  "configuration": {
    "endpointType": "vertex",
    "authentication": "OAuth2 (Service Account)",
    "serviceAccount": "your-account@project.iam.gserviceaccount.com",
    "model": "gemini-2.5-pro"
  },
  "tests": {
    "vertexModelAccess": "SUCCESS",
    "modelAvailable": true
  }
}
```

## Troubleshooting

### Authentication Errors

**Error**: `GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY environment variables are required`
- **Solution**: Add both environment variables in Netlify dashboard

**Error**: `Failed to generate access token`
- **Solution**: Verify private key is correctly formatted with `\n` characters
- Check service account has "Vertex AI User" role
- Ensure Vertex AI API is enabled in Google Cloud Console

**Error**: `Vertex AI model test failed: 403`
- **Solution**: Service account lacks necessary permissions
- Grant "Vertex AI User" role to the service account
- Wait a few minutes for IAM changes to propagate

### Token Issues

**Error**: Token expiration
- **Solution**: Tokens are automatically refreshed; check cache logic
- Verify system time is correct (affects JWT signing)

**Error**: Invalid scope
- **Solution**: Code uses `https://www.googleapis.com/auth/cloud-platform`
- This scope is correct for Vertex AI access

## Migration Guide

### From API Key to OAuth2

1. **Create service account** (see Setup Instructions above)
2. **Update Netlify environment variables**:
   - Add `GOOGLE_CLIENT_EMAIL`
   - Add `GOOGLE_PRIVATE_KEY`
   - Keep `GEMINI_API_ENDPOINT=vertex`
   - Remove `GEMINI_API_KEY` (if only using Vertex AI)
3. **Deploy** your site
4. **Test** with health check endpoint
5. **Verify** meal plan generation works

### Reverting to API Key (Not Recommended)

If you need to revert to API key authentication:
1. Set `GEMINI_API_ENDPOINT=generativelanguage`
2. Set `GEMINI_API_KEY` to your Google AI Studio key
3. Remove `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY`
4. Redeploy

## References

- [Google Cloud Authentication](https://cloud.google.com/docs/authentication/getting-started)
- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [google-auth-library](https://github.com/googleapis/google-auth-library-nodejs)
- [OAuth 2.0 for Server to Server Applications](https://developers.google.com/identity/protocols/oauth2/service-account)

## Support

For issues or questions:
1. Check the health-check endpoint
2. Review Netlify function logs
3. Verify service account permissions
4. See [DEBUGGING_GUIDE.md](DEBUGGING_GUIDE.md)
5. See [NETLIFY_SETUP.md](NETLIFY_SETUP.md)

---

*Implementation completed: 2025-10-28*  
*Security scan: All clear*  
*Validation tests: All passed*
