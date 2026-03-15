/**
 * Redis-backed cache middleware for Express
 * Fixes horizontal scalability issues by moving state out of Node.js memory
 */
const redisClient = require('../config/redisClient');

const CACHE_DURATION = {
  SHORT: 5 * 60,      // 5 minutes in seconds
  MEDIUM: 30 * 60,    // 30 minutes
  LONG: 60 * 60,      // 1 hour
  VERY_LONG: 24 * 60 * 60  // 24 hours
};

/**
 * Clear cache for a specific key or pattern
 */
const clearCache = async (keyPattern) => {
  try {
    if (keyPattern) {
      // Find all keys matching the pattern and delete them
      let cursor = '0';
      const maxBatchSize = 100;
      do {
        const result = await redisClient.scan(
          cursor,
          'MATCH',
          `*${keyPattern}*`,
          'COUNT',
          maxBatchSize
        );
        cursor = result[0];
        const keys = result[1];
        if (keys.length > 0) {
          await redisClient.del(keys);
        }
      } while (cursor !== '0');
    } else {
      // Very dangerous in production but kept for API compatibility: flush whole DB
      // Ideally should use a prefix like `cache:` and clear those instead.
      // await redisClient.flushdb();
    }
  } catch (error) {
    console.error('Redis Cache Clear Error:', error);
  }
};

/**
 * Caching middleware
 * @param {number} duration - Cache duration in seconds
 * @param {function} keyGenerator - Function to generate cache key from request
 */
const cacheMiddleware = (duration = CACHE_DURATION.MEDIUM, keyGenerator) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key
    const rawKey = keyGenerator ? keyGenerator(req) : `${req.originalUrl || req.url}_${req.user?._id || 'anonymous'}`;
    const key = `cache:${rawKey}`;

    try {
      // Check if cached response exists
      const cachedData = await redisClient.get(key);
      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }
    } catch (err) {
      console.error('Redis Get Error:', err);
      // Fallback to normal processing if Redis is down
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to cache the response
    res.json = (data) => {
      // Only cache successful responses
      if (data && data.success !== false) {
        redisClient.setex(key, duration, JSON.stringify(data)).catch((err) => {
          console.error('Redis Set Error:', err);
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
        // Execute invalidate async
        clearCache(keyPattern(req));
      }
      return originalJson(data);
    };

    next();
  };
};

/**
 * Get cache statistics directly from Redis Keyspace
 */
const getCacheStats = async () => {
  try {
    const info = await redisClient.info('keyspace');
    const db0 = info.split('\n').find(line => line.startsWith('db0:'));
    if (!db0) return { totalEntries: 0 };
    
    // Parse db0:keys=10,expires=10,avg_ttl=...
    const keysMatch = db0.match(/keys=(\d+)/);
    const totalEntries = keysMatch ? parseInt(keysMatch[1]) : 0;
    
    return {
      totalEntries,
      info: db0
    };
  } catch (error) {
    return { error: 'Could not fetch Redis stats' };
  }
};
module.exports = {
  cacheMiddleware,
  invalidateCacheMiddleware,
  clearCache,
  getCacheStats,
  CACHE_DURATION
};
