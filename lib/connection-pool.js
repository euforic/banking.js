/*!
 * Connection Pool for banking.js
 * Provides HTTP connection pooling and management for OFX requests
 */

const https = require('https');
const http = require('http');
const url = require('url');
const debug = require('debug')('banking:pool');
const RetryManager = require('./retry-manager');
const { createBankingError, TimeoutError, ConnectionError } = require('./errors');

// Constants
const STRINGIFY_SPACE = 2;
const HTTPS_PORT = 443;
const HTTP_PORT = 80;
const LARGE_PAYLOAD_SIZE = 50000; // 50KB
const DAYS_PER_YEAR = 365;
const DAYS_PER_MONTH = 30;

/**
 * Default connection pool configuration optimized for banking operations
 */
const defaultPoolConfig = {
  // Conservative connection limits for banking compliance
  maxSockets: 5, // Maximum concurrent connections per host
  maxFreeSockets: 2, // Maximum idle connections to keep alive

  // Keep-alive settings for persistent connections
  keepAlive: true,
  keepAliveMsecs: 30000, // 30 seconds keep-alive timeout

  // Advanced timeout configuration for different operation types
  timeouts: {
    quick: {
      connection: 5000, // 5 seconds for connection establishment
      request: 15000, // 15 seconds total request timeout
      socket: 10000, // 10 seconds socket timeout
      idle: 30000 // 30 seconds idle timeout
    },
    standard: {
      connection: 10000, // 10 seconds for connection establishment
      request: 60000, // 60 seconds total request timeout
      socket: 30000, // 30 seconds socket timeout
      idle: 60000 // 60 seconds idle timeout
    },
    heavy: {
      connection: 15000, // 15 seconds for connection establishment
      request: 180000, // 3 minutes total request timeout
      socket: 90000, // 90 seconds socket timeout
      idle: 120000 // 2 minutes idle timeout
    }
  },

  // Default timeout (for backward compatibility)
  timeout: 60000, // 60 second total request timeout

  // Legacy retry settings (for backward compatibility)
  maxRetries: 3,
  retryDelay: 1000,

  // SSL/TLS settings for secure banking communications
  secureProtocol: 'TLSv1_2_method', // Force TLS 1.2+
  rejectUnauthorized: true, // Verify SSL certificates
  checkServerIdentity: undefined, // Use Node.js default server identity check

  // Operation type classification patterns
  operationClassification: {
    quick: [/getAccounts/i, /balance/i, /validate/i, /ping/i, /status/i],
    heavy: [/statement.*large/i, /download.*bulk/i, /export.*all/i, /history.*full/i]
    // Everything else defaults to 'standard'
  },

  // Pool monitoring
  enableMetrics: true,
  metricsInterval: 60000, // Report metrics every minute

  // Retry manager configuration
  retryManager: {
    enabled: true
    // RetryManager config will be passed through
  }
};

/**
 * ConnectionPool class for managing HTTP agents and connection pooling
 */
function ConnectionPool(config) {
  if (!(this instanceof ConnectionPool)) return new ConnectionPool(config);

  this.config = this._mergeConfig(defaultPoolConfig, config || {});
  this.agents = new Map(); // Map of hostname -> agent

  // Initialize retry manager if enabled
  if (this.config.retryManager.enabled) {
    this.retryManager = new RetryManager(this.config.retryManager);
    debug('Retry manager initialized');
  }

  this.metrics = {
    totalRequests: 0,
    activeConnections: 0,
    poolHits: 0,
    poolMisses: 0,
    errors: 0,
    retries: 0,
    timeouts: 0,
    averageResponseTime: 0,
    requestTimes: [],
    operationTypes: {
      quick: 0,
      standard: 0,
      heavy: 0
    }
  };

  // Initialize metrics reporting if enabled
  if (this.config.enableMetrics) {
    this.metricsTimer = setInterval(() => {
      this.reportMetrics();
    }, this.config.metricsInterval);
  }

  debug('Connection pool initialized with config:', JSON.stringify(this.config, null, 2));
}

