// Small in-memory fixed-window limiter. On serverless it is per-instance (best effort), which is
// adequate for a single-user app: it stops runaway loops and password guessing bursts.
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return { ok: true, remaining: limit - 1 };
  }
  b.count++;
  return { ok: b.count <= limit, remaining: Math.max(0, limit - b.count) };
}
