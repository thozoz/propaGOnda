// Cloudflare Worker entry point with Static Assets & KV
import defaultTruths from "../public/data/truths.json";

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      // 1. GET /api/truths
      if (url.pathname === "/api/truths" && request.method === "GET") {
        if (env.PROPAGONDA_KV) {
          try {
            const stored = await env.PROPAGONDA_KV.get("truths", { type: "json" });
            if (Array.isArray(stored) && stored.length > 0) {
              return new Response(JSON.stringify(stored), {
                headers: {
                  "Content-Type": "application/json",
                  "Cache-Control": "public, max-age=60",
                  "Access-Control-Allow-Origin": "*"
                }
              });
            }
          } catch (err) {
            console.error("KV read error:", err);
          }
        }

        // Fast fallback to bundled truths
        return new Response(JSON.stringify(defaultTruths), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=60",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }

      // 2. POST /api/webhook/truth (n8n integration)
      if (url.pathname === "/api/webhook/truth") {
        if (request.method === "OPTIONS") {
          return new Response(null, {
            status: 204,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "POST, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization"
            }
          });
        }

        if (request.method === "POST") {
          const expectedKey = env.PROPAGONDA_API_KEY || "propagonda-secret-2026";
          const apiKey = request.headers.get("X-API-Key") ||
                         (request.headers.get("Authorization") || "").replace(/^Bearer\s+/, "");

          if (apiKey !== expectedKey) {
            return new Response(JSON.stringify({ error: "Unauthorized: Invalid API key" }), {
              status: 401,
              headers: { "Content-Type": "application/json" }
            });
          }

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

          let currentTruths = [];
          if (env.PROPAGONDA_KV) {
            try {
              const stored = await env.PROPAGONDA_KV.get("truths", { type: "json" });
              if (Array.isArray(stored)) {
                currentTruths = stored;
              }
            } catch (e) {
              console.error("KV error:", e);
            }
          }

          if (currentTruths.length === 0) {
            currentTruths = defaultTruths;
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

          const updatedTruths = [newTruth, ...currentTruths];

          if (env.PROPAGONDA_KV) {
            await env.PROPAGONDA_KV.put("truths", JSON.stringify(updatedTruths));
          }

          return new Response(JSON.stringify({
            status: "success",
            message: "Decree promulgated successfully",
            decree: newTruth
          }), {
            status: 201,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          });
        }

        return new Response("Method not allowed", { status: 405 });
      }

      // 3. Fallback: static assets
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }
      return new Response("Not found", { status: 404 });
    } catch (globalErr) {
      return new Response(JSON.stringify({ error: globalErr.message, stack: globalErr.stack }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
