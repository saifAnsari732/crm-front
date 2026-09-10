/**
 * ─── LIGHTWEIGHT API CACHE SERVICE ────────────────────────────────────────
 * In-memory cache with TTL (Time-To-Live) for API responses.
 * Prevents redundant network calls when switching between screens.
 * 
 * Usage:
 *   import { cachedFetch, clearCache, clearCacheKey } from './cache';
 *   const data = await cachedFetch('dashboard', () => adminAPI.getDashboard(), 30);
 */

const _store = new Map();

/**
 * Get cached value if it exists and hasn't expired
 * @param {string} key - Cache key
 * @returns {any|null} - Cached value or null
 */
export function getCached(key) {
  const entry = _store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    _store.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Set a value in cache with TTL
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @param {number} ttlSeconds - Time to live in seconds (default 30s)
 */
export function setCache(key, data, ttlSeconds = 30) {
  _store.set(key, {
    data,
    expiry: Date.now() + (ttlSeconds * 1000),
    storedAt: Date.now(),
  });
}

/**
 * Fetch with cache — checks cache first, calls API only if expired/missing
 * @param {string} key - Unique cache key for this API call
 * @param {Function} fetchFn - The async function that makes the actual API call
 * @param {number} ttlSeconds - Cache duration in seconds (default 30)
 * @param {boolean} forceRefresh - Skip cache and force fresh fetch
 * @returns {Promise<any>} - API response (from cache or fresh)
 */
export async function cachedFetch(key, fetchFn, ttlSeconds = 30, forceRefresh = false) {
  if (!forceRefresh) {
    const cached = getCached(key);
    if (cached) {
      // console.log(`⚡ Cache HIT: ${key}`);
      return cached;
    }
  }

  // console.log(`🌐 Cache MISS: ${key} — fetching from server...`);
  const result = await fetchFn();
  setCache(key, result, ttlSeconds);
  return result;
}

/**
 * Clear a specific cache key
 * @param {string} key - Cache key to clear
 */
export function clearCacheKey(key) {
  _store.delete(key);
}

/**
 * Clear all cache entries matching a prefix
 * @param {string} prefix - Key prefix to match (e.g. 'admin_')
 */
export function clearCachePrefix(prefix) {
  for (const key of _store.keys()) {
    if (key.startsWith(prefix)) {
      _store.delete(key);
    }
  }
}

/**
 * Clear entire cache
 */
export function clearCache() {
  _store.clear();
}

/**
 * Get cache stats (for debugging)
 */
export function getCacheStats() {
  let active = 0;
  let expired = 0;
  const now = Date.now();
  for (const [, entry] of _store) {
    if (now > entry.expiry) expired++;
    else active++;
  }
  return { total: _store.size, active, expired };
}

export default {
  getCached,
  setCache,
  cachedFetch,
  clearCache,
  clearCacheKey,
  clearCachePrefix,
  getCacheStats,
};
