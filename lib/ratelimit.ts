/**
 * Simple in-memory rate limiter (per server instance).
 * Good for a single-VPS launch; swap for a Redis-backed limiter when scaling out.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// periodic cleanup so the map doesn't grow forever
setInterval(() => {
  const now = Date.now();
  buckets.forEach((b, k) => {
    if (b.resetAt < now) buckets.delete(k);
  });
}, 60_000).unref?.();

/** Returns true if the action is allowed, false if rate-limited. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= max;
}

/** Clear a bucket (e.g. after a successful login, so honest users aren't punished). */
export function rateLimitReset(key: string) {
  buckets.delete(key);
}

/** Best-effort client IP (works behind nginx/cloudflare with forwarding configured). */
export function clientIp(req: Request): string {
  const h = (name: string) => (req.headers.get(name) || "").split(",")[0].trim();
  return h("cf-connecting-ip") || h("x-real-ip") || h("x-forwarded-for") || "unknown";
}
