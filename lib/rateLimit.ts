/**
 * In-memory sliding-window rate limiter.
 *
 * ⚠️  State is per-process. On multi-instance deployments (e.g. Vercel with
 * concurrent serverless functions) this limits per-instance, not globally.
 * To enforce global limits, replace with @upstash/ratelimit backed by
 * Vercel KV (add UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN env vars).
 *
 * For the current MVP (low traffic, single region) this is sufficient.
 */

interface Bucket {
  timestamps: number[]
}

const store = new Map<string, Bucket>()

/**
 * Returns true if the request is within limits, false if it should be blocked.
 * @param key      Unique identifier (e.g. "ip:1.2.3.4" or "phone:+447...")
 * @param limit    Max requests allowed in the window
 * @param windowMs Window size in milliseconds
 */
export function isAllowed(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const cutoff = now - windowMs

  const bucket = store.get(key) ?? { timestamps: [] }

  // Prune timestamps outside the window
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff)

  if (bucket.timestamps.length >= limit) {
    store.set(key, bucket)
    return false // rate limited
  }

  bucket.timestamps.push(now)
  store.set(key, bucket)
  return true // allowed
}

/** Extract the best available client IP from Next.js request headers */
export function getClientIp(req: Request): string {
  const headers = req instanceof Request ? req.headers : (req as never as { headers: Headers }).headers
  return (
    (headers as Headers).get('x-real-ip') ??
    (headers as Headers).get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}
