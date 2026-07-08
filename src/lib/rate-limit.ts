interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
}, 60_000)

export interface RateLimitConfig {
  windowMs: number
  max: number
}

export function rateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + config.windowMs })
    return { allowed: true, remaining: config.max - 1, resetMs: config.windowMs }
  }

  if (entry.count >= config.max) {
    const resetMs = entry.resetAt - now
    return { allowed: false, remaining: 0, resetMs }
  }

  entry.count++
  return { allowed: true, remaining: config.max - entry.count, resetMs: entry.resetAt - now }
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return '127.0.0.1'
}

export function rateLimitResponse(resetMs: number) {
  const retryAfter = Math.ceil(resetMs / 1000)
  return new Response(
    JSON.stringify({ error: `Слишком много запросов. Попробуйте через ${retryAfter} сек.` }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      },
    }
  )
}
