# Dynamic Batching and Token Management Guide

**Date:** 2025-10-27  
**Issue:** Fix Gemini API MAX_TOKENS handling with dynamic batching  
**Status:** ✅ Implemented

## Overview

This document explains the dynamic batching and token management system implemented to avoid Gemini API MAX_TOKENS errors and empty responses.

## Problem

Gemini API (2.5-flash and related models) returns empty responses or empty parts/content when:
1. Total token usage (prompt + output) approaches the model's limit (~8192 tokens)
2. Request complexity is too high, even if token counts seem reasonable
3. The model hits internal output or structure complexity limits

**Symptoms:**
- Empty `candidates[0].content.parts` array
- Empty text content despite successful API response
- `finishReason: "MAX_TOKENS"` (sometimes unreported)
- Failed JSON parsing due to incomplete/missing output

**Root Cause:**
Gemini models have strict token limits, and when generating complex structured output (like meal plans), the combination of prompt + expected output can exceed limits even with conservative settings.

## Solution: Dynamic Batching

### 1. Token Estimation

Before making any API call, we now estimate token usage:

```javascript
function estimateTokenCount(text) {
  if (!text) return 0;
  const chars = String(text).length;
  // Conservative estimate: 4 chars per token
  return Math.ceil(chars / 4);
}
```

**Estimation accuracy:**
- English text: ~3-5 chars per token
- JSON/code: ~4-6 chars per token
- Our conservative 4 chars/token provides safety margin

### 2. Pre-Call Token Logging

Every API call now logs estimated token usage BEFORE the call:

```javascript
const tokenEstimate = estimateAndLogTokenUsage(prompt, maxTokens);
// Logs:
// - promptLength (characters)
// - estimatedPromptTokens
// - requestedMaxOutput
// - estimatedTotal
// - modelLimit (8192)
// - utilizationPercent
// - safetyBuffer
```

**Example output:**
```
[Token Estimate] Pre-call estimation: {
  promptLength: 894,
  estimatedPromptTokens: 224,
  requestedMaxOutput: 1200,
  estimatedTotal: 1424,
  modelLimit: 8192,
  utilizationPercent: 17%,
  safetyBuffer: 6768,
  status: "OK"
}
```

### 3. Automatic Token Adjustment

If estimated usage is too high, maxOutputTokens is automatically reduced:

```javascript
function adjustMaxOutputTokens(promptText, requestedMaxOutput, modelLimit = 8192) {
  const estimatedPromptTokens = estimateTokenCount(promptText);
  const targetUtilization = 0.75; // Stay under 75% of limit
  const maxSafeOutput = Math.floor((modelLimit * targetUtilization) - estimatedPromptTokens);
  
  if (maxSafeOutput < requestedMaxOutput) {
    console.warn(`Reducing maxOutputTokens from ${requestedMaxOutput} to ${maxSafeOutput}`);
    return Math.max(maxSafeOutput, 300); // Minimum 300 tokens
  }
  
  return requestedMaxOutput;
}
```

**Benefits:**
- Prevents hitting token limits
- Maintains safety buffer (25% = ~2048 tokens)
- Ensures at least 300 tokens for output

### 4. Dynamic Batch Sizing

The new generation loop uses intelligent batching:

```javascript
// Try to generate 2 days at once when possible
if (remainingDays >= 2) {
  daysToGenerate = [DAYS[i], DAYS[i + 1]];
} else {
  daysToGenerate = [DAYS[i]];
}

// Estimate tokens for batch
const tokenEstimate = estimateAndLogTokenUsage(prompt, maxTokens);

// If batch would use >75% of tokens, split to 1 day
if (tokenEstimate.utilizationPercent > 75 && daysArray.length > 1) {
  console.warn("Batch too large, splitting to individual days");
  return null; // Triggers fallback to single-day generation
}
```

**Batching strategy:**
1. **Try 2-day batches first** (more efficient)
   - Progressive token limits: 1600 → 1200 → 900
   - Auto-adjusts if estimated usage > 75%
2. **Fall back to 1-day generation** if:
   - Token estimate shows high usage
   - Batch generation fails
   - Single day remaining
3. **Progressive retries** with lower tokens:
   - Attempt 1: 1200 tokens, temp 0.7
   - Attempt 2: 900 tokens, temp 0.5
   - Attempt 3: 700 tokens, temp 0.3

### 5. Enhanced Token Logging

Both frontend and backend now log ALL token metadata:

