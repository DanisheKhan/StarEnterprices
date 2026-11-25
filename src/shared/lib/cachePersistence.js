/**
 * Persistent Client-Side Cache Engine for Star Enterprises
 * Provides instantaneous (0ms) data hydration via an in-memory mirror + non-blocking
 * localStorage persistence via requestIdleCallback.
 */

const CACHE_VERSION = 'v3';
const PREFIX = `star_cache_${CACHE_VERSION}_`;
const LEGACY_CLEANUP_KEY = 'star_cache_v3_migrated';
const memoryCache = new Map();
const pendingWrites = new Map();

// One-time purge of legacy localStorage caches from pre-handoff demo runs
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  try {
    if (!localStorage.getItem(LEGACY_CLEANUP_KEY)) {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (
          k &&
          (k.startsWith('star_cache_v2_') ||
            (k.startsWith('star_inv_prods_') && !k.startsWith('star_inv_prods_v3_')) ||
            k === 'star_stores_cache_v3' ||
            k === 'star_public_catalog_cache_v2')
        ) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(LEGACY_CLEANUP_KEY, '1');
    }
  } catch {
    // Ignore storage access errors in restricted modes
  }
}

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
