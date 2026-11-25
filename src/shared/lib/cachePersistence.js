/**
 * Persistent Client-Side Cache Engine for Star Enterprises
 * Provides instantaneous (0ms) data hydration via an in-memory mirror + non-blocking
 * localStorage persistence via requestIdleCallback.
 */

const CACHE_VERSION = 'v2';
const PREFIX = `star_cache_${CACHE_VERSION}_`;
const memoryCache = new Map();
const pendingWrites = new Map();

function scheduleIdleWrite(storageKey, serialized) {
  pendingWrites.set(storageKey, serialized);
  if (pendingWrites.size > 1) return;

  const flush = () => {
    for (const [k, val] of pendingWrites.entries()) {
      try {
        localStorage.setItem(k, val);
      } catch (err) {
        console.warn(`[Cache] Failed to write cache key ${k}:`, err);
      }
    }
    pendingWrites.clear();
  };

  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(flush, { timeout: 500 });
  } else {
    setTimeout(flush, 0);
  }
}

/**
 * Safely writes an item to the in-memory cache immediately and defers localStorage serialization
 */
export function setPersistentCache(key, value) {
  const storageKey = `${PREFIX}${key}`;
  const entry = {
    data: value,
    timestamp: Date.now(),
  };
  memoryCache.set(storageKey, entry);

  try {
    const serialized = JSON.stringify(entry);
    scheduleIdleWrite(storageKey, serialized);
  } catch (err) {
    console.warn(`[Cache] Failed to serialize cache key ${key}:`, err);
  }
}

/**
 * Safely reads an item from in-memory cache or localStorage
 */
export function getPersistentCache(key, maxAgeMs = 1000 * 60 * 60 * 24) {
  const storageKey = `${PREFIX}${key}`;

  const mem = memoryCache.get(storageKey);
  if (mem) {
    if (Date.now() - mem.timestamp <= maxAgeMs) {
      return mem.data;
    }
    memoryCache.delete(storageKey);
  }

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.data) return null;
    if (Date.now() - parsed.timestamp > maxAgeMs) {
      return null;
    }
    memoryCache.set(storageKey, parsed);
    return parsed.data;
  } catch (err) {
    console.warn(`[Cache] Failed to read cache key ${key}:`, err);
    return null;
  }
}

/**
 * Returns instantaneous cached dashboard metrics from localStorage if previously fetched.
 */
export function getCachedDashboardData(dateRange = 'month', storeCode = 'all') {
  const cacheKey = `dashboard_${dateRange}_${storeCode}`;
  return getPersistentCache(cacheKey);
}

/**
 * Writes fresh live dashboard data from Supabase to persistent cache
 */
export function setCachedDashboardData(dateRange, storeCode, data) {
  if (!data) return;
  const cacheKey = `dashboard_${dateRange}_${storeCode}`;
  setPersistentCache(cacheKey, data);
}