```javascript
// Frontend (js/script.js)
if (obj.usageMetadata) {
  const tokenInfo = {
    promptTokenCount: obj.usageMetadata.promptTokenCount,
    candidatesTokenCount: obj.usageMetadata.candidatesTokenCount,
    totalTokenCount: obj.usageMetadata.totalTokenCount
  };
  
  // Include thoughtsTokenCount for reasoning models
  if (obj.usageMetadata.thoughtsTokenCount !== undefined) {
    tokenInfo.thoughtsTokenCount = obj.usageMetadata.thoughtsTokenCount;
  }
  
  // Log all other fields
  Object.keys(obj.usageMetadata).forEach(key => {
    if (!tokenInfo[key]) tokenInfo[key] = obj.usageMetadata[key];
  });
  
  console.log("[getFirstPartText] Token usage (actual):", tokenInfo);
}
```

**Logged fields:**
- `promptTokenCount` - Actual tokens in prompt
- `candidatesTokenCount` - Tokens in generated response
- `totalTokenCount` - Total tokens used
- `thoughtsTokenCount` - Reasoning tokens (if applicable)
- Any other model-specific metadata

### 6. Improved Empty Response Detection

Better detection and error messages for empty responses:

```javascript
if (!candidate.content) {
  console.error("⚠️ No content in candidate - Gemini returned empty response");
  console.error("This may indicate token/complexity limit hit");
  console.error("Full candidate:", JSON.stringify(candidate, null, 2));
  
  // Check if token-related
  if (obj.usageMetadata && obj.usageMetadata.totalTokenCount > 6500) {
    throw new Error("Empty response likely due to token limit. Total tokens: " + 
                    obj.usageMetadata.totalTokenCount);
  }
  
  return "";
}

if (parts.length === 0) {
  console.error("⚠️ Parts array is empty - Gemini returned no content");
  console.error("This often happens when hitting model output or complexity limits");
  
  if (obj.usageMetadata && obj.usageMetadata.totalTokenCount > 6500) {
    throw new Error("Empty parts likely due to token/complexity limit");
  }
  
  return "";
}
```

### 7. Configuration Logging on Failure

When generation fails, exact config is logged:

```javascript
if (!text) {
  console.error(`⚠️ Model returned no text for ${dayName}`);
  console.error(`Config used:`, {
    maxOutputTokens: adjustedMaxTokens,
    temperature,
    topP: 0.95,
    topK: 40,
    estimatedTotal: tokenEstimate.estimatedTotal,
    utilizationPercent: tokenEstimate.utilizationPercent
  });
  console.error(`Token estimate:`, tokenEstimate);
  return null;
}
```

## Benefits

### 1. Reliability
- **Avoids token limit errors**: Pre-calculation prevents hitting limits
- **Handles empty responses**: Better detection and fallback strategies
- **Guarantees partial results**: Batching ensures at least some days succeed

### 2. Efficiency
- **Batch generation**: 2-day batches reduce API calls by ~50%
- **Smart fallback**: Only switches to single-day when necessary
- **Progressive retries**: Tries higher tokens first, reduces only if needed

### 3. Debuggability
- **Pre-call estimates**: Know token usage before API call
- **Post-call actuals**: Compare estimates with real usage
- **Full config logging**: Exact parameters logged on failure
- **Clear error messages**: User-friendly explanations

### 4. Flexibility
- **Model-agnostic**: Works with any token limit (configurable)
- **Auto-adjusting**: Adapts to prompt size automatically
- **Safety buffer**: 25% margin prevents edge cases

## Token Budget Examples

### Single Day Generation

**Typical prompt:**
- Schema example: ~300 chars = 75 tokens
- User profile: ~200 chars = 50 tokens
- Rules: ~400 chars = 100 tokens
- Avoid lists: ~600 chars = 150 tokens
- **Total prompt: ~1500 chars = 375 tokens**

**Response (1 day, 3 meals):**
- Day structure: ~50 tokens
- Breakfast item: ~300 tokens
- Lunch item: ~300 tokens
- Dinner item: ~300 tokens
- **Total response: ~950 tokens**

**Grand total: ~1325 tokens (16% of 8K limit)**

### Two-Day Batch

**Prompt: ~1500 chars = 375 tokens** (similar to single day)

**Response (2 days, 6 meals):**
- 2 day structures: ~100 tokens
- 6 meal items: ~1800 tokens
- **Total response: ~1900 tokens**

**Grand total: ~2275 tokens (28% of 8K limit)**

### Safety Margins

| Scenario | Prompt | Output | Total | Utilization | Safe? |
|----------|--------|--------|-------|-------------|-------|
| 1 day, attempt 1 | 375 | 1200 | 1575 | 19% | ✓ Yes |
| 1 day, attempt 2 | 375 | 900 | 1275 | 16% | ✓ Yes |
| 1 day, attempt 3 | 375 | 700 | 1075 | 13% | ✓ Yes |
| 2 days, attempt 1 | 375 | 1600 | 1975 | 24% | ✓ Yes |
| 2 days, attempt 2 | 375 | 1200 | 1575 | 19% | ✓ Yes |
| 2 days, attempt 3 | 375 | 900 | 1275 | 16% | ✓ Yes |

