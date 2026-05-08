const memoryStore = new Map();
let redisClient = null;
let redisReady = false;

const hasRedis = () => !!process.env.REDIS_URL;

const ensureRedis = async () => {
  if (!hasRedis()) return null;
  if (redisClient) return redisClient;

  try {
    // Optional dependency: works when the redis package is installed.
    const { createClient } = require("redis");
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on("error", (err) => {
      redisReady = false;
      console.error("[REDIS ERROR]", err.message);
    });
    await redisClient.connect();
    redisReady = true;
    console.log("[REDIS] Cache connected");
    return redisClient;
  } catch (err) {
    console.warn("[CACHE] Redis unavailable, using in-memory cache:", err.message);
    redisClient = null;
    redisReady = false;
    return null;
  }
};

const now = () => Date.now();

const getCache = async (key) => {
  const client = await ensureRedis();
  if (client && redisReady) {
    const raw = await client.get(key);
    return raw ? JSON.parse(raw) : null;
  }

  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt <= now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
};

const setCache = async (key, value, ttlSeconds = 60) => {
  const client = await ensureRedis();
  if (client && redisReady) {
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    return;
  }

  memoryStore.set(key, {
    value,
    expiresAt: ttlSeconds ? now() + ttlSeconds * 1000 : null,
  });
};

const delCache = async (...keys) => {
  const client = await ensureRedis();
  if (client && redisReady) {
    if (keys.length) await client.del(keys);
    return;
  }

  keys.forEach((key) => memoryStore.delete(key));
};

const clearPattern = async (prefix) => {
  const client = await ensureRedis();
  if (client && redisReady) {
    const keys = await client.keys(`${prefix}*`);
    if (keys.length) await client.del(keys);
    return;
  }

  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) memoryStore.delete(key);
  }
};

module.exports = { getCache, setCache, delCache, clearPattern };
