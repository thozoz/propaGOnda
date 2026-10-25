// Cloudflare Pages Function: GET /api/truths

export async function onRequestGet(context) {
  const { env, request } = context;

  // 1. Try reading from KV if bound
  if (env.PROPAGONDA_KV) {
    try {
      const stored = await env.PROPAGONDA_KV.get("truths", { type: "json" });
      if (stored && Array.isArray(stored) && stored.length > 0) {
        return new Response(JSON.stringify(stored), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=60, s-maxage=60",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
    } catch (err) {
      console.error("KV read error:", err);
    }
  }

  // 2. Fallback: fetch bundled static data/truths.json
  const url = new URL(request.url);
  const fallbackUrl = `${url.origin}/data/truths.json`;
  const res = await env.ASSETS.fetch(fallbackUrl);
  const data = await res.json();

  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
