/*!
 * Retry Manager for banking.js
 * Provides intelligent retry logic with exponential backoff and jitter
 * Optimized for banking operations and various failure types
 */

const debug = require('debug')('banking:retry');

// Constants
const STRINGIFY_SPACE = 2;

/**
 * Default retry configuration optimized for banking operations
 */
const defaultRetryConfig = {
  // Maximum retry attempts for different operation types
  maxRetries: {
    quick: 3, // Account validation, balance checks
    standard: 5, // Statement downloads, transaction lists
    heavy: 2 // Large date range downloads
  },

  // Base delay in milliseconds for exponential backoff
  baseDelay: 1000,

  // Maximum delay cap to prevent excessively long waits
  maxDelay: 30000,

  // Backoff strategies
  backoffStrategy: 'exponential', // 'exponential', 'linear', 'fixed'

  // Jitter configuration to prevent thundering herd
  jitter: {
    enabled: true,
    type: 'full', // 'full', 'equal', 'decorrelated'
    factor: 0.1 // Jitter factor (0.0 to 1.0)
  },

  // Timeout configuration for different operation types
  timeouts: {
    quick: {
      connection: 5000, // 5 seconds for connection establishment
      request: 15000, // 15 seconds total request timeout
      socket: 10000 // 10 seconds socket timeout
    },
    standard: {
      connection: 10000, // 10 seconds for connection establishment
      request: 60000, // 60 seconds total request timeout
      socket: 30000 // 30 seconds socket timeout
    },
    heavy: {
      connection: 15000, // 15 seconds for connection establishment
      request: 120000, // 2 minutes total request timeout
      socket: 60000 // 60 seconds socket timeout
    }
  },

  // Retry conditions - which errors should trigger retries
  retryConditions: {
    // Network-level errors that are typically transient
    networkErrors: [
      'ECONNRESET', // Connection reset by peer
      'ETIMEDOUT', // Connection/request timeout
      'ECONNREFUSED', // Connection refused (server down)
      'ENOTFOUND', // DNS resolution failure
      'ENETUNREACH', // Network unreachable
      'EHOSTUNREACH', // Host unreachable
      'EPIPE', // Broken pipe
      'ECONNABORTED' // Connection aborted
    ],

    // HTTP status codes that warrant retries
    httpStatusCodes: [
      408, // Request Timeout
      429, // Too Many Requests (rate limiting)
      500, // Internal Server Error
      502, // Bad Gateway
      503, // Service Unavailable
      504, // Gateway Timeout
      507, // Insufficient Storage
      520, // Unknown Error (Cloudflare)
      521, // Web Server Is Down (Cloudflare)
      522, // Connection Timed Out (Cloudflare)
      523, // Origin Is Unreachable (Cloudflare)
      524 // A Timeout Occurred (Cloudflare)
    ],

    // SSL/TLS errors that might be transient
    sslErrors: [
      'EPROTO', // SSL protocol error
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE', // Certificate verification failed
      'CERT_HAS_EXPIRED', // Certificate expired
      'SSL_HANDSHAKE_FAILURE' // SSL handshake failed
    ],

    // Banking-specific OFX error codes that should NOT be retried
    nonRetryableOFXCodes: [
      '15500', // Invalid user credentials
      '15501', // Customer account already in use
      '15502', // Invalid user ID
      '15503', // Invalid password
      '15505', // Password expired
      '15510', // Account suspended
      '10500', // Invalid account number
      '10401', // Account restricted
      '2020', // Invalid date range
      '10015' // Unsupported OFX version
    ]
  },

  // Rate limiting configuration
  rateLimiting: {
    enabled: true,
    maxConcurrent: 3, // Maximum concurrent requests per host
    requestInterval: 500 // Minimum time between requests (ms)
  }
};

/**
 * RetryManager class for handling intelligent retry logic
 */
function RetryManager(config) {
  if (!(this instanceof RetryManager)) return new RetryManager(config);

  this.config = this._mergeConfig(defaultRetryConfig, config || {});
  this.metrics = {
    totalAttempts: 0,
    successfulRetries: 0,
    failedRetries: 0,
    timeouts: 0,
    networkErrors: 0,
    httpErrors: 0,
    sslErrors: 0,
    ofxErrors: 0,
    averageAttempts: 0,
    totalDelay: 0
  };

  // Rate limiting state per host
  this.rateLimitState = new Map();

  debug('RetryManager initialized with config:', JSON.stringify(this.config, null, STRINGIFY_SPACE));
}

/**
 * Deep merge configuration objects
 * @param {object} defaultConfig - Default configuration
 * @param {object} userConfig - User-provided configuration
 * @returns {object} Merged configuration
 */
