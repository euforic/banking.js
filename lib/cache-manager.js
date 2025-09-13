/*!
 * Cache Manager for banking.js
 * Provides sophisticated caching for banking operations with PCI compliance
 */

const crypto = require('crypto');
const debug = require('debug')('banking:cache');
const { createBankingError, CacheError } = require('./errors');

// Constants
const STRINGIFY_SPACE = 2;
const DEFAULT_CLEANUP_INTERVAL = 300000; // 5 minutes
const HASH_ALGORITHM = 'sha256';
const HASH_ENCODING = 'hex';
const SENSITIVE_FIELDS = ['password', 'user', 'accId', 'pin', 'ssn', 'credentials'];

/**
 * Default cache configuration optimized for banking operations
 */
const defaultCacheConfig = {
  // Global cache settings
  enabled: true,
  maxSize: 1000, // Maximum number of cache entries
  defaultTTL: 300000, // 5 minutes default TTL
  cleanupInterval: DEFAULT_CLEANUP_INTERVAL,

  // Operation-specific TTL settings (in milliseconds)
  operationTTL: {
    // Account information - moderate caching (5-10 minutes)
    accounts: {
      ttl: 600000, // 10 minutes
      enabled: true,
      maxEntries: 50
    },

    // Balance information - short caching (1-2 minutes)
    balance: {
      ttl: 120000, // 2 minutes
      enabled: true,
      maxEntries: 100
    },

    // Transaction statements - smart caching based on date range
    statement: {
      ttl: 300000, // 5 minutes default
      enabled: true,
      maxEntries: 200,
      // Dynamic TTL based on query characteristics
      dynamicTTL: {
        // Historical data (older than 30 days) can be cached longer
        historical: 3600000, // 1 hour
        // Recent data (last 30 days) shorter cache
        recent: 300000, // 5 minutes
        // Real-time data (today) very short cache
        realtime: 60000 // 1 minute
      }
    },

    // Institution metadata - long caching (hours/days)
    institution: {
      ttl: 86400000, // 24 hours
      enabled: true,
      maxEntries: 20
    },

    // Authentication/session data - short caching
    auth: {
      ttl: 900000, // 15 minutes
      enabled: true,
      maxEntries: 10
    }
  },

  // Security settings for PCI compliance
  security: {
    // Enable encryption for sensitive cache data
    encryptSensitiveData: true,
    // Encryption key (should be provided or auto-generated)
    encryptionKey: null,
    // Fields that should never be cached in plain text
    sensitiveFields: SENSITIVE_FIELDS,
    // Enable secure key generation with salts
    useSecureKeys: true,
    // Salt for key generation (auto-generated if not provided)
    salt: null
  },

  // Cache storage options
  storage: {
    // Storage type: 'memory', 'redis', 'file'
    type: 'memory',
    // Storage-specific options
    options: {
      // Memory storage options
      memory: {
        // Use WeakRef for memory-sensitive environments
        useWeakRef: false
      },
      // Redis options (if using Redis storage)
      redis: {
        host: 'localhost',
        port: 6379,
        db: 0,
        keyPrefix: 'banking:cache:'
      }
    }
  },

  // Cache warming configuration
  warming: {
    enabled: false,
    // Preload frequently accessed data
    preloadAccounts: true,
    preloadRecentStatements: true,
    // Warming schedule
    schedule: {
      accounts: '0 */30 * * * *', // Every 30 minutes
      statements: '0 */15 * * * *' // Every 15 minutes
    }
  },

  // Monitoring and metrics
  metrics: {
    enabled: true,
    // Track cache performance
    trackHitRate: true,
    trackResponseTime: true,
    trackMemoryUsage: true,
    // Metrics collection interval
    metricsInterval: 60000 // 1 minute
  }
};

/**
 * LRU Cache implementation with TTL support
 */
