// Netlify Function: Gemini proxy with multi-origin CORS
exports.handler = async (event) => {
  // ALLOWED_ORIGIN can be comma-separated, e.g. "https://tfs2006.github.io,https://perfect-plate-app.netlify.app"
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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${endpoint}?key=${key}`;
    const resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const text = await resp.text();

    if (!resp.ok) return { statusCode: resp.status, headers: cors, body: text || JSON.stringify({ error: "Gemini API error" }) };
    return { statusCode: 200, headers: cors, body: text };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message || "Server error" }) };
  }
};