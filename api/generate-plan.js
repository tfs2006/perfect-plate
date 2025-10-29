// Vercel API Route: Gemini proxy with CORS
// Supports Generative Language API endpoints

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
  const endpointType = process.env.GEMINI_API_ENDPOINT || "generativelanguage";
  
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
 * Extract the model name from an endpoint (e.g., "gemini-2.0-flash-lite:generateContent" → "models/gemini-2.0-flash-lite")
 * @param {string} endpoint 
 * @returns {string}
 */
function getModelNameFromEndpoint(endpoint) {
  const modelPart = endpoint.split(':')[0];
  return modelPart.startsWith('models/') ? modelPart : `models/${modelPart}`;
}

/**
 * Check if a specific model is available via the Gemini API.
 * Caches the list of models to avoid repeated API calls.
 * Note: Only works for Generative Language API, not Vertex AI.
 * @param {string} apiKey - The Gemini API key
 * @param {string} desiredModel - The model to check (e.g., "models/gemini-2.0-flash-lite")
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
  
  // Check cache first
  if (modelCache.models && modelCache.timestamp && (now - modelCache.timestamp) < modelCache.cacheDuration) {
    console.log("[Model Check] Using cached model list");
    const available = modelCache.models.some(m => m.name === desiredModel);
    return { available, models: modelCache.models, error: null };
  }

  try {
    console.log("[Model Check] Fetching available models from API...");
    const listUrl = `${endpointConfig.baseUrl}?key=${apiKey}`;
    const response = await fetch(listUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Model Check] Failed to fetch models:", response.status, errorText);
      return { available: true, models: [], error: `Failed to fetch models: ${response.status}` };
    }

    const data = await response.json();
    const models = data.models || [];
    
    // Update cache
    modelCache.models = models;
    modelCache.timestamp = now;
    
    console.log(`[Model Check] Found ${models.length} available models`);
    const available = models.some(m => m.name === desiredModel);
    
    if (available) {
      console.log(`[Model Check] ✅ Model '${desiredModel}' is available`);
    } else {
      console.log(`[Model Check] ❌ Model '${desiredModel}' is NOT available`);
      console.log("[Model Check] Available models:", models.map(m => m.name).join(", "));
    }
    
    return { available, models, error: null };
  } catch (error) {
    console.error("[Model Check] Exception during model check:", error);
    return { available: true, models: [], error: error.message };
  }
}

export default async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin || req.headers.Origin || "";
  const allowedOrigins = ["*"]; // Vercel allows all origins by default
  
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    const { endpoint, body } = req.body;
    if (!endpoint || !body) {
      res.status(400).json({ error: "Missing endpoint or body" });
      return;
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      res.status(500).json({ error: "GEMINI_API_KEY not configured" });
      return;
    }

    // Get endpoint configuration
    const endpointConfig = getEndpointConfig();
    
    // Allow environment variable to override the model
    const configuredModel = process.env.GEMINI_MODEL;
    let actualEndpoint = endpoint;
    
    if (configuredModel) {
      // Extract the method from the original endpoint (e.g., "generateContent" from "gemini-2.0-flash-lite:generateContent")
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
          "Check if the model is enabled in Google Cloud Console",
          "Ensure your API key has the necessary permissions in AI Studio",
          "Consider using an alternative model from the availableModels list"
        ]
      };
      
      if (modelCheck.error) {
        errorMessage.checkError = modelCheck.error;
      }
      
      console.error("[Gemini Proxy] Available alternatives:", alternatives.map(m => m.name).join(", "));
      res.status(404).json(errorMessage);
      return;
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
    
    const resp = await fetch(url, { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify(body) 
    });
    
    const text = await resp.text();

    console.log("[Gemini Proxy] Response status:", resp.status);
    console.log("[Gemini Proxy] Response length:", text.length);
    
    if (!resp.ok) {
      console.error("[Gemini Proxy] API error:", text);
      res.status(resp.status).json({ error: text || "Gemini API error" });
      return;
    }
    
    // Log response structure to help debug empty responses
    try {
      const parsed = JSON.parse(text);
      const hasCandidates = Array.isArray(parsed.candidates) && parsed.candidates.length > 0;
      const hasParts = hasCandidates && Array.isArray(parsed.candidates[0]?.content?.parts);
      const hasText = hasParts && parsed.candidates[0].content.parts.some(p => p.text);
      const finishReason = hasCandidates ? parsed.candidates[0]?.finishReason : null;
      
      console.log("[Gemini Proxy] Response structure - candidates:", hasCandidates, "parts:", hasParts, "hasText:", hasText, "finishReason:", finishReason);
      
      // Log token usage if present
      if (parsed.usageMetadata) {
        const tokenInfo = {
          promptTokenCount: parsed.usageMetadata.promptTokenCount,
          candidatesTokenCount: parsed.usageMetadata.candidatesTokenCount,
          totalTokenCount: parsed.usageMetadata.totalTokenCount
        };
        
        // Include any additional token counts
        if (parsed.usageMetadata.thoughtsTokenCount !== undefined) {
          tokenInfo.thoughtsTokenCount = parsed.usageMetadata.thoughtsTokenCount;
        }
        
        console.log("[Gemini Proxy] Token usage (actual):", tokenInfo);
        
        // Warn if hitting token limits
        if (finishReason === "MAX_TOKENS") {
          console.error("[Gemini Proxy] ⚠️ Response hit MAX_TOKENS - output is incomplete!");
        }
      }
    } catch (e) {
      console.warn("[Gemini Proxy] Could not parse response for validation:", e.message);
    }
    
    // Set CORS headers and return response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    
    res.status(200).json(JSON.parse(text));
  } catch (err) {
    console.error("[Gemini Proxy] Exception:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
}