const redisClient = require('../config/redisClient');

const CACHE_DURATION = {
  SHORT: 5 * 60,      // 5 minutes in seconds
  MEDIUM: 30 * 60,    // 30 minutes
  LONG: 60 * 60,      // 1 hour
  VERY_LONG: 24 * 60 * 60  // 24 hours
};

const clearCache = async (keyPattern) => {
  try {
    if (keyPattern) {
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
    }
  } catch (error) {
    console.error('Redis Cache Clear Error:', error);
  }
};

const cacheMiddleware = (duration = CACHE_DURATION.MEDIUM, keyGenerator) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    const rawKey = keyGenerator ? keyGenerator(req) : `${req.originalUrl || req.url}_${req.user?._id || 'anonymous'}`;
    const key = `cache:${rawKey}`;

    try {
      const cachedData = await redisClient.get(key);
      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }
    } catch (err) {
      console.error('Redis Get Error:', err);
    }

    const originalJson = res.json.bind(res);

    res.json = (data) => {
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

const invalidateCacheMiddleware = (keyPattern) => {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = (data) => {
      if (data && data.success !== false) {
        clearCache(keyPattern(req));
      }
      return originalJson(data);
    };

    next();
  };
};

const getCacheStats = async () => {
  try {
    const info = await redisClient.info('keyspace');
    const db0 = info.split('\n').find(line => line.startsWith('db0:'));
    if (!db0) return { totalEntries: 0 };
    
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
