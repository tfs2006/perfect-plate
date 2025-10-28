// Netlify Function: Gemini proxy with multi-origin CORS
// Supports both Vertex AI and Generative Language API endpoints

// Cache for available models (in-memory cache for serverless function)
let modelCache = {
  models: null,
  timestamp: null,
  cacheDuration: 3600000 // 1 hour in milliseconds
};

/**
 * Get the API endpoint configuration from environment variables.
 * Returns the base URL and endpoint type.
 */
function getEndpointConfig() {
  const endpointType = process.env.GEMINI_API_ENDPOINT || "vertex";
  
  if (endpointType === "vertex" || endpointType === "vertexai") {
    return {
      type: "vertex",
      baseUrl: "https://aiplatform.googleapis.com/v1/publishers/google/models/",
      supportsListModels: false
    };
  }
  
  // Default to Generative Language API
  return {
    type: "generativelanguage",
    baseUrl: "https://generativelanguage.googleapis.com/v1/models/",
    supportsListModels: true
  };
}

/**
 * Check if a specific model is available via the Gemini API.
 * Caches the list of models to avoid repeated API calls.
 * Note: Only works for Generative Language API, not Vertex AI.
 * @param {string} apiKey - The Gemini API key
 * @param {string} desiredModel - The model to check (e.g., "models/gemini-2.5-pro")
 * @param {object} endpointConfig - The endpoint configuration
 * @returns {Promise<{available: boolean, models: Array, error: string|null}>}
 */
async function checkModelAvailability(apiKey, desiredModel, endpointConfig) {
  // Vertex AI doesn't support list models endpoint, so we'll assume model is available
  if (!endpointConfig.supportsListModels) {
    console.log("[Model Check] Vertex AI endpoint - skipping model list check");
    return { available: true, models: [], error: null };
  }

  const now = Date.now();
  
  // Check if cache is valid
  if (modelCache.models && modelCache.timestamp && (now - modelCache.timestamp < modelCache.cacheDuration)) {
    console.log("[Model Check] Using cached model list");
    const available = modelCache.models.some(m => m.name === desiredModel);
    return { available, models: modelCache.models, error: null };
  }
  
  console.log("[Model Check] Fetching available models from Gemini API");
  
  try {
    const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
    const resp = await fetch(url, { method: "GET" });
    
    if (!resp.ok) {
      const errorText = await resp.text();
      console.error("[Model Check] Failed to fetch models:", resp.status, errorText);
      return { available: false, models: [], error: `API error: ${resp.status}` };
    }
    
    const data = await resp.json();
    const models = data.models || [];
    
    // Cache the results
    modelCache.models = models;
    modelCache.timestamp = now;
    
    console.log("[Model Check] Found", models.length, "models");
    
    // Log all available models
    models.forEach(model => {
      const methods = model.supportedGenerationMethods?.join(", ") || "none";
      console.log(`[Model Check] - ${model.name} (${methods})`);
    });
    
    // Check if desired model is available
    const available = models.some(m => m.name === desiredModel);
    
    if (available) {
      console.log(`[Model Check] ✅ Desired model '${desiredModel}' is available`);
    } else {
      console.warn(`[Model Check] ⚠️ Desired model '${desiredModel}' is NOT available`);
      console.warn("[Model Check] Available models that support generateContent:");
      const contentGenModels = models.filter(m => 
        m.supportedGenerationMethods?.includes("generateContent")
      );
      contentGenModels.forEach(m => {
        console.warn(`[Model Check]   - ${m.name} (${m.displayName})`);
      });
      
      if (contentGenModels.length === 0) {
        console.error("[Model Check] ❌ No models support generateContent! Check API key permissions.");
      }
    }
    
    return { available, models, error: null };
  } catch (err) {
    console.error("[Model Check] Exception while checking models:", err.message);
    return { available: false, models: [], error: err.message };
  }
}

/**
 * Extract the model name from an endpoint string.
 * E.g., "gemini-2.5-pro:generateContent" -> "models/gemini-2.5-pro"
 */
