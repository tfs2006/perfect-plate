# Token Limits and Prompt Guidelines

## Overview

This document explains the token limits for Gemini API models and how the Perfect-Plate app manages them to avoid MAX_TOKENS errors.

## Token Limits

Most Gemini models have the following limits:
- **Context window**: 8,192 tokens for gemini-1.5-flash and gemini-2.5-flash; 32,768 tokens for gemini-1.5-pro (combined prompt + response)
- **Input (prompt)**: Variable, but typically up to 7,000+ tokens
- **Output (response)**: Limited by `maxOutputTokens` parameter

**Important**: The `totalTokenCount` (prompt + response) must stay under the context window limit.

## How Perfect-Plate Manages Tokens

### 1. Simplified Prompts

The app uses concise prompts to minimize token usage:

```javascript
// Before (verbose, ~20,000 chars)
`Return STRICT JSON ONLY (no markdown) with this schema:
  {
    "planTitle": "string",
    "notes": "string",
    "days": [...]
  }
  
  Do NOT repeat any recipe titles across the week...
  
  ABSOLUTE UNIQUENESS REQUIREMENT:
  - Every recipe (title AND core idea) must be unique...
  
  [Many more detailed instructions...]`

// After (concise, ~2,500 chars)
`JSON ONLY (no markdown). Schema:
{"days":[{"day":"Monday","summary":"Brief overview",...}]}

Days: Monday
Profile: Age 30, male, American, goal: weight loss
Rules:
1. Each day has 3 meals...
2. No duplicates...`
```

### 2. Limited Avoid Lists

To prevent prompt bloat, avoid lists are capped:
- **Titles**: Max 30 titles (was unlimited)
- **Tokens/Keywords**: Max 40 tokens (was unlimited)

```javascript
// Limit avoid lists
const avoidList = avoidTitles.slice(0, 30).join(", ");
const avoidTok = avoidTokens.slice(0, 40).join(", ");
```

### 3. Conservative maxOutputTokens

The app uses progressively lower token budgets:

| Attempt | maxOutputTokens | Use Case |
|---------|-----------------|----------|
| 1 | 1200 | Initial try for single day plan |
| 2 | 900 | Retry with reduced output |
| 3 | 700 | Final attempt with minimal output |

For specialized tasks:
- **Repair plan**: 1200 tokens
- **Fill missing meals**: 1000 tokens
- **Regenerate meal**: 800 tokens

### 4. MAX_TOKENS Detection

The app now detects when generation hits the token limit:

```javascript
if (candidate.finishReason === "MAX_TOKENS") {
  console.error("Generation hit MAX_TOKENS limit - output is incomplete");
  throw new Error("MAX_TOKENS: Response truncated due to token limit...");
}
```

### 5. Token Usage Monitoring

Both frontend and backend log token usage:

```javascript
// Frontend logs
if (obj.usageMetadata) {
  console.log("Token usage:", {
    promptTokenCount: obj.usageMetadata.promptTokenCount,
    candidatesTokenCount: obj.usageMetadata.candidatesTokenCount,
    totalTokenCount: obj.usageMetadata.totalTokenCount
  });
  
  if (obj.usageMetadata.totalTokenCount > 7000) {
    console.warn("Token count is high - may be approaching limits");
  }
}
```

## Best Practices

### For Prompt Engineering

1. **Keep it concise**: Use short, clear instructions
2. **Avoid repetition**: Don't repeat the same rules in different ways
3. **Minimize examples**: Show schema once, not multiple times
4. **Limit context**: Cap avoid lists to essential items only

### For Response Generation

1. **Start small**: Generate one day at a time, not the full week
2. **Progressive complexity**: Start with simple output, add details later
3. **Monitor tokens**: Check `usageMetadata` in responses
4. **Set conservative limits**: Better to get complete output with fewer tokens

### For Error Handling

1. **Detect MAX_TOKENS**: Check `finishReason` in responses
2. **Retry with lower tokens**: If MAX_TOKENS hit, reduce `maxOutputTokens`
3. **Simplify prompt**: Remove optional constraints on retry
4. **Log token usage**: Always log to diagnose issues

## Troubleshooting

### Issue: Getting MAX_TOKENS error

**Symptoms**:
- `finishReason: "MAX_TOKENS"` in response
- Incomplete JSON or truncated output
- totalTokenCount near 8000

**Solutions**:
1. Reduce `maxOutputTokens` (try 800, 700, 600)
2. Simplify the prompt (remove verbose instructions)
3. Reduce avoid lists (limit to 20-30 items)
4. Generate smaller units (1 meal instead of 1 day)

### Issue: Prompt too long

**Symptoms**:
- Warning: "Prompt is long (>2500 chars)"
- High `promptTokenCount` (>2000 tokens)

**Solutions**:
1. Shorten instructions
2. Remove redundant rules
3. Limit avoid lists
4. Use abbreviations where appropriate

### Issue: Response too short

**Symptoms**:
- Valid JSON but missing data
- Incomplete recipes

**Solutions**:
1. Increase `maxOutputTokens` slightly (but stay under limits)
2. Make schema requirements more explicit
3. Use temperature 0.5-0.7 for better instruction following

## Example Token Budgets

For a typical meal plan generation:

```
Prompt (single day with 30 avoid titles):
  - Schema example: ~300 tokens
  - User profile: ~50 tokens
  - Rules: ~100 tokens
  - Avoid lists: ~150 tokens
  Total: ~600 tokens

Response (3 meals with details):
  - Day structure: ~50 tokens
  - Breakfast item: ~300 tokens
  - Lunch item: ~300 tokens
  - Dinner item: ~300 tokens
  Total: ~950 tokens

Grand Total: ~1,550 tokens (safely under 8K limit)
```

With `maxOutputTokens: 1200`, we ensure:
- Prompt: 600 tokens
- Response: up to 1200 tokens
- Buffer: 6,392 tokens remaining

## Model Variations

Different models may have different limits:

| Model | Context Window | Notes |
|-------|---------------|-------|
| gemini-1.5-flash | 8,192 tokens | Fast, recommended |
| gemini-1.5-pro | 32,768 tokens | Larger context, slower |
| gemini-2.5-flash | 8,192 tokens | Latest, similar limits |

To switch models, update the endpoint in code:
```javascript
endpoint: "gemini-1.5-flash:generateContent"  // or gemini-1.5-pro
```

## Summary

The Perfect-Plate app manages tokens by:
1. ✅ Using concise prompts (~2.5K chars vs ~20K)
2. ✅ Limiting avoid lists (30 titles, 40 tokens max)
3. ✅ Conservative maxOutputTokens (700-1200)
4. ✅ Detecting MAX_TOKENS finish reason
5. ✅ Logging token usage for monitoring
6. ✅ Retrying with lower limits on failure

This ensures reliable meal plan generation without hitting token limits.
