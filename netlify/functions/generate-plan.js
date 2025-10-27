// Netlify Function: Gemini proxy with multi-origin CORS
exports.handler = async (event) => {
  const originsEnv = process.env.ALLOWED_ORIGIN || "*";
  const allowedList = originsEnv.split(",").map(s => s.trim()).filter(Boolean);
  const reqOrigin = event.headers?.origin || event.headers?.Origin || "";

  const allowOriginHeader = allowedList.includes("*")
    ? "*"
    : (reqOrigin && allowedList.includes(reqOrigin) ? reqOrigin : (allowedList[0] || "*"));

  const cors = {
    "Access-Control-Allow-Origin": allowOriginHeader,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const { endpoint, body } = JSON.parse(event.body || "{}");
    if (!endpoint || !body) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Missing endpoint or body" }) };
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "GEMINI_API_KEY not configured" }) };
    }

    const url = `https://generativelanguage.googleapis.com/v1/models/${endpoint}?key=${key}`;
    console.log("[Gemini Proxy] Calling endpoint:", endpoint);
    console.log("[Gemini Proxy] Request body keys:", Object.keys(body));
    
    const resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const text = await resp.text();

    console.log("[Gemini Proxy] Response status:", resp.status);
    console.log("[Gemini Proxy] Response length:", text.length);
    
    if (!resp.ok) {
      console.error("[Gemini Proxy] API error:", text);
      return { statusCode: resp.status, headers: cors, body: text || JSON.stringify({ error: "Gemini API error" }) };
    }
    
    // Log response structure to help debug empty responses
    try {
      const parsed = JSON.parse(text);
      const hasCandidates = Array.isArray(parsed.candidates) && parsed.candidates.length > 0;
      const hasParts = hasCandidates && Array.isArray(parsed.candidates[0]?.content?.parts);
      const hasText = hasParts && parsed.candidates[0].content.parts.some(p => p.text);
      const finishReason = hasCandidates ? parsed.candidates[0]?.finishReason : null;
      
      console.log("[Gemini Proxy] Response structure - candidates:", hasCandidates, "parts:", hasParts, "hasText:", hasText, "finishReason:", finishReason);
      
      // Log token usage if present (including all metadata like thoughtsTokenCount)
      if (parsed.usageMetadata) {
        const tokenInfo = {
          promptTokenCount: parsed.usageMetadata.promptTokenCount,
          candidatesTokenCount: parsed.usageMetadata.candidatesTokenCount,
          totalTokenCount: parsed.usageMetadata.totalTokenCount
        };
        
        // Include any additional token counts (e.g., thoughtsTokenCount for reasoning models)
        if (parsed.usageMetadata.thoughtsTokenCount !== undefined) {
          tokenInfo.thoughtsTokenCount = parsed.usageMetadata.thoughtsTokenCount;
        }
        
        // Log all available metadata fields
        Object.keys(parsed.usageMetadata).forEach(key => {
          if (!tokenInfo[key] && parsed.usageMetadata[key] !== undefined) {
            tokenInfo[key] = parsed.usageMetadata[key];
          }
        });
        
        console.log("[Gemini Proxy] Token usage (actual):", tokenInfo);
        
        // Warn if hitting token limits
        if (finishReason === "MAX_TOKENS") {
          console.error("[Gemini Proxy] ⚠️ Response hit MAX_TOKENS - output is incomplete!");
          console.error("[Gemini Proxy] Token counts:", tokenInfo);
        }
        
        if (parsed.usageMetadata.totalTokenCount > 7000) {
          console.warn("[Gemini Proxy] ⚠️ Total token count is high:", parsed.usageMetadata.totalTokenCount, "- Approaching model limits");
        } else if (parsed.usageMetadata.totalTokenCount > 6000) {
          console.warn("[Gemini Proxy] Token count is elevated:", parsed.usageMetadata.totalTokenCount);
        }
      }
      
      if (!hasText && hasCandidates) {
        console.error("[Gemini Proxy] ⚠️ Response has candidates but no text content");
        console.error("[Gemini Proxy] This often indicates hitting model complexity/token limits");
        console.warn("[Gemini Proxy] Full response:", JSON.stringify(parsed, null, 2));
      }
    } catch (e) {
      console.warn("[Gemini Proxy] Could not parse response for validation:", e.message);
    }
    
    return { statusCode: 200, headers: cors, body: text };
  } catch (err) {
    console.error("[Gemini Proxy] Exception:", err);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message || "Server error" }) };
  }
};