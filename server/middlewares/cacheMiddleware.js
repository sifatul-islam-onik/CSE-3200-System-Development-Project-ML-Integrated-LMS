/**
 * Simple in-memory cache middleware for Express
 * For production, consider using Redis for distributed caching
 */

const cache = new Map();
const CACHE_DURATION = {
  SHORT: 5 * 60 * 1000,      // 5 minutes
  MEDIUM: 30 * 60 * 1000,    // 30 minutes
  LONG: 60 * 60 * 1000,      // 1 hour
  VERY_LONG: 24 * 60 * 60 * 1000  // 24 hours
};

// VULN-15: Cap the cache to prevent unbounded memory growth
const MAX_CACHE_SIZE = 1000;

/**
 * Clear cache for a specific key or pattern
 */
const clearCache = (keyPattern) => {
  if (keyPattern) {
    // Clear keys matching pattern
    for (const key of cache.keys()) {
      if (key.includes(keyPattern)) {
        cache.delete(key);
      }
    }
  } else {
    // Clear all cache
    cache.clear();
  }
};

/**
 * Caching middleware
 * @param {number} duration - Cache duration in milliseconds
 * @param {function} keyGenerator - Function to generate cache key from request
 */
const cacheMiddleware = (duration = CACHE_DURATION.MEDIUM, keyGenerator) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key
    const key = keyGenerator ? keyGenerator(req) : `${req.originalUrl || req.url}_${req.user?._id || 'anonymous'}`;
    
    // Check if cached response exists and is still valid
    const cachedResponse = cache.get(key);
    if (cachedResponse && Date.now() < cachedResponse.expiry) {
      return res.json(cachedResponse.data);
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to cache the response
    res.json = (data) => {
      // Only cache successful responses
      if (data && data.success !== false) {
        // VULN-15: Evict oldest entry (FIFO) when cache is at its cap
        if (cache.size >= MAX_CACHE_SIZE) {
          const oldestKey = cache.keys().next().value;
          cache.delete(oldestKey);
        }
        cache.set(key, {
          data,
          expiry: Date.now() + duration
        });
      }
      return originalJson(data);
    };

    next();
  };
};

/**
 * Middleware to invalidate cache on mutations
 */
const invalidateCacheMiddleware = (keyPattern) => {
  return (req, res, next) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to clear cache after successful mutation
    res.json = (data) => {
      if (data && data.success !== false) {
        clearCache(keyPattern(req));
      }
      return originalJson(data);
    };

    next();
  };
};

/**
 * Get cache statistics
 */
const getCacheStats = () => {
  const now = Date.now();
  let validEntries = 0;
  let expiredEntries = 0;
  let totalSize = 0;

  for (const [key, value] of cache.entries()) {
    totalSize += JSON.stringify(value.data).length;
    if (now < value.expiry) {
      validEntries++;
    } else {
      expiredEntries++;
    }
  }

  return {
    totalEntries: cache.size,
    validEntries,
    expiredEntries,
    estimatedSizeBytes: totalSize,
    estimatedSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
  };
};

/**
 * Clean expired entries periodically
 */
const cleanupExpiredCache = () => {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, value] of cache.entries()) {
    if (now >= value.expiry) {
      cache.delete(key);
      cleaned++;
    }
  }

};

// Run cleanup every 10 minutes
setInterval(cleanupExpiredCache, 10 * 60 * 1000);

module.exports = {
  cacheMiddleware,
  invalidateCacheMiddleware,
  clearCache,
  getCacheStats,
  CACHE_DURATION
};