RetryManager.prototype._mergeConfig = function (defaultConfig, userConfig) {
  const merged = JSON.parse(JSON.stringify(defaultConfig));

  function deepMerge(target, source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        target[key] = target[key] || {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  deepMerge(merged, userConfig);
  return merged;
};

/**
 * Determine if an error should trigger a retry
 * @param {Error} error - The error that occurred
 * @param {number} attempt - Current attempt number
 * @param {string} operationType - Type of operation (quick, standard, heavy)
 * @returns {boolean} Whether the error should be retried
 */
RetryManager.prototype.shouldRetry = function (error, attempt, operationType = 'standard') {
  const maxRetries = this.config.maxRetries[operationType] || this.config.maxRetries.standard;

  // Don't retry if we've exceeded max attempts
  if (attempt >= maxRetries) {
    debug(`Max retries (${maxRetries}) exceeded for ${operationType} operation`);
    return false;
  }

  // Check for network errors
  if (error.code && this.config.retryConditions.networkErrors.includes(error.code)) {
    debug(`Network error detected: ${error.code}, will retry`);
    this.metrics.networkErrors++;
    return true;
  }

  // Check for HTTP status codes
  if (error.statusCode && this.config.retryConditions.httpStatusCodes.includes(error.statusCode)) {
    debug(`HTTP error detected: ${error.statusCode}, will retry`);
    this.metrics.httpErrors++;
    return true;
  }

  // Check for SSL errors
  if (error.code && this.config.retryConditions.sslErrors.includes(error.code)) {
    debug(`SSL error detected: ${error.code}, will retry`);
    this.metrics.sslErrors++;
    return true;
  }

  // Check for timeout errors
  if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
    debug('Timeout error detected, will retry');
    this.metrics.timeouts++;
    return true;
  }

  // Check for OFX-specific errors that should not be retried
  if (error.ofxCode && this.config.retryConditions.nonRetryableOFXCodes.includes(error.ofxCode)) {
    debug(`Non-retryable OFX error: ${error.ofxCode}, will not retry`);
    this.metrics.ofxErrors++;
    return false;
  }

  // Default: don't retry unknown errors
  debug(`Unknown error type: ${error.code || error.message}, will not retry`);
  return false;
};

/**
 * Calculate delay for next retry attempt with jitter
 * @param {number} attempt - Current attempt number (0-based)
 * @param {string} operationType - Type of operation
 * @returns {number} Delay in milliseconds
 */
RetryManager.prototype.calculateDelay = function (attempt, operationType = 'standard') {
  let delay;

  switch (this.config.backoffStrategy) {
    case 'exponential':
      delay = this.config.baseDelay * Math.pow(2, attempt);
      break;
    case 'linear':
      delay = this.config.baseDelay * (attempt + 1);
      break;
    case 'fixed':
    default:
      delay = this.config.baseDelay;
      break;
  }

  // Apply maximum delay cap
  delay = Math.min(delay, this.config.maxDelay);

  // Apply jitter if enabled
  if (this.config.jitter.enabled) {
    delay = this._applyJitter(delay, attempt);
  }

  this.metrics.totalDelay += delay;
  debug(`Calculated retry delay: ${delay}ms for attempt ${attempt + 1}`);
  return delay;
};

/**
 * Apply jitter to delay value
 * @param {number} delay - Base delay in milliseconds
 * @param {number} attempt - Current attempt number
 * @returns {number} Jittered delay
 */
RetryManager.prototype._applyJitter = function (delay, attempt) {
  const jitterConfig = this.config.jitter;
  const JITTER_MULTIPLIER = 2;
  const DECORRELATED_MULTIPLIER = 3;

  switch (jitterConfig.type) {
    case 'full': {
      // Full jitter: random between 0 and delay
      return Math.random() * delay;
    }
    case 'equal': {
      // Equal jitter: delay/2 + random(0, delay/2)
      const halfDelay = delay / 2;
      return halfDelay + Math.random() * halfDelay;
    }
    case 'decorrelated': {
      // Decorrelated jitter: exponential with randomness
      const base = this.config.baseDelay;
      return Math.random() * Math.min(this.config.maxDelay, base * DECORRELATED_MULTIPLIER * Math.pow(2, attempt));
    }
    default: {
      // Simple jitter factor
      const jitterAmount = delay * jitterConfig.factor;
      return delay + (Math.random() * JITTER_MULTIPLIER - 1) * jitterAmount;
    }
  }
};

/**
 * Get timeout configuration for operation type
 * @param {string} operationType - Type of operation (quick, standard, heavy)
 * @returns {object} Timeout configuration
 */
RetryManager.prototype.getTimeoutConfig = function (operationType = 'standard') {
  return this.config.timeouts[operationType] || this.config.timeouts.standard;
};

/**
 * Check rate limiting for a host
 * @param {string} hostname - Target hostname
 * @returns {number} Delay needed for rate limiting (0 if none)
 */
RetryManager.prototype.checkRateLimit = function (hostname) {
  if (!this.config.rateLimiting.enabled) {
    return 0;
  }

  const now = Date.now();
  const hostState = this.rateLimitState.get(hostname) || {
    lastRequest: 0,
    activeRequests: 0
  };

  // Check concurrent request limit
  if (hostState.activeRequests >= this.config.rateLimiting.maxConcurrent) {
    debug(`Rate limit: max concurrent requests reached for ${hostname}`);
    return this.config.rateLimiting.requestInterval;
  }

  // Check minimum interval between requests
  const timeSinceLastRequest = now - hostState.lastRequest;
  if (timeSinceLastRequest < this.config.rateLimiting.requestInterval) {
    const delay = this.config.rateLimiting.requestInterval - timeSinceLastRequest;
    debug(`Rate limit: enforcing ${delay}ms delay for ${hostname}`);
    return delay;
  }

  return 0;
};

/**
 * Record request start for rate limiting
 * @param {string} hostname - Target hostname
 */
RetryManager.prototype.recordRequestStart = function (hostname) {
  if (!this.config.rateLimiting.enabled) {
    return;
  }

  const now = Date.now();
  const hostState = this.rateLimitState.get(hostname) || {
    lastRequest: 0,
    activeRequests: 0
  };

  hostState.lastRequest = now;
  hostState.activeRequests++;
  this.rateLimitState.set(hostname, hostState);
};

/**
 * Record request end for rate limiting
 * @param {string} hostname - Target hostname
 */
RetryManager.prototype.recordRequestEnd = function (hostname) {
  if (!this.config.rateLimiting.enabled) {
    return;
  }

  const hostState = this.rateLimitState.get(hostname);
  if (hostState && hostState.activeRequests > 0) {
    hostState.activeRequests--;
    this.rateLimitState.set(hostname, hostState);
  }
};

/**
 * Update retry metrics
 * @param {boolean} success - Whether the retry was successful
 * @param {number} totalAttempts - Total number of attempts made
 */
RetryManager.prototype.updateMetrics = function (success, totalAttempts) {
  this.metrics.totalAttempts += totalAttempts;

  if (success && totalAttempts > 1) {
    this.metrics.successfulRetries++;
  } else if (!success && totalAttempts > 1) {
    this.metrics.failedRetries++;
  }

  // Update average attempts
  const totalOperations = this.metrics.successfulRetries + this.metrics.failedRetries + (totalAttempts === 1 ? 1 : 0);
  if (totalOperations > 0) {
    this.metrics.averageAttempts = this.metrics.totalAttempts / totalOperations;
  }
};

/**
 * Get current retry metrics
 * @returns {object} Current metrics
 */
RetryManager.prototype.getMetrics = function () {
  return Object.assign({}, this.metrics, {
    retrySuccessRate:
      this.metrics.successfulRetries / Math.max(1, this.metrics.successfulRetries + this.metrics.failedRetries),
    averageDelay: this.metrics.totalDelay / Math.max(1, this.metrics.totalAttempts - 1)
  });
};

/**
 * Reset retry metrics
 */
RetryManager.prototype.resetMetrics = function () {
  this.metrics = {
    totalAttempts: 0,
    successfulRetries: 0,
    failedRetries: 0,
    timeouts: 0,
    networkErrors: 0,
    httpErrors: 0,
    sslErrors: 0,
    ofxErrors: 0,
    averageAttempts: 0,
    totalDelay: 0
  };
  debug('Retry metrics reset');
};

/**
 * Create a retry wrapper function for any async operation
 * @param {function} operation - The operation to retry
 * @param {object} options - Retry options
 * @returns {Promise} Promise that resolves with operation result
 */
RetryManager.prototype.executeWithRetry = function (operation, options = {}) {
  const self = this;
  const operationType = options.operationType || 'standard';
  const maxRetries = this.config.maxRetries[operationType] || this.config.maxRetries.standard;

  return new Promise((resolve, reject) => {
    let attempt = 0;

    function tryOperation() {
      attempt++;
      self.metrics.totalAttempts++;

      debug(`Executing operation attempt ${attempt}/${maxRetries + 1}`);

      Promise.resolve(operation(attempt))
        .then(result => {
          debug(`Operation succeeded on attempt ${attempt}`);
          self.updateMetrics(true, attempt);
          return resolve(result);
        })
        .catch(error => {
          debug(`Operation failed on attempt ${attempt}:`, error.message);

          if (self.shouldRetry(error, attempt - 1, operationType)) {
            const delay = self.calculateDelay(attempt - 1, operationType);
            debug(`Retrying operation in ${delay}ms`);

            setTimeout(tryOperation, delay);
          } else {
            debug(`Not retrying operation after ${attempt} attempts`);
            self.updateMetrics(false, attempt);
            reject(error);
          }
        });
    }

    tryOperation();
  });
};

// Export the RetryManager class
module.exports = RetryManager;
