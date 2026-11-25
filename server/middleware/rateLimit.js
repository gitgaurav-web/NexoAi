/**
 * In-Memory Sliding Window Rate Limiter
 * Limits incoming requests per IP address to protect backend resources.
 * Renders IP resolution safe against client header spoofing by relying on Express trusted proxy configuration.
 */

export function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 60 * 1000; // 1 minute default
  const maxRequests = options.max || 60; // 60 requests per minute default
  const ipHits = new Map();

  // Cleanup expired entries periodically to prevent memory growth
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of ipHits.entries()) {
      if (now - data.startTime > windowMs) {
        ipHits.delete(ip);
      }
    }
  }, Math.max(windowMs, 30000));

  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  const middleware = function rateLimitMiddleware(req, res, next) {
    // Rely exclusively on Express req.ip (which obeys app.set('trust proxy'))
    // Never read raw untrusted X-Forwarded-For header directly.
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';

    const now = Date.now();
    let clientData = ipHits.get(ip);

    if (!clientData || (now - clientData.startTime) > windowMs) {
      clientData = {
        count: 1,
        startTime: now
      };
      ipHits.set(ip, clientData);
    } else {
      clientData.count += 1;
    }

    const remaining = Math.max(0, maxRequests - clientData.count);
    const resetTimeSeconds = Math.ceil((clientData.startTime + windowMs - now) / 1000);

    // Standard draft and legacy rate-limit headers
    res.setHeader('RateLimit-Limit', maxRequests);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', resetTimeSeconds);
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTimeSeconds);

    if (clientData.count > maxRequests) {
      res.setHeader('Retry-After', resetTimeSeconds);
      return res.status(429).json({
        error: 'Too many requests. Please wait a moment before sending another message.',
        retryAfter: resetTimeSeconds
      });
    }

    next();
  };

  // Helper for testing
  middleware.reset = () => {
    ipHits.clear();
  };

  return middleware;
}
