// Netlify Function: List available Gemini models
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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "GEMINI_API_KEY not configured" }) };
    }

    const url = `https://generativelanguage.googleapis.com/v1/models?key=${key}`;
    console.log("[List Models] Fetching available models from Gemini API");
    
    const resp = await fetch(url, { method: "GET" });
    const text = await resp.text();

    console.log("[List Models] Response status:", resp.status);
    
    if (!resp.ok) {
      console.error("[List Models] API error:", text);
      return { statusCode: resp.status, headers: cors, body: text || JSON.stringify({ error: "Gemini API error" }) };
    }
    
    try {
      const parsed = JSON.parse(text);
      const models = parsed.models || [];
      
      console.log("[List Models] Found", models.length, "models");
      
      // Log model names for debugging
      models.forEach(model => {
        console.log("[List Models] -", model.name, "- Supported:", model.supportedGenerationMethods?.join(", "));
      });
      
      // Filter to only models that support generateContent
      const contentGenModels = models.filter(m => 
        m.supportedGenerationMethods?.includes("generateContent")
      );
      
      console.log("[List Models] Models supporting generateContent:", contentGenModels.length);
      
      return { 
        statusCode: 200, 
        headers: cors, 
        body: JSON.stringify({
          allModels: models.map(m => ({
            name: m.name,
            displayName: m.displayName,
            supportedMethods: m.supportedGenerationMethods
          })),
          generateContentModels: contentGenModels.map(m => ({
            name: m.name,
            displayName: m.displayName
          }))
        }, null, 2)
      };
    } catch (e) {
      console.error("[List Models] Error parsing response:", e.message);
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Failed to parse models response" }) };
    }
    
  } catch (err) {
    console.error("[List Models] Exception:", err);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message || "Server error" }) };
  }
};
