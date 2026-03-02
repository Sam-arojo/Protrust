/**
 * API Cache Utility
 * 
 * Caches API responses with TTL to prevent hammering database
 * during code generation operations.
 * 
 * Features:
 * - 30-second cache TTL
 * - Automatic refresh on expiry
 * - Handles 502 errors gracefully
 * - Returns cached data on error if available
 */

const CACHE_TTL = 30000; // 30 seconds in milliseconds

class ApiCache {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Generate cache key from URL and headers
   */
  getCacheKey(url, headers = {}) {
    // Include auth token in key to separate per-user caches
    const token = headers.Authorization || '';
    return `${url}_${token}`;
  }

  /**
   * Check if cached data is still valid
   */
  isValid(cacheEntry) {
    if (!cacheEntry) return false;
    const age = Date.now() - cacheEntry.timestamp;
    return age < CACHE_TTL;
  }

  /**
   * Get cached data if valid
   */
  get(url, headers) {
    const key = this.getCacheKey(url, headers);
    const entry = this.cache.get(key);
    
    if (this.isValid(entry)) {
      console.log(`[Cache HIT] ${url} (age: ${Math.round((Date.now() - entry.timestamp) / 1000)}s)`);
      return entry.data;
    }
    
    console.log(`[Cache MISS] ${url}`);
    return null;
  }

  /**
   * Store data in cache
   */
  set(url, headers, data) {
    const key = this.getCacheKey(url, headers);
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    console.log(`[Cache SET] ${url}`);
  }

  /**
   * Clear specific cache entry
   */
  clear(url, headers) {
    const key = this.getCacheKey(url, headers);
    this.cache.delete(key);
    console.log(`[Cache CLEAR] ${url}`);
  }

  /**
   * Clear all cache entries
   */
  clearAll() {
    this.cache.clear();
    console.log('[Cache CLEAR ALL]');
  }

  /**
   * Get cache age in seconds
   */
  getAge(url, headers) {
    const key = this.getCacheKey(url, headers);
    const entry = this.cache.get(key);
    if (!entry) return null;
    return Math.round((Date.now() - entry.timestamp) / 1000);
  }
}

// Singleton instance
const apiCache = new ApiCache();

/**
 * Cached fetch with automatic retry and fallback
 * 
 * @param {string} url - API endpoint URL
 * @param {object} options - Fetch options (headers, method, etc.)
 * @returns {Promise} - Fetch response
 */
export async function cachedFetch(url, options = {}) {
  const headers = options.headers || {};
  
  // Try to get from cache first
  const cached = apiCache.get(url, headers);
  if (cached) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(cached),
      fromCache: true
    });
  }

  try {
    // Make actual API call
    const response = await fetch(url, options);
    
    // Handle success
    if (response.ok) {
      const data = await response.json();
      apiCache.set(url, headers, data);
      return {
        ok: true,
        json: () => Promise.resolve(data),
        fromCache: false
      };
    }
    
    // Handle 502/503 errors (database overload)
    if (response.status === 502 || response.status === 503) {
      console.warn(`[API Error] ${response.status} on ${url} - Database may be busy`);
      
      // Try to return stale cache if available
      const staleCache = apiCache.cache.get(apiCache.getCacheKey(url, headers));
      if (staleCache) {
        console.log(`[Cache STALE] Returning old data for ${url}`);
        return {
          ok: true,
          json: () => Promise.resolve(staleCache.data),
          fromCache: true,
          stale: true
        };
      }
      
      // No cache available, throw error
      throw new Error(`Database temporarily unavailable (${response.status})`);
    }
    
    // Handle other errors
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    
  } catch (error) {
    console.error(`[API Error] ${url}:`, error.message);
    
    // Try to return any cached data (even expired) as fallback
    const fallbackCache = apiCache.cache.get(apiCache.getCacheKey(url, headers));
    if (fallbackCache) {
      console.log(`[Cache FALLBACK] Returning expired data for ${url}`);
      return {
        ok: true,
        json: () => Promise.resolve(fallbackCache.data),
        fromCache: true,
        stale: true,
        error: error.message
      };
    }
    
    // No cache at all, throw error
    throw error;
  }
}

/**
 * Clear cache for specific URL
 */
export function clearCache(url, headers) {
  apiCache.clear(url, headers);
}

/**
 * Clear all cached data
 */
export function clearAllCache() {
  apiCache.clearAll();
}

/**
 * Get cache age for URL
 */
export function getCacheAge(url, headers) {
  return apiCache.getAge(url, headers);
}

export default cachedFetch;
