// Netlify Function: Health check for Gemini API configuration
// This endpoint verifies API key, endpoint, and model availability

const {JWT} = require('google-auth-library');

const SCOPES = ['https://www.googleapis.com/auth/cloud-platform'];

/**
 * Generate OAuth2 access token for Vertex AI authentication using service account credentials.
 * @returns {Promise<string>} The access token
 */
async function getAccessToken() {
  console.log("[Health Check Auth] Generating access token");
  
  // Load service account credentials from environment variables
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error("GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY environment variables are required for Vertex AI authentication");
  }

  // Replace literal \n with actual newlines in the private key
  const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

  const authClient = new JWT({
    email: clientEmail,
    key: formattedPrivateKey,
    scopes: SCOPES
  });

  await authClient.authorize();
  
  console.log("[Health Check Auth] Access token generated");
  
  return authClient.credentials.access_token;
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
    // Check endpoint configuration first
    const endpointType = process.env.GEMINI_API_ENDPOINT || "vertex";
    healthCheck.configuration.endpointType = endpointType;
    
    let baseUrl;
    if (endpointType === "vertex") {
      baseUrl = "https://aiplatform.googleapis.com/v1/publishers/google/models/";
      healthCheck.configuration.baseUrl = baseUrl;
      
      // Check Vertex AI service account credentials
      const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY;
      
      if (!clientEmail) {
        healthCheck.status = "error";
        healthCheck.errors.push("GOOGLE_CLIENT_EMAIL environment variable is not set");
        healthCheck.configuration.authentication = "NOT_CONFIGURED";
      } else if (!privateKey) {
        healthCheck.status = "error";
        healthCheck.errors.push("GOOGLE_PRIVATE_KEY environment variable is not set");
        healthCheck.configuration.authentication = "NOT_CONFIGURED";
      } else {
        healthCheck.configuration.authentication = "OAuth2 (Service Account)";
        healthCheck.configuration.serviceAccount = clientEmail;
      }
    } else {
      baseUrl = "https://generativelanguage.googleapis.com/v1/models/";
      healthCheck.configuration.baseUrl = baseUrl;
      
      // Check API key for Generative Language API
      const key = process.env.GEMINI_API_KEY;
      if (!key) {
        healthCheck.status = "error";
        healthCheck.errors.push("GEMINI_API_KEY environment variable is not set");
        healthCheck.configuration.authentication = "NOT_CONFIGURED";
      } else {
        healthCheck.configuration.authentication = "API Key";
        healthCheck.configuration.apiKey = `${key.substring(0, 10)}...${key.substring(key.length - 4)}`;
      }
    }

    // Check configured model
    const configuredModel = process.env.GEMINI_MODEL || "gemini-2.5-pro";
    healthCheck.configuration.model = configuredModel;

    // Test API connectivity if credentials are configured
    const isVertexConfigured = endpointType === "vertex" && process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY;
    const isGenLangConfigured = endpointType !== "vertex" && process.env.GEMINI_API_KEY;
    
    if (isVertexConfigured || isGenLangConfigured) {
      console.log("[Health Check] Testing API connectivity...");
      console.log("[Health Check] Endpoint type:", endpointType);
      console.log("[Health Check] Base URL:", baseUrl);

      try {
        // For Vertex AI, test direct model access; for Generative Language, list models
        if (endpointType === "vertex") {
          healthCheck.tests.modelListEndpoint = "N/A (Vertex AI)";
          healthCheck.warnings.push("Vertex AI does not support list models endpoint - testing direct model access instead");
          
          // Test with a simple prompt for Vertex AI using OAuth2
          const testUrl = `${baseUrl}${configuredModel}:streamGenerateContent`;
          const testBody = {
            contents: [{
              parts: [{ text: "Say 'OK' if you can read this." }]
            }],
            generationConfig: {
              maxOutputTokens: 10,
              temperature: 0.1
            }
          };

          console.log("[Health Check] Testing Vertex AI model access with OAuth2:", testUrl);
          
          let accessToken;
          try {
            accessToken = await getAccessToken();
            console.log("[Health Check] Successfully generated access token");
          } catch (authErr) {
            healthCheck.tests.vertexModelAccess = `AUTH_FAILED: ${authErr.message}`;
            healthCheck.tests.modelAvailable = false;
            healthCheck.errors.push(`Failed to generate access token: ${authErr.message}`);
            console.error("[Health Check] ❌ Access token generation failed:", authErr.message);
            
            // Don't continue with API test if auth failed
            if (healthCheck.errors.length === 0) {
              healthCheck.status = "warning";
            }
            return {
              statusCode: 200,
              headers: cors,
              body: JSON.stringify(healthCheck, null, 2)
            };
          }
          
          const testResp = await fetch(testUrl, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken}`
            },
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
          const key = process.env.GEMINI_API_KEY;
          const listUrl = `https://generativelanguage.googleapis.com/v1/models?key=${key}`;
          healthCheck.tests.modelListEndpoint = listUrl.replace(key, "***KEY_HIDDEN***");
          
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
      healthCheck.tests.apiConnectivity = "SKIPPED (authentication not configured)";
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