/**
 * Deep merge configuration objects
 * @param {object} defaultConfig - Default configuration
 * @param {object} userConfig - User-provided configuration
 * @returns {object} Merged configuration
 */
ConnectionPool.prototype._mergeConfig = function (defaultConfig, userConfig) {
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
 * Classify operation type based on request parameters
 * @param {object} options - Request options
 * @param {string} data - Request data/payload
 * @returns {string} Operation type: 'quick', 'standard', or 'heavy'
 */
ConnectionPool.prototype._classifyOperation = function (options, data) {
  const url = options.url || '';
  const payload = data || '';

  // Check for quick operations
  if (this.config.operationClassification && this.config.operationClassification.quick) {
    for (const pattern of this.config.operationClassification.quick) {
      if (pattern && typeof pattern.test === 'function' && (pattern.test(url) || pattern.test(payload))) {
        return 'quick';
      }
    }
  }

  // Check for heavy operations
  if (this.config.operationClassification && this.config.operationClassification.heavy) {
    for (const pattern of this.config.operationClassification.heavy) {
      if (pattern && typeof pattern.test === 'function' && (pattern.test(url) || pattern.test(payload))) {
        return 'heavy';
      }
    }
  }

  // Check payload size for heavy operations
  if (data && data.length > 50000) {
    // > 50KB
    return 'heavy';
  }

  // Check for large date ranges in OFX requests
  if (payload.includes('<DTSTART>') && payload.includes('<DTEND>')) {
    const startMatch = payload.match(/<DTSTART>(\d{8})/i);
    const endMatch = payload.match(/<DTEND>(\d{8})/i);

    if (startMatch && endMatch) {
      const startDate = new Date(
        startMatch[1].substring(0, 4),
        parseInt(startMatch[1].substring(4, 6)) - 1,
        startMatch[1].substring(6, 8)
      );
      const endDate = new Date(
        endMatch[1].substring(0, 4),
        parseInt(endMatch[1].substring(4, 6)) - 1,
        endMatch[1].substring(6, 8)
      );

      const daysDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

      if (daysDiff > 365) {
        // More than 1 year
        return 'heavy';
      } else if (daysDiff < 30) {
        // Less than 30 days
        return 'quick';
      }
    }
  }

  return 'standard';
};

/**
 * Get timeout configuration for operation type
 * @param {string} operationType - Operation type
 * @returns {object} Timeout configuration
 */
ConnectionPool.prototype._getTimeoutConfig = function (operationType) {
  return this.config.timeouts[operationType] || this.config.timeouts.standard;
};

/**
 * Get or create an HTTP agent for the specified host with operation-specific configuration
 * @param {string} hostname - The target hostname
 * @param {boolean} isHttps - Whether to use HTTPS
 * @param {string} operationType - Operation type for timeout configuration
 * @returns {object} HTTP/HTTPS agent
 */
ConnectionPool.prototype.getAgent = function (hostname, isHttps, operationType = 'standard') {
  const agentKey = `${isHttps ? 'https:' : 'http:'}${hostname}:${operationType}`;

  if (this.agents.has(agentKey)) {
    if (this.metrics) {
      this.metrics.poolHits++;
    }
    debug('Reusing existing agent for', agentKey);
    return this.agents.get(agentKey);
  }

  if (this.metrics) {
    this.metrics.poolMisses++;
  }
  debug('Creating new agent for', agentKey);

  const timeoutConfig = this._getTimeoutConfig(operationType);
  const AgentClass = isHttps ? https.Agent : http.Agent;
  const agentOptions = {
    keepAlive: this.config.keepAlive,
    keepAliveMsecs: this.config.keepAliveMsecs,
    maxSockets: this.config.maxSockets,
    maxFreeSockets: this.config.maxFreeSockets,
    timeout: timeoutConfig.connection,
    freeSocketTimeout: timeoutConfig.idle
  };

  // Add HTTPS-specific options
  if (isHttps) {
    agentOptions.secureProtocol = this.config.secureProtocol;
    agentOptions.rejectUnauthorized = this.config.rejectUnauthorized;
    // Only set checkServerIdentity if it's defined and is a function
    if (typeof this.config.checkServerIdentity === 'function') {
      agentOptions.checkServerIdentity = this.config.checkServerIdentity;
    }
  }

  const agent = new AgentClass(agentOptions);
  this.agents.set(agentKey, agent);

  return agent;
};

/**
 * Make an HTTP request using connection pooling with advanced timeout and retry logic
 * @param {object} options - Request options
 * @param {string} data - Request body data
 * @param {function} callback - Callback function (err, response)
 */
ConnectionPool.prototype.request = function (options, data, callback) {
  const self = this;
  const startTime = Date.now();

  // Classify operation type for appropriate timeouts
  const operationType = this._classifyOperation(options, data);
  const timeoutConfig = this._getTimeoutConfig(operationType);

  if (this.metrics) {
    this.metrics.totalRequests++;
    this.metrics.operationTypes[operationType]++;
  }

  debug(`Classified request as '${operationType}' operation with timeouts:`, timeoutConfig);

  // Use retry manager if available, otherwise fall back to legacy retry logic
  if (this.retryManager) {
    this._requestWithRetryManager(options, data, operationType, timeoutConfig, callback);
  } else {
    this._requestLegacy(options, data, operationType, timeoutConfig, callback);
  }
};

/**
 * Make request with retry manager integration
 */
ConnectionPool.prototype._requestWithRetryManager = function (options, data, operationType, timeoutConfig, callback) {
  const self = this;
  const parsedUrl = url.parse(options.url);

  // Check rate limiting
  const rateLimitDelay = this.retryManager.checkRateLimit(parsedUrl.hostname);
  if (rateLimitDelay > 0) {
    debug(`Rate limiting: waiting ${rateLimitDelay}ms before request`);
    setTimeout(() => {
      this._executeRequestWithRetry(options, data, operationType, timeoutConfig, callback);
    }, rateLimitDelay);
  } else {
    this._executeRequestWithRetry(options, data, operationType, timeoutConfig, callback);
  }
};

/**
 * Execute request with retry manager
 */
ConnectionPool.prototype._executeRequestWithRetry = function (options, data, operationType, timeoutConfig, callback) {
  const self = this;
  const parsedUrl = url.parse(options.url);

  // Record request start for rate limiting
  if (this.retryManager) {
    this.retryManager.recordRequestStart(parsedUrl.hostname);
  }

  const requestOperation = attempt => {
    return new Promise((resolve, reject) => {
      self._makeSingleRequest(options, data, operationType, timeoutConfig, (error, response) => {
        if (error) {
          // Enhance error with OFX-specific information if available
          self._enhanceErrorWithOFXInfo(error, response);
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  };

  this.retryManager
    .executeWithRetry(requestOperation, { operationType })
    .then(response => {
      if (this.retryManager) {
        this.retryManager.recordRequestEnd(parsedUrl.hostname);
      }
      callback(false, response);
    })
    .catch(error => {
      if (this.retryManager) {
        this.retryManager.recordRequestEnd(parsedUrl.hostname);
      }
      callback(error);
    });
};

/**
 * Legacy request method (fallback when retry manager is disabled)
 */
ConnectionPool.prototype._requestLegacy = function (options, data, operationType, timeoutConfig, callback) {
  // Legacy implementation with basic retry logic
  this._makeSingleRequest(options, data, operationType, timeoutConfig, callback);
};

/**
 * Make a single HTTP request
 */
ConnectionPool.prototype._makeSingleRequest = function (options, data, operationType, timeoutConfig, callback) {
  const self = this;
  const startTime = Date.now();

  const parsedUrl = url.parse(options.url);
  const isHttps = parsedUrl.protocol === 'https:';
  const agent = self.getAgent(parsedUrl.hostname, isHttps, operationType);

  const requestOptions = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (isHttps ? HTTPS_PORT : HTTP_PORT),
    path: parsedUrl.path,
    method: 'POST',
    agent: agent,
    timeout: timeoutConfig.request,
    headers: {}
  };

  // Build headers from banking options
  if (options.headers && Array.isArray(options.headers)) {
    options.headers.forEach(header => {
      let value;
      if (options[header]) {
        value = options[header];
      } else if (header === 'Content-Length') {
        value = Buffer.byteLength(data, 'utf8');
      } else if (header === 'Host') {
        value = parsedUrl.host;
      }
      if (value !== undefined) {
        requestOptions.headers[header] = value;
      }
    });
  }

  debug(`Making ${operationType} request to`, parsedUrl.href);
  if (self.metrics) {
    self.metrics.activeConnections++;
  }

  const clientRequest = (isHttps ? https : http).request(requestOptions, response => {
    let responseData = '';

    // Set socket timeout
    response.socket.setTimeout(timeoutConfig.socket, () => {
      debug('Socket timeout after', `${timeoutConfig.socket}ms`);
      if (self.metrics) {
        self.metrics.timeouts++;
      }
      const timeoutError = new TimeoutError(`Socket timeout after ${timeoutConfig.socket}ms`, {
        code: 'ESOCKETTIMEDOUT',
        operationType: options.operationType,
        fid: options.fid,
        fidOrg: options.fidOrg,
        url: options.url,
        metadata: {
          timeoutType: 'socket',
          timeoutValue: timeoutConfig.socket
        }
      });
      response.destroy();
      callback(timeoutError);
    });

    response.on('data', chunk => {
      responseData += chunk;
    });

    response.on('end', () => {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      if (self.metrics) {
        self.metrics.activeConnections--;
        self.updateResponseTimeMetrics(responseTime);
      }

      debug(`${operationType} request completed in`, `${responseTime}ms`, 'status:', response.statusCode);

      // Check for HTTP errors
      if (response.statusCode !== 200) {
        const error = createBankingError(
          {
            message: `HTTP ${response.statusCode} ${response.statusMessage}`,
            httpStatus: response.statusCode
          },
          {
            operationType: options.operationType,
            fid: options.fid,
            fidOrg: options.fidOrg,
            url: options.url,
            metadata: {
              responseTime,
              responseSize: responseData.length
            }
          }
        );

        if (self.metrics) {
          self.metrics.errors++;
        }

        return callback(error, responseData);
      }

      // Transform response to match existing format
      let httpResponse = `HTTP/${response.httpVersion} ${response.statusCode} ${response.statusMessage}\r\n`;

      // Add response headers
      Object.keys(response.headers).forEach(header => {
        httpResponse += `${header}: ${response.headers[header]}\r\n`;
      });

      httpResponse += `\r\n${responseData}`;

      callback(false, httpResponse);
    });

    response.on('error', error => {
      if (self.metrics) {
        self.metrics.activeConnections--;
        self.metrics.errors++;
      }

      debug('Response error:', error.message);

      // Create appropriate banking error from the original error
      const bankingError = createBankingError(
        {
          message: error.message,
          originalError: error
        },
        {
          operationType: options.operationType,
          fid: options.fid,
          fidOrg: options.fidOrg,
          url: options.url
        }
      );

      callback(bankingError);
    });
  });

  clientRequest.on('error', error => {
    if (self.metrics) {
      self.metrics.activeConnections--;
      self.metrics.errors++;
    }

    debug('Request error:', error.message);

    // Create appropriate banking error from the original error
    const bankingError = createBankingError(
      {
        message: error.message,
        originalError: error
      },
      {
        operationType: options.operationType,
        fid: options.fid,
        fidOrg: options.fidOrg,
        url: options.url
      }
    );

    callback(bankingError);
  });

  clientRequest.on('timeout', () => {
    if (self.metrics) {
      self.metrics.activeConnections--;
      self.metrics.timeouts++;
    }

    debug('Request timeout after', `${timeoutConfig.request}ms`);
    clientRequest.destroy();

    const timeoutError = new TimeoutError(`Request timeout after ${timeoutConfig.request}ms`, {
      code: 'ETIMEDOUT',
      operationType: options.operationType,
      fid: options.fid,
      fidOrg: options.fidOrg,
      url: options.url,
      metadata: {
        timeoutType: 'request',
        timeoutValue: timeoutConfig.request
      }
    });
    callback(timeoutError);
  });

  // Set connection timeout
  clientRequest.setTimeout(timeoutConfig.connection, () => {
    debug('Connection timeout after', `${timeoutConfig.connection}ms`);
    if (self.metrics) {
      self.metrics.timeouts++;
    }
    clientRequest.destroy();
    const timeoutError = new TimeoutError(`Connection timeout after ${timeoutConfig.connection}ms`, {
      code: 'ECONNTIMEDOUT',
      operationType: options.operationType,
      fid: options.fid,
      fidOrg: options.fidOrg,
      url: options.url,
      metadata: {
        timeoutType: 'connection',
        timeoutValue: timeoutConfig.connection
      }
    });
    callback(timeoutError);
  });

  // Write request data
  clientRequest.end(data);
};

/**
 * Enhance error with OFX-specific information
 */
ConnectionPool.prototype._enhanceErrorWithOFXInfo = function (error, response) {
  if (!response || typeof response !== 'string') {
    return;
  }

  // Try to extract OFX error codes from response
  try {
    const codeMatch = response.match(/<CODE>(\d+)/i);
    const messageMatch = response.match(/<MESSAGE>([^<]+)/i);

    if (codeMatch) {
      error.ofxCode = codeMatch[1];
    }
    if (messageMatch) {
      error.ofxMessage = messageMatch[1].trim();
    }
  } catch (parseError) {
    debug('Failed to parse OFX error information:', parseError.message);
  }
};

/**
 * Update response time metrics
 * @param {number} responseTime - Response time in milliseconds
 */
ConnectionPool.prototype.updateResponseTimeMetrics = function (responseTime) {
  this.metrics.requestTimes.push(responseTime);

  // Keep only last 100 response times for average calculation
  if (this.metrics.requestTimes.length > 100) {
    this.metrics.requestTimes.shift();
  }

  // Calculate average response time
  const sum = this.metrics.requestTimes.reduce((a, b) => {
    return a + b;
  }, 0);
  this.metrics.averageResponseTime = Math.round(sum / this.metrics.requestTimes.length);
};

/**
 * Get current pool metrics including retry manager metrics
 * @returns {object} Current metrics
 */
ConnectionPool.prototype.getMetrics = function () {
  const poolStats = {};

  // Get connection statistics from agents
  this.agents.forEach((agent, key) => {
    const sockets = agent.sockets || {};
    const freeSockets = agent.freeSockets || {};
    const requests = agent.requests || {};

    poolStats[key] = {
      sockets: Object.keys(sockets).reduce((count, host) => {
        return count + sockets[host].length;
      }, 0),
      freeSockets: Object.keys(freeSockets).reduce((count, host) => {
        return count + freeSockets[host].length;
      }, 0),
      requests: Object.keys(requests).reduce((count, host) => {
        return count + requests[host].length;
      }, 0)
    };
  });

  const result = Object.assign({}, this.metrics, {
    poolStats: poolStats,
    agentCount: this.agents.size
  });

  // Include retry manager metrics if available
  if (this.retryManager) {
    result.retryMetrics = this.retryManager.getMetrics();
  }

  return result;
};

/**
 * Report current metrics (called periodically if enabled)
 */
ConnectionPool.prototype.reportMetrics = function () {
  const metrics = this.getMetrics();
  debug('Pool metrics:', JSON.stringify(metrics, null, 2));
};

/**
 * Close all connections and clean up resources
 */
ConnectionPool.prototype.destroy = function () {
  debug('Destroying connection pool');

  // Clear metrics timer
  if (this.metricsTimer) {
    clearInterval(this.metricsTimer);
    this.metricsTimer = null;
  }

  // Destroy all agents
  this.agents.forEach(agent => {
    if (agent.destroy) {
      agent.destroy();
    }
  });

  this.agents.clear();
  this.metrics = null;

  // Clean up retry manager
  if (this.retryManager) {
    this.retryManager.resetMetrics();
    this.retryManager = null;
  }
};

// Export the ConnectionPool class
module.exports = ConnectionPool;
