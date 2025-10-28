# Gemini API Response Debugging Guide

## Problem
The Gemini API returns successfully (HTTP 200, no model-not-found error), but the model response contains no text for any day, resulting in errors like:
- "Model returned no text for Monday Full response: Object"
- "Failed to generate valid plan for [day]"

## Root Causes

This issue can have several root causes:

### 1. Empty Response from Gemini API
The API returns a valid response structure but with no text content in `candidates[0].content.parts[0].text`.

**Possible reasons:**
- Safety filters blocking content
- Invalid request parameters (maxOutputTokens too high/low)
- Prompt complexity causing the model to fail
- Rate limiting or quota issues
- Model endpoint issues

### 2. Incorrect Response Parsing
The response structure might be different than expected.

**Possible reasons:**
- API version mismatch
- Model returns data in a different format
- Response has candidates but no content.parts

### 3. Blocked Content
The model may block responses due to safety concerns.

**Indicators:**
- `promptFeedback.blockReason` in response
- `finishReason: "SAFETY"` or `finishReason: "RECITATION"`

## Changes Made to Fix

### Backend (netlify/functions/generate-plan.js)

1. **Added comprehensive logging**
   ```javascript
   console.log("[Gemini Proxy] Calling endpoint:", endpoint);
   console.log("[Gemini Proxy] Response status:", resp.status);
   console.log("[Gemini Proxy] Response length:", text.length);
   ```

2. **Added response validation**
   - Checks if response has candidates
   - Checks if candidates have parts
   - Checks if parts have text
   - Logs full response when no text is found

3. **Added error logging**
   - Logs full response JSON when validation fails
   - Helps identify the exact structure of problematic responses

### Frontend (js/script.js)

1. **Enhanced `getFirstPartText()` function**
   - Detailed logging at each step of response parsing
   - Checks for `promptFeedback.blockReason`
   - Checks for `finishReason` (SAFETY, RECITATION)
   - Throws meaningful errors for blocked content
   - Handles edge cases (no candidates, no parts, no text)

2. **Improved error handling in `generateDay()`**
   - Logs full response structure when no text is returned
   - Logs response keys and structure
   - Tracks attempt numbers for retries
   - Logs prompt length to detect overly long prompts

3. **Added test mechanism**
   - When all days fail, runs a simple test prompt
   - Helps distinguish between API issues vs. prompt issues
   - Provides actionable error messages

4. **Improved generationConfig**
   - Added `topP: 0.95` for better control over randomness
   - Added `topK: 40` for diversity
   - Retry logic with different token counts (2200 → 1600 → 1400)
   - Retry logic with different temperatures (0.7 → 0.4 → 0.3)

5. **Better `repairPlan()` function**
   - Uses `getFirstPartText()` for consistent parsing
   - Adds try-catch for error handling
   - Returns original plan if repair fails
   - Adds logging for debugging

6. **Prompt size logging**
   - Warns if prompt exceeds 20,000 characters
   - Helps identify issues with overly complex prompts

## Diagnostic Steps

### Step 1: Check Browser Console
Open DevTools (F12) → Console tab and look for:
- `[getFirstPartText]` logs showing response structure
- `[generateDay]` logs showing what was received
- Warning messages about missing candidates, parts, or text

### Step 2: Check Netlify Function Logs
In Netlify Dashboard → Functions → generate-plan → Logs:
- Look for `[Gemini Proxy]` logs
- Check response status and length
- Look for warnings about empty responses

### Step 3: Use the Diagnostic Tool
Open `test-api.html` in your browser and run tests:
1. **Simple Test**: Confirms API connectivity
2. **JSON Test**: Confirms JSON generation works
3. **Meal Plan Test**: Tests actual meal plan prompt
4. **Model Test**: Tests different model endpoints

### Step 4: Analyze the Response Structure
If you see "Full response: Object" in console:
1. Click on the object in console to expand it
2. Check if `candidates` array exists and has items
3. Check if `candidates[0].content` exists
4. Check if `candidates[0].content.parts` exists and has items
5. Check if any part has a `text` property

### Step 5: Check for Blocked Content
Look for these indicators in the response:
- `promptFeedback.blockReason` - Why content was blocked
- `candidates[0].finishReason: "SAFETY"` - Stopped for safety
- `candidates[0].finishReason: "RECITATION"` - Stopped for copyright

## Common Solutions

### Solution 1: Model Name Configuration
The code now uses `gemini-2.5-pro` which is the only allowed model for the current API key configuration.

**Current model:** `gemini-2.5-pro` (only allowed model, optimized for structured JSON output)

**Note:** This configuration is restricted to gemini-2.5-pro only due to API key limitations.

**Full API Endpoint**: `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent`

**How to verify:**
```javascript
// Current implementation uses:
endpoint: "gemini-2.5-pro:generateContent"
```

### Solution 2: maxOutputTokens Too High
Some models have limits on output tokens.

**Fix:** The code already retries with lower values (2200 → 1600 → 1400), but you can adjust these further:
```javascript
let planPart = await tryOnce(1500, 0.7, 1);  // Start lower
if (!planPart) planPart = await tryOnce(1200, 0.4, 2);
if (!planPart) planPart = await tryOnce(1000, 0.3, 3);
```

### Solution 3: Prompt Too Complex
The meal plan prompt is very detailed and includes many constraints.

**Fix:** Simplify the prompt by:
- Reducing the number of avoid lists
- Removing some constraints
- Breaking into smaller parts

### Solution 4: API Key or Quota Issues
The API key might be invalid or quota exceeded.

**Fix:**
1. Check API key in Netlify environment variables
2. Check quota in Google Cloud Console
3. Verify API is enabled for your project

### Solution 5: Safety Filters Too Strict
Content might be getting blocked by safety filters.

**Fix:** Add safety settings to generationConfig:
```javascript
generationConfig: {
  maxOutputTokens: 2000,
  temperature: 0.7,
  topP: 0.95,
  topK: 40,
  // Add safety settings
  safetySettings: [
    {
      category: "HARM_CATEGORY_HARASSMENT",
      threshold: "BLOCK_ONLY_HIGH"
    },
    // Add other categories as needed
  ]
}
```

## Testing Your Fix

After making changes:

1. **Clear browser cache** and reload
2. **Check console logs** for detailed output
3. **Try diagnostic tool** to isolate the issue
4. **Test with simple inputs** first (e.g., minimal exclusions)
5. **Gradually add complexity** to find breaking point

## Getting Help

If issues persist:

1. **Share console logs** - Full `[getFirstPartText]` and `[generateDay]` logs
2. **Share Netlify logs** - Full `[Gemini Proxy]` logs
3. **Share response structure** - The full response object from a failed call
4. **Share diagnostic results** - Results from test-api.html tests

## Additional Resources

- [Gemini API Documentation](https://ai.google.dev/api/rest)
- [Gemini API Error Codes](https://ai.google.dev/api/rest/v1/Status)
- [Safety Settings](https://ai.google.dev/api/rest/v1/SafetySetting)
- [Generation Config](https://ai.google.dev/api/rest/v1/GenerationConfig)