All scenarios maintain large safety buffers (>75% remaining capacity).

## Usage Monitoring

### Frontend Console Logs

1. **Pre-call estimation:**
   ```
   [Token Estimate] Pre-call estimation: {
     promptLength: 894,
     estimatedPromptTokens: 224,
     requestedMaxOutput: 1200,
     estimatedTotal: 1424,
     utilizationPercent: 17%,
     status: "OK"
   }
   ```

2. **Generation config:**
   ```
   [generateDay] Generation config for Monday: {
     maxOutputTokens: 1200,
     temperature: 0.7,
     topP: 0.95,
     topK: 40,
     estimatedTotal: 1424,
     utilizationPercent: 17
   }
   ```

3. **Actual token usage:**
   ```
   [getFirstPartText] Token usage (actual): {
     promptTokenCount: 230,
     candidatesTokenCount: 980,
     totalTokenCount: 1210
   }
   ```

4. **Batch processing:**
   ```
   [Generation] Processing batch: Monday & Tuesday (2 days)
   [generateBatch] Generating batch: Monday, Tuesday
   [generateBatch] Config: {
     maxOutputTokens: 1600,
     temperature: 0.7,
     estimatedTotal: 1975,
     utilizationPercent: 24%
   }
   [generateBatch] ✓ Successfully generated 2 days for batch
   ```

### Backend Console Logs (Netlify Functions)

```
[Gemini Proxy] Calling endpoint: gemini-pro:generateContent
[Gemini Proxy] Response status: 200
[Gemini Proxy] Token usage (actual): {
  promptTokenCount: 230,
  candidatesTokenCount: 980,
  totalTokenCount: 1210
}
```

## Best Practices

### For Developers

1. **Monitor token estimates**: Check pre-call logs regularly
2. **Adjust batch sizes**: If estimates consistently show high usage, reduce batch size
3. **Test with real prompts**: Use actual user inputs to validate estimates
4. **Watch for patterns**: If many batches fall back to single-day, adjust thresholds

### For Production

1. **Set appropriate limits**: Adjust `modelLimit` if using different models
2. **Monitor error rates**: Track how often fallbacks occur
3. **Optimize prompts**: Shorter prompts = more room for output
4. **Consider caching**: Cache avoid lists to reduce prompt size

### For Troubleshooting

If generation still fails:

1. **Check pre-call estimates**: Are they consistently high (>50%)?
2. **Review actual usage**: Compare estimates with real token counts
3. **Inspect prompts**: Are avoid lists growing too large?
4. **Verify model**: Ensure using correct model endpoint
5. **Test simpler cases**: Try generating 1 day with minimal avoid lists

## Migration Notes

### Changes from Previous Version

**Before:**
- Generated 1 day at a time (always)
- No pre-call token estimation
- Limited token metadata logging
- Basic MAX_TOKENS detection

**After:**
- Generates 1-2 days at a time (dynamic batching)
- Pre-call token estimation and adjustment
- Comprehensive token metadata logging (including thoughtsTokenCount)
- Enhanced empty response detection
- Config logging on failures

### Non-Breaking Changes

- Same JSON response schema
- Same API endpoints
- Same user interface
- Same data structure
- Backward compatible with existing code

### New Features

- Token estimation functions
- Dynamic batch sizing
- Automatic maxOutputTokens adjustment
- Enhanced logging and diagnostics

## References

This implementation addresses issues reported in:
- https://discuss.ai.google.dev/t/max-output-tokens-isnt-respected-when-using-gemini-2-5-flash-model/106708
- https://github.com/googleapis/python-genai/issues/1039
- https://discuss.ai.google.dev/t/truncated-response-issue-with-gemini-2-5-flash-preview/81258

## Summary

The dynamic batching and token management system:

✅ Estimates token usage before API calls  
✅ Automatically adjusts maxOutputTokens when needed  
✅ Generates 1-2 days at a time (intelligent batching)  
✅ Falls back to single-day generation if needed  
✅ Logs all token metadata (including thoughtsTokenCount)  
✅ Detects empty responses with clear error messages  
✅ Logs exact config on failures  
✅ Maintains large safety buffers (>75% capacity remaining)  
✅ Guarantees at least partial results  
✅ Aggregates daily results into complete week plan  

**Result:** Reliable meal plan generation without MAX_TOKENS errors.
