// Public endpoint: GET /api/payment-metadata?bin=449163
// Server-side only lookup, provider abstraction, in-memory cache,
// best-effort per-IP rate limiting, audit logging on hits.
//
// Returns only metadata required for display + risk analysis. Never
// echoes full PANs, CVVs, PINs, or any sensitive credential. Callers
// must send only the 6–8 digit IIN prefix.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const querySchema = z.object({
  bin: z.string().trim().regex(/^\d{6,8}$/, "bin must be 6–8 digits"),
});

function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export const Route = createFileRoute("/api/payment-metadata")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const parsed = querySchema.safeParse({ bin: url.searchParams.get("bin") ?? "" });
          if (!parsed.success) {
            return Response.json(
              { error: parsed.error.issues[0]?.message ?? "Invalid bin" },
              { status: 400 },
            );
          }
          const bin = parsed.data.bin.slice(0, 6); // normalize to 6-digit IIN

          const { consumeToken, lookupWithFailover } = await import("@/lib/payment-metadata/providers.server");
          const ip = clientIp(request);
          if (!consumeToken(ip)) {
            return Response.json(
              { error: "Rate limit exceeded" },
              { status: 429, headers: { "retry-after": "60" } },
            );
          }

          const result = await lookupWithFailover(bin);
          return Response.json(
            { bin, metadata: result },
            { headers: { "cache-control": "public, max-age=3600" } },
          );
        } catch (err) {
          console.error("[/api/payment-metadata] error:", err);
          return Response.json({ error: "Lookup failed" }, { status: 500 });
        }
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, OPTIONS",
            "access-control-allow-headers": "content-type",
            "access-control-max-age": "86400",
          },
        }),
    },
  },
});
