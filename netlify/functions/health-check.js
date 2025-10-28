// Netlify Function: Health check for Gemini API configuration
// This endpoint verifies API key, endpoint, and model availability

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

  const healthCheck = {
    status: "ok",
    timestamp: new Date().toISOString(),
    configuration: {},
    tests: {},
    warnings: [],
    errors: []
  };

  try {
    // Check API key
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      healthCheck.status = "error";
      healthCheck.errors.push("GEMINI_API_KEY environment variable is not set");
      healthCheck.configuration.apiKey = "NOT_CONFIGURED";
    } else {
      healthCheck.configuration.apiKey = `${key.substring(0, 10)}...${key.substring(key.length - 4)}`;
    }

    // Check endpoint configuration
    const endpointType = process.env.GEMINI_API_ENDPOINT || "generativelanguage";
    healthCheck.configuration.endpointType = endpointType;
    
    let baseUrl;
    if (endpointType === "vertex") {
      baseUrl = "https://aiplatform.googleapis.com/v1/publishers/google/models/";
      healthCheck.configuration.baseUrl = baseUrl;
    } else {
      baseUrl = "https://generativelanguage.googleapis.com/v1/models/";
      healthCheck.configuration.baseUrl = baseUrl;
    }

    // Check configured model
    const configuredModel = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
    healthCheck.configuration.model = configuredModel;

    // If API key is configured, test it
    if (key) {
      console.log("[Health Check] Testing API connectivity...");
      console.log("[Health Check] Endpoint type:", endpointType);
      console.log("[Health Check] Base URL:", baseUrl);
      console.log("[Health Check] API Key:", healthCheck.configuration.apiKey);

      try {
        // Test model listing endpoint
        let listUrl;
        if (endpointType === "vertex") {
          // Vertex AI doesn't have a simple list models endpoint in the same way
          // We'll test by attempting to call the model directly
          listUrl = `${baseUrl}${configuredModel}:streamGenerateContent?key=${key}`;
          healthCheck.tests.modelListEndpoint = "N/A (Vertex AI)";
          healthCheck.warnings.push("Vertex AI does not support list models endpoint - testing direct model access instead");
        } else {
          listUrl = `https://generativelanguage.googleapis.com/v1/models?key=${key}`;
          healthCheck.tests.modelListEndpoint = listUrl;
        }

        // For Vertex AI, test direct model access; for Generative Language, list models
        if (endpointType === "vertex") {
          // Test with a simple prompt for Vertex AI
          const testUrl = `${baseUrl}${configuredModel}:streamGenerateContent?key=${key}`;
          const testBody = {
            contents: [{
              parts: [{ text: "Say 'OK' if you can read this." }]
            }],
            generationConfig: {
              maxOutputTokens: 10,
              temperature: 0.1
            }
          };

          console.log("[Health Check] Testing Vertex AI model access:", testUrl);
          const testResp = await fetch(testUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(testBody)
          });

          if (testResp.ok) {
            healthCheck.tests.vertexModelAccess = "SUCCESS";
            healthCheck.tests.modelAvailable = true;
            console.log("[Health Check] ✅ Vertex AI model access successful");
          } else {
            const errorText = await testResp.text();
            healthCheck.tests.vertexModelAccess = `FAILED (${testResp.status})`;
            healthCheck.tests.modelAvailable = false;
            healthCheck.errors.push(`Vertex AI model test failed: ${testResp.status} - ${errorText}`);
            console.error("[Health Check] ❌ Vertex AI model access failed:", testResp.status, errorText);
          }
        } else {
          // Test model listing for Generative Language API
          const listResp = await fetch(listUrl, { method: "GET" });

          if (!listResp.ok) {
            const errorText = await listResp.text();
            healthCheck.status = "error";
            healthCheck.errors.push(`Model listing failed: ${listResp.status} - ${errorText}`);
            healthCheck.tests.modelListAccess = `FAILED (${listResp.status})`;
            console.error("[Health Check] ❌ Model listing failed:", listResp.status, errorText);
          } else {
            const data = await listResp.json();
            const models = data.models || [];
            
            healthCheck.tests.modelListAccess = "SUCCESS";
            healthCheck.tests.totalModelsAvailable = models.length;
            
            // Check if configured model is available
            const fullModelName = configuredModel.startsWith("models/") 
              ? configuredModel 
              : `models/${configuredModel}`;
            
            const modelExists = models.some(m => m.name === fullModelName);
            healthCheck.tests.configuredModelAvailable = modelExists;
            
            if (!modelExists) {
              healthCheck.warnings.push(`Configured model '${configuredModel}' not found in available models`);
              
              // Find generateContent-capable models
              const contentGenModels = models.filter(m => 
                m.supportedGenerationMethods?.includes("generateContent")
              );
              
              healthCheck.tests.alternativeModels = contentGenModels.map(m => ({
                name: m.name,
                displayName: m.displayName
              }));
              
              if (contentGenModels.length > 0) {
                healthCheck.warnings.push(`${contentGenModels.length} alternative models available that support generateContent`);
              } else {
                healthCheck.errors.push("No models found that support generateContent");
                healthCheck.status = "error";
              }
            } else {
              console.log("[Health Check] ✅ Configured model is available");
            }
            
            console.log("[Health Check] Found", models.length, "models total");
          }
        }
      } catch (err) {
        healthCheck.status = "error";
        healthCheck.errors.push(`API test failed: ${err.message}`);
        healthCheck.tests.apiConnectivity = "FAILED";
        console.error("[Health Check] Exception during API test:", err);
      }
    } else {
      healthCheck.tests.apiConnectivity = "SKIPPED (no API key)";
    }

    // Determine final status
    if (healthCheck.errors.length > 0) {
      healthCheck.status = "error";
    } else if (healthCheck.warnings.length > 0) {
      healthCheck.status = "warning";
    }

    console.log("[Health Check] Final status:", healthCheck.status);
    console.log("[Health Check] Errors:", healthCheck.errors.length);
    console.log("[Health Check] Warnings:", healthCheck.warnings.length);

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify(healthCheck, null, 2)
    };

  } catch (err) {
    console.error("[Health Check] Unexpected error:", err);
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({
        status: "error",
        timestamp: new Date().toISOString(),
        error: err.message || "Internal server error"
      })
    };
  }
};
