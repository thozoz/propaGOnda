// Cloudflare Pages Function: POST /api/webhook/truth

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization"
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. Authenticate with API key
  const expectedKey = env.PROPAGONDA_API_KEY || "propagonda-secret-2026";
  const apiKey = request.headers.get("X-API-Key") ||
                 (request.headers.get("Authorization") || "").replace(/^Bearer\s+/, "");

  if (apiKey !== expectedKey) {
    return new Response(JSON.stringify({ error: "Unauthorized: Invalid API key" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  // 2. Parse JSON body
  let payload;
  try {
    payload = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!payload.quote || !payload.quote.trim()) {
    return new Response(JSON.stringify({ error: "quote field is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  // 3. Fetch existing truths list
  let currentTruths = [];
  if (env.PROPAGONDA_KV) {
    try {
      const stored = await env.PROPAGONDA_KV.get("truths", { type: "json" });
      if (Array.isArray(stored)) {
        currentTruths = stored;
      }
    } catch (e) {
      console.error("KV read error:", e);
    }
  }

  // If KV was empty, seed with bundled static json
  if (currentTruths.length === 0) {
    try {
      const url = new URL(request.url);
      const fallbackUrl = `${url.origin}/data/truths.json`;
      const res = await env.ASSETS.fetch(fallbackUrl);
      currentTruths = await res.json();
    } catch (e) {
      currentTruths = [];
    }
  }

  const now = new Date();
  const dateStr = payload.date || now.toISOString().split("T")[0];
  const target = payload.target || "all";
  const targetName = payload.target_name || (target.charAt(0).toUpperCase() + target.slice(1));
  const decreeNumber = payload.decree_number || (currentTruths.length + 101);

  const newTruth = {
    id: payload.id || String(Date.now()),
    slug: payload.slug || `decree-${decreeNumber}`,
    title: payload.title || `Decree #${decreeNumber}: Daily Truth`,
    quote: payload.quote.trim(),
    target: target.toLowerCase(),
    target_name: targetName,
    date: dateStr,
    decree_number: decreeNumber
  };

  // Prepend new truth
  const updatedTruths = [newTruth, ...currentTruths];

  // 4. Save to Cloudflare KV
  if (env.PROPAGONDA_KV) {
    await env.PROPAGONDA_KV.put("truths", JSON.stringify(updatedTruths));
  }

  return new Response(JSON.stringify({
    status: "success",
    message: "Decree promulgated successfully to Cloudflare Edge",
    decree: newTruth
  }), {
    status: 201,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
