const Redis = require('ioredis');
require('dotenv').config();

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const redisClient = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

redisClient.on('connect', () => {
    console.log('Connected to Redis cache store');
});

redisClient.on('error', (err) => {
    console.error('Redis Connection Error:', err);
});

module.exports = redisClient;
