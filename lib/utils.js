const tls = require('tls');
const url = require('url');
const ConnectionPool = require('./connection-pool');
const RetryManager = require('./retry-manager');
const CacheManager = require('./cache-manager');
const debug = require('debug')('banking:utils');

// Constants
const STRINGIFY_SPACE = 2;
const HTTPS_PORT = 443;
const HTTP_PORT = 80;

/**
 * Unique Id Generator
 *
 * @param {number} length
 * @return {string} radix
 * @return {string} uuid
 * @api private
 */

const Util = (module.exports = {});

// Global connection pool instance
let globalPool = null;
// Global retry manager instance
let globalRetryManager = null;
// Global cache manager instance
let globalCacheManager = null;

/**
 * Configure connection pooling and retry settings for banking operations
 * @param {object} config - Combined pool and retry configuration options
 * @param {object} config.pool - Connection pool specific settings
 * @param {object} config.retry - Retry manager specific settings
 * @param {object} config.timeouts - Operation-specific timeout configurations
 * @returns {object} Applied configuration
 */
Util.configurePool = function (config) {
  debug('Configuring connection pool with config:', JSON.stringify(config, null, STRINGIFY_SPACE));

  if (globalPool) {
    globalPool.destroy();
  }

  // Handle both old and new API formats
  let poolConfig;
  if (config && (config.pool || config.retry || config.timeouts)) {
    // New API format with structured config
    poolConfig = Object.assign({}, config.pool || {});
    if (config.retry) {
      poolConfig.retryManager = config.retry;
    }
    if (config.timeouts) {
      poolConfig.timeouts = config.timeouts;
    }
  } else {
    // Old API format - direct pool config
    poolConfig = Object.assign({}, config || {});
  }

  globalPool = new ConnectionPool(poolConfig);

  // Return appropriate format based on input
  if (config && (config.pool || config.retry || config.timeouts)) {
    return {
      pool: globalPool.config,
      retry: globalPool.retryManager ? globalPool.retryManager.config : null
    };
  } else {
    // Backward compatibility - return the pool config directly
    return globalPool.config;
  }
};

/**
 * Configure retry policies for banking operations
 * @param {object} config - Retry configuration options
 * @returns {object} Applied retry configuration
 */
Util.configureRetry = function (config) {
  debug('Configuring retry manager with config:', JSON.stringify(config, null, STRINGIFY_SPACE));

  if (globalRetryManager) {
    globalRetryManager.resetMetrics();
  }

  globalRetryManager = new RetryManager(config);

  // If pool exists, update its retry manager
  if (globalPool) {
    globalPool.retryManager = globalRetryManager;
  }

  return globalRetryManager.config;
};

/**
 * Configure timeout settings for different operation types
 * @param {object} timeouts - Timeout configuration by operation type
 * @returns {object} Applied timeout configuration
 */
Util.configureTimeouts = function (timeouts) {
  debug('Configuring timeouts:', JSON.stringify(timeouts, null, STRINGIFY_SPACE));

  if (!globalPool) {
    globalPool = new ConnectionPool();
  }

  // Update timeout configuration
  Object.assign(globalPool.config.timeouts, timeouts);

  return globalPool.config.timeouts;
};

/**
 * Get connection pool metrics including retry metrics
 * @returns {object} Current pool metrics
 */
Util.getPoolMetrics = function () {
  if (!globalPool) return null;
  return globalPool.getMetrics();
};

/**
 * Get retry metrics
 * @returns {object} Current retry metrics or null
 */
Util.getRetryMetrics = function () {
  if (globalPool && globalPool.retryManager) {
    return globalPool.retryManager.getMetrics();
  }
  if (globalRetryManager) {
    return globalRetryManager.getMetrics();
  }
  return null;
};

/**
 * Reset retry metrics
 */
Util.resetRetryMetrics = function () {
  if (globalPool && globalPool.retryManager) {
    globalPool.retryManager.resetMetrics();
  }
  if (globalRetryManager) {
    globalRetryManager.resetMetrics();
  }
};

/**
 * Configure caching for banking operations
 * @param {object} config - Cache configuration options
 * @returns {object} Applied cache configuration
 */
Util.configureCache = function (config) {
  debug('Configuring cache manager with config:', JSON.stringify(config, null, STRINGIFY_SPACE));

  if (globalCacheManager) {
    globalCacheManager.destroy();
  }

  globalCacheManager = new CacheManager(config);
  return globalCacheManager.config;
};

/**
 * Get cache metrics and statistics
 * @returns {object} Current cache metrics or null if caching is not enabled
 */
Util.getCacheMetrics = function () {
  if (!globalCacheManager) return null;
  return globalCacheManager.getMetrics();
};

/**
 * Reset cache metrics (useful for testing or monitoring)
 */
Util.resetCacheMetrics = function () {
  if (globalCacheManager) {
    globalCacheManager.resetMetrics();
  }
};

/**
 * Clear all cached data
 * @returns {number} Number of entries cleared
 */
Util.clearCache = function () {
  if (!globalCacheManager) return 0;
  return globalCacheManager.clear();
};

/**
 * Invalidate cache entries for specific operation
 * @param {string} operation - Operation type to invalidate
 * @param {object} [params] - Specific parameters to invalidate (optional)
 * @returns {number} Number of entries invalidated
 */