class LRUCache {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.head = null;
    this.tail = null;
  }

  get(key) {
    const node = this.cache.get(key);
    if (!node) return null;

    // Check if expired
    if (this._isExpired(node)) {
      this.delete(key);
      return null;
    }

    // Move to front (most recently used)
    this._moveToFront(node);
    return node.value;
  }

  set(key, value, ttl) {
    const expiresAt = ttl ? Date.now() + ttl : null;

    if (this.cache.has(key)) {
      // Update existing node
      const node = this.cache.get(key);
      node.value = value;
      node.expiresAt = expiresAt;
      this._moveToFront(node);
    } else {
      // Create new node
      const node = {
        key,
        value,
        expiresAt,
        prev: null,
        next: null
      };

      this.cache.set(key, node);
      this._addToFront(node);

      // Evict if over capacity
      if (this.cache.size > this.maxSize) {
        this._evictLRU();
      }
    }
  }

  delete(key) {
    const node = this.cache.get(key);
    if (!node) return false;

    this.cache.delete(key);
    this._removeNode(node);
    return true;
  }

  clear() {
    this.cache.clear();
    this.head = null;
    this.tail = null;
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.cache.keys());
  }

  _isExpired(node) {
    return node.expiresAt && Date.now() > node.expiresAt;
  }

  _moveToFront(node) {
    this._removeNode(node);
    this._addToFront(node);
  }

  _addToFront(node) {
    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  _removeNode(node) {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  _evictLRU() {
    if (this.tail) {
      this.cache.delete(this.tail.key);
      this._removeNode(this.tail);
    }
  }

  cleanup() {
    const now = Date.now();
    const expiredKeys = [];

    for (const [key, node] of this.cache) {
      if (this._isExpired(node)) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.delete(key));
    return expiredKeys.length;
  }
}

/**
 * Main Cache Manager class
 */
class CacheManager {
  constructor(config = {}) {
    this.config = this._mergeConfig(defaultCacheConfig, config);
    this.cache = new LRUCache(this.config.maxSize);
    this.metrics = this._initializeMetrics();

    // Initialize security components
    this._initializeSecurity();

    // Start cleanup interval
    this._startCleanupInterval();

    // Start metrics collection
    if (this.config.metrics.enabled) {
      this._startMetricsCollection();
    }

    debug('Cache manager initialized with config:', JSON.stringify(this.config, null, STRINGIFY_SPACE));
  }

  /**
   * Get cached data with automatic TTL handling
   * @param {string} operation - Operation type (accounts, statement, etc.)
   * @param {object} params - Operation parameters for key generation
   * @returns {object|null} Cached data or null if not found/expired
   */
  get(operation, params = {}) {
    if (!this.config.enabled || !this._isOperationEnabled(operation)) {
      this.metrics.requests.disabled++;
      return null;
    }

    const startTime = Date.now();
    const key = this._generateCacheKey(operation, params);

    try {
      const cached = this.cache.get(key);
      const duration = Date.now() - startTime;

      if (cached) {
        this.metrics.requests.hits++;
        this.metrics.performance.totalResponseTime += duration;
        this.metrics.performance.hitResponseTime += duration;

        debug(`Cache HIT for ${operation}:${key.substring(0, 16)}... (${duration}ms)`);

        // Decrypt sensitive data if needed
        const decrypted = this._decryptIfNeeded(cached);
        return decrypted;
      } else {
        this.metrics.requests.misses++;
        this.metrics.performance.totalResponseTime += duration;
        debug(`Cache MISS for ${operation}:${key.substring(0, 16)}... (${duration}ms)`);
        return null;
      }
    } catch (error) {
      this.metrics.errors.get++;
      debug(`Cache GET error for ${operation}:`, error.message);
      throw new CacheError(`Failed to get cached data: ${error.message}`, {
        originalError: error,
        operation,
        params: this._sanitizeParams(params)
      });
    }
  }

  /**
   * Set cached data with operation-specific TTL
   * @param {string} operation - Operation type
   * @param {object} params - Operation parameters for key generation
   * @param {any} data - Data to cache
   * @param {number} [customTTL] - Custom TTL override
   */
  set(operation, params = {}, data, customTTL = null) {
    if (!this.config.enabled || !this._isOperationEnabled(operation)) {
      this.metrics.requests.disabled++;
      return;
    }

    const startTime = Date.now();
    const key = this._generateCacheKey(operation, params);
    const ttl = customTTL || this._calculateTTL(operation, params);

    try {
      // Encrypt sensitive data if needed
      const encrypted = this._encryptIfNeeded(data);

      this.cache.set(key, encrypted, ttl);

      const duration = Date.now() - startTime;
      this.metrics.requests.sets++;
      this.metrics.performance.totalResponseTime += duration;
      this.metrics.performance.setResponseTime += duration;

      debug(`Cache SET for ${operation}:${key.substring(0, 16)}... TTL=${ttl}ms (${duration}ms)`);
    } catch (error) {
      this.metrics.errors.set++;
      debug(`Cache SET error for ${operation}:`, error.message);
      throw new CacheError(`Failed to set cached data: ${error.message}`, {
        originalError: error,
        operation,
        params: this._sanitizeParams(params)
      });
    }
  }

  /**
   * Invalidate cache entries for specific operation or pattern
   * @param {string} operation - Operation type to invalidate
   * @param {object} [params] - Specific parameters to invalidate (optional)
   */
  invalidate(operation, params = null) {
    const startTime = Date.now();
    let invalidated = 0;

    try {
      if (params) {
        // Invalidate specific entry
        const key = this._generateCacheKey(operation, params);
        if (this.cache.delete(key)) {
          invalidated = 1;
        }
      } else {
        // Invalidate all entries for operation
        const prefix = this._generateOperationPrefix(operation);
        const keys = this.cache.keys();

        for (const key of keys) {
          if (key.startsWith(prefix)) {
            this.cache.delete(key);
            invalidated++;
          }
        }
      }

      const duration = Date.now() - startTime;
      this.metrics.requests.invalidations += invalidated;
      this.metrics.performance.totalResponseTime += duration;

      debug(`Cache INVALIDATE for ${operation}: ${invalidated} entries (${duration}ms)`);
      return invalidated;
    } catch (error) {
      this.metrics.errors.invalidate++;
      throw new CacheError(`Failed to invalidate cache: ${error.message}`, {
        originalError: error,
        operation,
        params: params ? this._sanitizeParams(params) : null
      });
    }
  }

  /**
   * Clear all cache entries
   */
  clear() {
    try {
      const size = this.cache.size();
      this.cache.clear();
      this.metrics.requests.clears++;
      debug(`Cache CLEAR: ${size} entries removed`);
      return size;
    } catch (error) {
      this.metrics.errors.clear++;
      throw new CacheError(`Failed to clear cache: ${error.message}`, {
        originalError: error
      });
    }
  }

  /**
   * Get cache statistics and metrics
   * @returns {object} Cache metrics and statistics
   */
  getMetrics() {
    const totalRequests = this.metrics.requests.hits + this.metrics.requests.misses;
    const hitRate = totalRequests > 0 ? (this.metrics.requests.hits / totalRequests) * 100 : 0;

    return {
      requests: { ...this.metrics.requests },
      performance: {
        ...this.metrics.performance,
        hitRate: Number(hitRate.toFixed(2)),
        averageResponseTime:
          totalRequests > 0 ? Number((this.metrics.performance.totalResponseTime / totalRequests).toFixed(2)) : 0,
        averageHitResponseTime:
          this.metrics.requests.hits > 0
            ? Number((this.metrics.performance.hitResponseTime / this.metrics.requests.hits).toFixed(2))
            : 0,
        averageSetResponseTime:
          this.metrics.requests.sets > 0
            ? Number((this.metrics.performance.setResponseTime / this.metrics.requests.sets).toFixed(2))
            : 0
      },
      cache: {
        size: this.cache.size(),
        maxSize: this.config.maxSize,
        utilizationPercent: Number(((this.cache.size() / this.config.maxSize) * 100).toFixed(2))
      },
      errors: { ...this.metrics.errors },
      uptime: Date.now() - this.metrics.startTime,
      lastCleanup: this.metrics.lastCleanup,
      config: {
        enabled: this.config.enabled,
        operationTTL: this.config.operationTTL
      }
    };
  }

  /**
   * Reset cache metrics
   */
  resetMetrics() {
    this.metrics = this._initializeMetrics();
    debug('Cache metrics reset');
  }

  /**
   * Destroy cache manager and clean up resources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    this.clear();
    debug('Cache manager destroyed');
  }

  // Private methods

  /**
   * Generate secure cache key from operation and parameters
   * @param {string} operation - Operation type
   * @param {object} params - Parameters to include in key
   * @returns {string} Secure cache key
   */
  _generateCacheKey(operation, params) {
    const prefix = this._generateOperationPrefix(operation);

    // Sanitize parameters to remove sensitive data
    const sanitized = this._sanitizeParams(params);

    // Create deterministic parameter string
    const paramString = this._createParamString(sanitized);

    if (this.config.security.useSecureKeys) {
      // Generate secure hash of parameters
      const hash = this._hashData(paramString);
      return `${prefix}:${hash}`;
    } else {
      // Simple concatenation (less secure, for development only)
      return `${prefix}:${Buffer.from(paramString).toString('base64')}`;
    }
  }

  /**
   * Generate operation prefix for cache keys
   * @param {string} operation - Operation type
   * @returns {string} Operation prefix
   */
  _generateOperationPrefix(operation) {
    return `banking:${operation}`;
  }

  /**
   * Create deterministic parameter string from sanitized parameters
   * @param {object} params - Sanitized parameters
   * @returns {string} Parameter string
   */
  _createParamString(params) {
    // Sort keys for deterministic output
    const sorted = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {});

    return JSON.stringify(sorted);
  }

  /**
   * Remove sensitive data from parameters for key generation
   * @param {object} params - Original parameters
   * @returns {object} Sanitized parameters
   */
  _sanitizeParams(params) {
    const sanitized = { ...params };

    // Remove sensitive fields
    for (const field of this.config.security.sensitiveFields) {
      if (sanitized[field]) {
        // Create hash of sensitive field for key uniqueness without exposing data
        sanitized[`${field}_hash`] = this._hashData(sanitized[field].toString());
        delete sanitized[field];
      }
    }

    return sanitized;
  }

  /**
   * Calculate TTL for operation based on configuration and parameters
   * @param {string} operation - Operation type
   * @param {object} params - Operation parameters
   * @returns {number} TTL in milliseconds
   */
  _calculateTTL(operation, params) {
    const operationConfig = this.config.operationTTL[operation];
    if (!operationConfig) {
      return this.config.defaultTTL;
    }

    // For statement operations, use dynamic TTL based on date range
    if (operation === 'statement' && operationConfig.dynamicTTL && params.start) {
      return this._calculateStatementTTL(params, operationConfig.dynamicTTL);
    }

    return operationConfig.ttl || this.config.defaultTTL;
  }

  /**
   * Calculate dynamic TTL for statement operations based on date range
   * @param {object} params - Statement parameters
   * @param {object} dynamicConfig - Dynamic TTL configuration
   * @returns {number} TTL in milliseconds
   */
  _calculateStatementTTL(params, dynamicConfig) {
    try {
      const now = new Date();
      const startDate = this._parseOFXDate(params.start);
      const daysDiff = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));

      if (daysDiff === 0) {
        // Today's data - very short cache
        return dynamicConfig.realtime;
      } else if (daysDiff <= 30) {
        // Recent data (last 30 days) - short cache
        return dynamicConfig.recent;
      } else {
        // Historical data - longer cache
        return dynamicConfig.historical;
      }
    } catch (error) {
      debug('Error calculating dynamic TTL, using default:', error.message);
      return dynamicConfig.recent; // Fallback to recent TTL
    }
  }

  /**
   * Parse OFX date format (YYYYMMDD or YYYYMMDDHHMMSS)
   * @param {string} ofxDate - OFX formatted date
   * @returns {Date} Parsed date
   */
  _parseOFXDate(ofxDate) {
    const dateStr = ofxDate.toString();
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
    const day = parseInt(dateStr.substring(6, 8));

    if (dateStr.length >= 14) {
      // Include time if provided
      const hour = parseInt(dateStr.substring(8, 10));
      const minute = parseInt(dateStr.substring(10, 12));
      const second = parseInt(dateStr.substring(12, 14));
      return new Date(year, month, day, hour, minute, second);
    } else {
      return new Date(year, month, day);
    }
  }

  /**
   * Check if operation caching is enabled
   * @param {string} operation - Operation type
   * @returns {boolean} Whether caching is enabled for operation
   */
  _isOperationEnabled(operation) {
    const operationConfig = this.config.operationTTL[operation];
    return operationConfig ? operationConfig.enabled !== false : true;
  }

  /**
   * Initialize security components
   */
  _initializeSecurity() {
    // Generate encryption key if not provided
    if (this.config.security.encryptSensitiveData && !this.config.security.encryptionKey) {
      this.config.security.encryptionKey = crypto.randomBytes(32);
      debug('Generated encryption key for sensitive data');
    }

    // Generate salt if not provided
    if (this.config.security.useSecureKeys && !this.config.security.salt) {
      this.config.security.salt = crypto.randomBytes(16);
      debug('Generated salt for secure key generation');
    }
  }

  /**
   * Hash data using secure algorithm
   * @param {string} data - Data to hash
   * @returns {string} Hashed data
   */
  _hashData(data) {
    const hash = crypto.createHash(HASH_ALGORITHM);

    if (this.config.security.salt) {
      hash.update(this.config.security.salt);
    }

    hash.update(data);
    return hash.digest(HASH_ENCODING);
  }

  /**
   * Encrypt sensitive data if encryption is enabled
   * @param {any} data - Data to potentially encrypt
   * @returns {any} Encrypted data or original data
   */
  _encryptIfNeeded(data) {
    if (!this.config.security.encryptSensitiveData || !this.config.security.encryptionKey) {
      return data;
    }

    try {
      // Check if data contains sensitive information
      if (this._containsSensitiveData(data)) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher('aes-256-cbc', this.config.security.encryptionKey);

        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return {
          _encrypted: true,
          _iv: iv.toString('hex'),
          _data: encrypted
        };
      }

      return data;
    } catch (error) {
      debug('Encryption error:', error.message);
      return data; // Return original data if encryption fails
    }
  }

  /**
   * Decrypt data if it was encrypted
   * @param {any} data - Data to potentially decrypt
   * @returns {any} Decrypted data or original data
   */
  _decryptIfNeeded(data) {
    if (!data || !data._encrypted || !this.config.security.encryptionKey) {
      return data;
    }

    try {
      const decipher = crypto.createDecipher('aes-256-cbc', this.config.security.encryptionKey);

      let decrypted = decipher.update(data._data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      debug('Decryption error:', error.message);
      return null; // Return null if decryption fails
    }
  }

  /**
   * Check if data contains sensitive information
   * @param {any} data - Data to check
   * @returns {boolean} Whether data contains sensitive fields
   */
  _containsSensitiveData(data) {
    if (!data || typeof data !== 'object') return false;

    const jsonStr = JSON.stringify(data).toLowerCase();

    return this.config.security.sensitiveFields.some(field => jsonStr.includes(field.toLowerCase()));
  }

  /**
   * Initialize metrics object
   * @returns {object} Initial metrics
   */
  _initializeMetrics() {
    return {
      startTime: Date.now(),
      lastCleanup: Date.now(),
      requests: {
        hits: 0,
        misses: 0,
        sets: 0,
        invalidations: 0,
        clears: 0,
        disabled: 0
      },
      performance: {
        totalResponseTime: 0,
        hitResponseTime: 0,
        setResponseTime: 0
      },
      errors: {
        get: 0,
        set: 0,
        invalidate: 0,
        clear: 0
      }
    };
  }

  /**
   * Start automatic cleanup interval
   */
  _startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      try {
        const cleaned = this.cache.cleanup();
        this.metrics.lastCleanup = Date.now();

        if (cleaned > 0) {
          debug(`Cache cleanup: removed ${cleaned} expired entries`);
        }
      } catch (error) {
        debug('Cache cleanup error:', error.message);
      }
    }, this.config.cleanupInterval);
  }

  /**
   * Start metrics collection interval
   */
  _startMetricsCollection() {
    this.metricsInterval = setInterval(() => {
      const metrics = this.getMetrics();
      debug('Cache metrics:', JSON.stringify(metrics, null, STRINGIFY_SPACE));
    }, this.config.metrics.metricsInterval);
  }

  /**
   * Merge configuration objects
   * @param {object} defaults - Default configuration
   * @param {object} custom - Custom configuration
   * @returns {object} Merged configuration
   */
  _mergeConfig(defaults, custom) {
    const merged = JSON.parse(JSON.stringify(defaults)); // Deep clone

    function deepMerge(target, source) {
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) target[key] = {};
          deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }

    deepMerge(merged, custom);
    return merged;
  }
}

module.exports = CacheManager;
