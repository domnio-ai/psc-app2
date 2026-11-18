import crypto from 'node:crypto'

export const createAuthRateLimiter = ({
  windowMs = 15 * 60 * 1000,
  maxIpAttempts = 100,
  maxIdentityAttempts = 10,
  now = Date.now,
} = {}) => {
  const buckets = new Map()

  return (req, res, next) => {
    const current = now()
    const ip = String(req.ip || req.socket?.remoteAddress || 'unknown')
    const identityValue = typeof req.body?.email === 'string'
      ? req.body.email.trim().toLowerCase()
      : typeof req.body?.token === 'string'
        ? req.body.token.trim()
        : ''
    const identityKey = identityValue
      ? `identity:${crypto.createHash('sha256').update(identityValue).digest('hex')}`
      : null
    const checks = [
      { key: `ip:${ip}`, limit: maxIpAttempts },
      ...(identityKey ? [{ key: identityKey, limit: maxIdentityAttempts }] : []),
    ].map(({ key, limit }) => {
      const timestamps = (buckets.get(key) || [])
        .filter(timestamp => current - timestamp < windowMs)
      const blocked = timestamps.length >= limit
      const retryAfterSeconds = blocked
        ? Math.max(1, Math.ceil((windowMs - (current - timestamps[0])) / 1000))
        : 0
      return { key, timestamps, blocked, retryAfterSeconds }
    })

    const blocked = checks.filter(check => check.blocked)
    if (blocked.length) {
      const retryAfterSeconds = Math.max(...blocked.map(check => check.retryAfterSeconds))
      res.setHeader('Retry-After', String(retryAfterSeconds))
      return res.status(429).json({
        error: 'Too many authentication requests. Wait before trying again.',
      })
    }

    for (const check of checks) {
      buckets.set(check.key, [...check.timestamps, current])
    }

    if (buckets.size > 5000) {
      for (const [key, timestamps] of buckets) {
        const active = timestamps.filter(timestamp => current - timestamp < windowMs)
        if (active.length) buckets.set(key, active)
        else buckets.delete(key)
      }
    }

    return next()
  }
}