Util.invalidateCache = function (operation, params = null) {
  if (!globalCacheManager) return 0;
  return globalCacheManager.invalidate(operation, params);
};

/**
 * Destroy the connection pool, retry manager, and cache manager, clean up resources
 */
Util.destroyPool = function () {
  if (globalPool) {
    globalPool.destroy();
    globalPool = null;
  }
  if (globalRetryManager) {
    globalRetryManager.resetMetrics();
    globalRetryManager = null;
  }
  if (globalCacheManager) {
    globalCacheManager.destroy();
    globalCacheManager = null;
  }
};

/**
 * Get or create the global connection pool
 * @returns {ConnectionPool} The global pool instance
 */
function getPool() {
  if (!globalPool) {
    debug('Creating default connection pool');
    globalPool = new ConnectionPool();
  }
  return globalPool;
}

/**
 * Get or create the global cache manager
 * @returns {CacheManager} The global cache manager instance
 */
function getCacheManager() {
  if (!globalCacheManager) {
    debug('Creating default cache manager');
    globalCacheManager = new CacheManager();
  }
  return globalCacheManager;
}

Util.uuid = function (len, radix) {
  const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
  const chars = CHARS,
    uuid = [];
  radix = radix || chars.length;

  if (len) {
    for (let i = 0; i < len; i++) uuid[i] = chars[0 | (Math.random() * radix)];
  } else {
    let r;
    uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
    uuid[14] = '4';

    for (let j = 0; j < 36; j++) {
      if (!uuid[j]) {
        r = 0 | (Math.random() * 16);
        uuid[j] = chars[j === 19 ? (r & 0x3) | 0x8 : r];
      }
    }
  }

  return uuid.join('');
};

/**
 * [mixin description]
 * @param  {[type]} base [description]
 * @param  {[type]} obj  [description]
 * @return {[type]}      [description]
 */

Util.mixin = function (base, obj) {
  for (const key in base) {
    obj[key] = obj[key] ? obj[key] : base[key];
  }
  return obj;
};

/**
 * Makes a secure request to an ofx server and posts an OFX payload
 * Uses connection pooling with advanced timeout and retry logic, plus caching
 * @param options - Request options including url, headers, operationType, etc.
 * @param ofxPayload - OFX payload to send
 * @param cb - Callback function (error, response)
 */
Util.request = function (options, ofxPayload, cb) {
  // Check if caching should be used
  const useCache = options.useCache !== false; // Default to true unless explicitly disabled
  const cacheOperation = options.cacheOperation || 'statement';
  const cacheParams = options.cacheParams || {};

  // Check if connection pooling should be used
  const usePooling = options.usePooling !== false; // Default to true unless explicitly disabled

  debug('Making request with options:', {
    url: options.url,
    operationType: options.operationType,
    usePooling: usePooling,
    useCache: useCache,
    cacheOperation: cacheOperation
  });

  // Try to get cached response first
  if (useCache) {
    const cacheManager = getCacheManager();
    const cachedResponse = cacheManager.get(cacheOperation, cacheParams);

    if (cachedResponse) {
      debug('Returning cached response for operation:', cacheOperation);
      return process.nextTick(() => cb(null, cachedResponse));
    }
  }

  // Make the actual request
  const performRequest = (err, response) => {
    if (err) return cb(err, response);

    // Cache the successful response
    if (useCache && response) {
      try {
        const cacheManager = getCacheManager();
        cacheManager.set(cacheOperation, cacheParams, response);
        debug('Cached response for operation:', cacheOperation);
      } catch (cacheError) {
        debug('Cache set error (non-fatal):', cacheError.message);
        // Cache errors are non-fatal, continue with the response
      }
    }

    cb(err, response);
  };

  if (usePooling) {
    // Use connection pooling for better performance with retry logic
    const pool = getPool();
    pool.request(options, ofxPayload, performRequest);
  } else {
    // Fall back to legacy TLS socket implementation
    Util.requestLegacy(options, ofxPayload, performRequest);
  }
};

/**
 * Legacy TLS socket implementation (for backward compatibility)
 * @param options
 * @param ofxPayload
 * @param cb
 */
Util.requestLegacy = function (options, ofxPayload, cb) {
  const parsedUrl = url.parse(options.url);
  const tlsOpts = {
    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? HTTPS_PORT : HTTP_PORT),
    host: parsedUrl.hostname
  };
  const socket = tls.connect(tlsOpts, () => {
    let buffer = `POST ${parsedUrl.path} HTTP/1.1\r\n`;
    options.headers.forEach(header => {
      let value;
      if (options[header]) {
        value = options[header];
      } else if (header === 'Content-Length') {
        value = ofxPayload.length;
      } else if (header === 'Host') {
        value = parsedUrl.host;
      }
      buffer += `${header}: ${value}\r\n`;
    });
    buffer += '\r\n';
    buffer += ofxPayload;
    socket.write(buffer);
  });
  let data = '';
  socket.on('data', chunk => {
    data += chunk;
  });
  socket.on('end', () => {
    let error = true;
    const httpHeaderMatcher = new RegExp(/HTTP\/\d\.\d (\d{3}) (.*)/);
    const matches = httpHeaderMatcher.exec(data);
    if (matches && matches.length > 2) {
      if (parseInt(matches[1], 10) === 200) {
        error = false;
      } else {
        error = new Error(matches[0]);
      }
    }
    cb(error, data);
  });
};
