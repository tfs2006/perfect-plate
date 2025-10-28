# Security Note - API Key Management

## Important Security Information

### ⚠️ API Key Confidentiality

Your Gemini API key is a sensitive credential that provides access to Google's AI services. **Never share it publicly or commit it to version control.**

### ✅ Secure Practices

1. **Store API keys in Netlify environment variables only**
   - Go to: Netlify Dashboard → Site Settings → Environment Variables
   - Add variables there, never in code

2. **Use .env for local development only**
   - Create a local `.env` file (not committed)
   - Never commit `.env` to git (it's in `.gitignore`)

3. **Rotate keys if exposed**
   - If you accidentally expose an API key, revoke it immediately
   - Generate a new key and update your environment variables

4. **Mask keys in logs**
   - Our functions automatically mask API keys in logs
   - Only first 10 and last 4 characters are shown for verification

### 🔒 What We Do

The Perfect-Plate application implements several security measures:

1. **No keys in client code**
   - API keys are never sent to the browser
   - All API calls go through serverless functions

2. **Automatic key masking**
   - Function logs show: `AQ.YOUR_VER...HERE` (example format)
   - Full key is never logged

3. **Environment variable isolation**
   - Keys are only accessible to backend functions
   - Frontend never sees the key

4. **CORS protection**
   - Configure `ALLOWED_ORIGIN` to restrict access
   - Limit which domains can call your functions

### 📋 Documentation Best Practices

When documenting or sharing configuration:

✅ **DO:**
- Use placeholders: `AQ.YOUR_VERTEX_AI_KEY_HERE`
- Use generic examples: `AIzaSy...your_key_here`
- Reference environment variables without values

❌ **DON'T:**
- Share actual API keys in documentation
- Commit `.env` files with real keys
- Post keys in issues, PRs, or comments
- Include keys in screenshots

### 🔄 Key Rotation

If you need to update your API key:

1. Generate a new key in Google AI Studio or Google Cloud Console
2. Update `GEMINI_API_KEY` in Netlify environment variables
3. Trigger a new deployment
4. Revoke the old key (if it was exposed)

### 📞 If You Accidentally Expose a Key

1. **Immediately revoke the key:**
   - Google AI Studio: https://aistudio.google.com/app/apikey
   - Google Cloud Console: https://console.cloud.google.com/apis/credentials

2. **Generate a new key**

3. **Update your Netlify environment variables**

4. **Check for unauthorized usage:**
   - Review API usage in Google Cloud Console
   - Check for unexpected charges

### 🔗 Additional Resources

- [Google Cloud Security Best Practices](https://cloud.google.com/security/best-practices)
- [Netlify Environment Variables](https://docs.netlify.com/configure-builds/environment-variables/)
- [API Key Management Guide](https://cloud.google.com/docs/authentication/api-keys)

---

**Remember**: Treat your API keys like passwords. Keep them secret, keep them safe.
