# Gemini API Diagnostic Tool

This is a diagnostic tool to help troubleshoot issues with the Gemini API integration.

## How to Use

1. Make sure you have configured `js/config.js` with your `API_BASE` pointing to your Netlify Functions URL
2. Make sure your Netlify Function has the `GEMINI_API_KEY` environment variable set
3. Open `test-api.html` in your browser
4. Run each test to diagnose the issue:
   - **Simple Text Generation Test**: Tests if API returns any text at all
   - **JSON Generation Test**: Tests if API can generate structured JSON
   - **Meal Plan Test**: Tests the actual meal plan prompt
   - **Model Availability Test**: Tests different model names to find which ones work

## What Each Test Does

### Test 1: Simple Text Generation
- Sends a very simple prompt: "Say hello"
- Should return text if the API is working at all
- If this fails, check your API key and endpoint configuration

### Test 2: JSON Generation
- Tests if the API can return structured JSON data
- If this fails but Test 1 passes, there might be an issue with JSON formatting

### Test 3: Meal Plan Test
- Tests the actual meal plan generation with a simplified prompt
- If this fails but Tests 1-2 pass, the issue is with the meal plan prompt complexity

### Test 4: Model Availability
- Tests multiple model names to find which ones are actually available
- Useful if you get "model not found" errors

## Common Issues

### Issue: "No candidates in response"
- This means the API returned a response but with no content
- Could be due to safety filters blocking content
- Could be due to invalid request parameters

### Issue: "No content.parts in candidate"
- The response structure is different than expected
- Might indicate API version mismatch

### Issue: "No text found in any parts"
- The API returned a response but no text content
- Could be due to the request being blocked
- Could be due to maxOutputTokens being too low

## Next Steps

After running the tests:

1. Check the browser console for detailed logs
2. Look at the "Full Response" JSON to see the actual API response structure
3. Compare successful responses with failed ones to identify patterns
4. Adjust the code in `js/script.js` based on findings

## Debugging Tips

- Open browser DevTools (F12) and check the Console tab for detailed logs
- The Netlify Function logs can be viewed in the Netlify dashboard under Functions → generate-plan → Logs
- Compare the response structure between working and non-working calls