function getModelNameFromEndpoint(endpoint) {
  const modelPart = endpoint.split(':')[0];
  return `models/${modelPart}`;
}

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

    // Get endpoint configuration
    const endpointConfig = getEndpointConfig();
    
    // Allow environment variable to override the model
    const configuredModel = process.env.GEMINI_MODEL;
    let actualEndpoint = endpoint;
    
    if (configuredModel) {
      // Extract the method from the original endpoint (e.g., "generateContent" from "gemini-2.5-pro:generateContent")
      const endpointParts = endpoint.split(':');
      const method = endpointParts.length > 1 ? endpointParts[1] : 'generateContent';
      actualEndpoint = `${configuredModel}:${method}`;
      console.log(`[Gemini Proxy] Model override: ${endpoint} → ${actualEndpoint}`);
    }
    
    console.log(`[Gemini Proxy] Using ${endpointConfig.type} endpoint: ${endpointConfig.baseUrl}`);
    console.log(`[Gemini Proxy] Model endpoint: ${actualEndpoint}`);
    console.log(`[Gemini Proxy] API Key: ${key.substring(0, 10)}...${key.substring(key.length - 4)}`);

    // Check model availability before making the request (only for Generative Language API)
    const modelName = getModelNameFromEndpoint(actualEndpoint);
    const modelCheck = await checkModelAvailability(key, modelName, endpointConfig);
    
    if (!modelCheck.available && endpointConfig.supportsListModels) {
      console.error(`[Gemini Proxy] ❌ Model '${modelName}' is NOT available`);
      
      // Find alternative models that support generateContent
      const alternatives = modelCheck.models.filter(m => 
        m.supportedGenerationMethods?.includes("generateContent")
      );
      
      const errorMessage = {
        error: "MODEL_NOT_FOUND",
        message: `The requested model '${modelName}' is not available with your current API key.`,
        requestedModel: modelName,
        availableModels: alternatives.map(m => ({
          name: m.name,
          displayName: m.displayName
        })),
        troubleshooting: [
          "Verify your Google Cloud project has access to the Gemini API",
          "Check if the model is enabled in Google Cloud Console: https://console.cloud.google.com/vertex-ai/generative-ai/models",
          "Ensure your API key has the necessary permissions in AI Studio: https://aistudio.google.com/",
          "Consider using an alternative model from the availableModels list"
        ]
      };
      
      if (modelCheck.error) {
        errorMessage.checkError = modelCheck.error;
      }
      
      console.error("[Gemini Proxy] Available alternatives:", alternatives.map(m => m.name).join(", "));
      return { statusCode: 404, headers: cors, body: JSON.stringify(errorMessage) };
    }
    
    console.log(`[Gemini Proxy] ✅ Model '${modelName}' check passed`);

    // Build the appropriate URL based on endpoint type
    let url;
    if (endpointConfig.type === "vertex") {
      // Vertex AI uses a different URL structure
      url = `${endpointConfig.baseUrl}${actualEndpoint}?key=${key}`;
    } else {
      // Generative Language API
      url = `${endpointConfig.baseUrl}${actualEndpoint}?key=${key}`;
    }
    
    console.log("[Gemini Proxy] Calling endpoint:", actualEndpoint);
    console.log("[Gemini Proxy] Full URL:", url.replace(key, "***KEY_HIDDEN***"));
    console.log("[Gemini Proxy] Request body keys:", Object.keys(body));
    
    const resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const text = await resp.text();

    console.log("[Gemini Proxy] Response status:", resp.status);
    console.log("[Gemini Proxy] Response length:", text.length);
    
    if (!resp.ok) {
      console.error("[Gemini Proxy] API error:", text);
      
      // Special handling for 404 NOT_FOUND errors
      if (resp.status === 404) {
        console.error("[Gemini Proxy] ❌ 404 NOT_FOUND - Model may not be available");
        console.error("[Gemini Proxy] This usually means:");
        console.error("[Gemini Proxy]   1. The model name is incorrect");
        console.error("[Gemini Proxy]   2. Your API key doesn't have access to this model");
        console.error("[Gemini Proxy]   3. The model hasn't been enabled in your Google Cloud project");
        console.error("[Gemini Proxy] Run the model availability check at startup to diagnose");
        
        // Try to parse error and add helpful context
        try {
          const errorData = JSON.parse(text);
          errorData.troubleshooting = [
            "Check model availability using the /list-models endpoint",
            "Verify model access in Google Cloud Console: https://console.cloud.google.com/vertex-ai/generative-ai/models",
            "Ensure API key permissions in AI Studio: https://aistudio.google.com/",
            "See README.md for detailed troubleshooting steps"
          ];
          return { statusCode: resp.status, headers: cors, body: JSON.stringify(errorData) };
        } catch (e) {
          // If we can't parse the error, return original text with added context
        }
      }
      
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