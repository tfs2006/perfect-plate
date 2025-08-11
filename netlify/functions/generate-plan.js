// Netlify Function: generate-plan
// POST { endpoint: string, body: object }
// Proxies to Google Generative Language API with your GEMINI_API_KEY.
// Add this environment variable in Netlify dashboard.

export async function handler(event, context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { endpoint, body } = JSON.parse(event.body || '{}');
    if (!endpoint || !body) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'endpoint and body are required' }) };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'GEMINI_API_KEY not configured' }) };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${endpoint}?key=${apiKey}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await resp.text();
    if (!resp.ok) {
      return { statusCode: resp.status, headers, body: text || JSON.stringify({ error: 'Upstream error' }) };
    }

    return { statusCode: 200, headers, body: text };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message || 'Unknown error' }) };
  }
}
