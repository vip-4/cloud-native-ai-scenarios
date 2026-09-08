export interface Env {
  LITELLM_API_KEY: string;
  LITELLM_API_BASE: string;
  ALLOWED_ORIGINS: string;
  RATE_LIMIT_MAX: string;
  RATE_LIMIT_WINDOW: string;
  __RATE_LIMIT?: any;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitKV {
  [key: string]: RateLimitEntry;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": env.ALLOWED_ORIGINS || "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Health check
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", timestamp: Date.now() }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": env.ALLOWED_ORIGINS || "*",
        },
      });
    }

    // API routes - forward to LiteLLM Proxy
    if (url.pathname.startsWith("/v1/")) {
      // Rate limiting
      const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
      const rateLimitKey = `ratelimit:${clientIP}`;

      try {
        const rateLimitData = (await env.__RATE_LIMIT.get(rateLimitKey, "json")) as RateLimitEntry | null;
        const now = Date.now();
        const windowMs = (parseInt(env.RATE_LIMIT_WINDOW || "60000") * 1000);

        if (rateLimitData && now < rateLimitData.resetTime) {
          if (rateLimitData.count >= parseInt(env.RATE_LIMIT_MAX || "100")) {
            return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "X-RateLimit-Limit": env.RATE_LIMIT_MAX || "100",
                "X-RateLimit-Remaining": "0",
                "Retry-After": Math.ceil((rateLimitData.resetTime - now) / 1000).toString(),
              },
            });
          }
          rateLimitData.count++;
        } else {
          await env.__RATE_LIMIT.put(rateLimitKey, JSON.stringify({
            count: 1,
            resetTime: now + windowMs,
          }), {
            expirationTtl: windowMs / 1000,
          });
        }
      } catch (e) {
        // Rate limit storage not configured, continue without rate limiting
      }

      // Forward request to LiteLLM Proxy
      const targetUrl = `${env.LITELLM_API_BASE || "http://localhost:4000"}${url.pathname}${url.search}`;

      try {
        const response = await fetch(targetUrl, {
          method: request.method,
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.LITELLM_API_KEY}`,
          },
          body: request.method !== "GET" && request.method !== "HEAD"
            ? await request.text()
            : undefined,
        });

        // Return response with CORS headers
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: {
            "Content-Type": response.headers.get("Content-Type") || "application/json",
            "Access-Control-Allow-Origin": env.ALLOWED_ORIGINS || "*",
            "Access-Control-Expose-Headers": "*",
          },
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: "Failed to connect to AI gateway",
          details: error instanceof Error ? error.message : "Unknown error",
        }), {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": env.ALLOWED_ORIGINS || "*",
          },
        });
      }
    }

    // Model list endpoint
    if (url.pathname === "/v1/models" || url.pathname === "/models") {
      const targetUrl = `${env.LITELLM_API_BASE || "http://localhost:4000"}${url.pathname}${url.search}`;

      try {
        const response = await fetch(targetUrl, {
          headers: {
            "Authorization": `Bearer ${env.LITELLM_API_KEY}`,
          },
        });

        return new Response(response.body, {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": env.ALLOWED_ORIGINS || "*",
          },
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: "Failed to fetch models",
          models: [
            { id: "kilo-auto", object: "model", created: Date.now(), owned_by: "freellmapi" },
            { id: "llama-3.3-70b-versatile", object: "model", created: Date.now(), owned_by: "groq" },
            { id: "gemini-2.0-flash-exp", object: "model", created: Date.now(), owned_by: "google" },
          ],
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": env.ALLOWED_ORIGINS || "*",
          },
        });
      }
    }

    return new Response("AI Edge Gateway - OK", {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": env.ALLOWED_ORIGINS || "*",
      },
    });
  },
};
