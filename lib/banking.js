/*!
 * banking.js
 */

/**
 * [request description]
 * @type {[type]}
 */

const fs = require('fs'),
  ofx = require('./ofx'),
  pkg = require('../package'),
  util = require('./utils'),
  debug = require('debug')('banking:main');
const {
  createBankingError,
  InvalidConfigurationError,
  MissingParameterError,
  DataParsingError,
  InvalidDateRangeError
} = require('./errors');

/**
 * expose Banking
 */

module.exports = Banking;

/**
 * [Banking description]
 * @param {[type]} args [description]
 */

function Banking(args) {
  if (!(this instanceof Banking)) return new Banking(args);

  // Validate required parameters
  if (!args) {
    throw new InvalidConfigurationError('Configuration object is required');
  }

  // Validate required fields
  const requiredFields = ['fid', 'url', 'user', 'password', 'accId', 'accType'];
  for (const field of requiredFields) {
    if (!args[field] && args[field] !== 0) {
      throw new MissingParameterError(`Required parameter '${field}' is missing`);
    }
  }

  // Validate FID format
  if (typeof args.fid !== 'number' || args.fid <= 0) {
    throw new InvalidConfigurationError('FID must be a positive number');
  }

  // Validate URL format
  try {
    new URL(args.url);
  } catch (e) {
    throw new InvalidConfigurationError(`Invalid URL format: ${args.url}`);
  }

  // Validate account type
  const validAccountTypes = ['CHECKING', 'SAVINGS', 'MONEYMRKT', 'CREDITCARD', 'INVESTMENT'];
  if (!validAccountTypes.includes(args.accType)) {
    throw new InvalidConfigurationError(
      `Invalid account type '${args.accType}'. Must be one of: ${validAccountTypes.join(', ')}`
    );
  }

  this.opts = {
    fid: args.fid,
    fidOrg: args.fidOrg || '',
    url: args.url,
    bankId: args.bankId || '' /* If bank account use your bank routing number otherwise set to null */,
    user: args.user,
    password: args.password,
    accId: args.accId /* Account Number */,
    brokerId: args.brokerId /* For investment accounts */,
    accType: args.accType,
    clientId: args.clientId,
    appVer: args.appVer || '1700',
    ofxVer: args.ofxVer || '102',
    app: args.app || 'QWIN',
    'User-Agent': args['User-Agent'] || 'banking-js',
    'Content-Type': args['Content-Type'] || 'application/x-ofx',
    Accept: args.Accept || 'application/ofx',
    Connection: args.Connection || 'Close',
    headers: args.headers || ['Host', 'Accept', 'User-Agent', 'Content-Type', 'Content-Length', 'Connection'],

    // Timeout and retry configuration (can be overridden per instance)
    timeoutConfig: args.timeoutConfig || null,
    retryConfig: args.retryConfig || null,
    operationType: args.operationType || 'standard', // Default operation type
    usePooling: args.usePooling !== false // Enable pooling by default
  };
}

/**
 * [version description]
 */

Banking.version = pkg.version;

/**
 * [parseFile description]
 * @param  {[type]}   file [description]
 * @param  {Function} fn   [description]
 * @return {[type]}        [description]
 */

Banking.parseFile = function (file, fn) {
  fs.readFile(file, 'utf8', (err, data) => {
    if (err) {
      const parseError = new DataParsingError(`Failed to read OFX file: ${err.message}`, {
        originalError: err,
        metadata: { filePath: file }
      });
      throw parseError;
    }
    try {
      ofx.parse(data, res => {
        fn(res);
      });
    } catch (parseError) {
      const dataError = new DataParsingError(`Failed to parse OFX data: ${parseError.message}`, {
        originalError: parseError,
        metadata: { filePath: file }
      });
      throw dataError;
    }
  });
};

/**
 * [parse description]
 * @param  {[type]}   str [description]
 * @param  {Function} fn  [description]
 * @return {[type]}       [description]
 */

Banking.parse = function (str, fn) {
  try {
    ofx.parse(str, res => {
      fn(res);
    });
  } catch (parseError) {
    const dataError = new DataParsingError(`Failed to parse OFX string: ${parseError.message}`, {
      originalError: parseError
    });
    throw dataError;
  }
};

/**
 * Configure connection pooling and retry settings for all banking operations
 * @param {object} config - Connection pool and retry configuration options
 * @param {object} config.pool - Connection pool specific settings
 * @param {object} config.retry - Retry manager specific settings
 * @param {object} config.timeouts - Operation-specific timeout configurations
 * @returns {object} Applied configuration
 */
Banking.configurePool = function (config) {
  return util.configurePool(config);
};

/**
 * Configure retry policies for banking operations
 * @param {object} config - Retry configuration options
 * @returns {object} Applied retry configuration
 */
Banking.configureRetry = function (config) {
  return util.configureRetry(config);
};

/**
 * Configure timeout settings for different operation types
 * @param {object} timeouts - Timeout configuration by operation type
 * @param {object} timeouts.quick - Timeouts for quick operations (account validation, balance checks)
 * @param {object} timeouts.standard - Timeouts for standard operations (statement downloads)
 * @param {object} timeouts.heavy - Timeouts for heavy operations (large date ranges)
 * @returns {object} Applied timeout configuration
 */
Banking.configureTimeouts = function (timeouts) {
  return util.configureTimeouts(timeouts);
};

/**
 * Get current connection pool metrics and statistics
 * @returns {object} Pool metrics or null if pooling is not enabled
 */
Banking.getPoolMetrics = function () {
  return util.getPoolMetrics();
};

/**
 * Get current retry metrics and statistics
 * @returns {object} Retry metrics or null if retry manager is not enabled
 */
Banking.getRetryMetrics = function () {
  return util.getRetryMetrics();
};

/**
 * Reset retry metrics (useful for testing or monitoring)
 */
Banking.resetRetryMetrics = function () {
  return util.resetRetryMetrics();
};

/**
 * Configure caching for banking operations
 * @param {object} config - Cache configuration options
 * @param {boolean} config.enabled - Enable/disable caching
 * @param {number} config.maxSize - Maximum cache size
 * @param {object} config.operationTTL - TTL settings for different operations
 * @param {object} config.security - Security settings for PCI compliance
 * @returns {object} Applied cache configuration
 */
Banking.configureCache = function (config) {
  return util.configureCache(config);
};

/**
 * Get cache metrics and statistics
 * @returns {object} Cache metrics or null if caching is not enabled
 */
Banking.getCacheMetrics = function () {
  return util.getCacheMetrics();
};

/**
 * Reset cache metrics (useful for testing or monitoring)
 */
Banking.resetCacheMetrics = function () {
  return util.resetCacheMetrics();
};

/**
 * Clear all cached data
 * @returns {number} Number of entries cleared
 */
Banking.clearCache = function () {
  return util.clearCache();
};

/**
 * Invalidate cache entries for specific operation
 * @param {string} operation - Operation type to invalidate (accounts, statement, etc.)
 * @param {object} [params] - Specific parameters to invalidate (optional)
 * @returns {number} Number of entries invalidated
 */
Banking.invalidateCache = function (operation, params = null) {
  return util.invalidateCache(operation, params);
};

/**
 * Destroy the connection pool and clean up all resources
 * Call this when shutting down your application
 */
Banking.destroyPool = function () {
  return util.destroyPool();
};

/**
 * Get a list of transactions from the ofx server
 * @param args set start and end date for transaction range
 * @param fn callback(error, transactions)
 */
Banking.prototype.getStatement = function (args, fn) {
  // Validate date range parameters
  if (!args || !args.start) {
    const error = new InvalidDateRangeError('Start date is required');
    return fn(error, null);
  }

  // Validate date format (YYYYMMDD or YYYYMMDDHHMMSS)
  const dateRegex = /^\d{8}(\d{6})?$/;
  if (!dateRegex.test(args.start.toString())) {
    const error = new InvalidDateRangeError('Start date must be in YYYYMMDD or YYYYMMDDHHMMSS format');
    return fn(error, null);
  }

  if (args.end && !dateRegex.test(args.end.toString())) {
    const error = new InvalidDateRangeError('End date must be in YYYYMMDD or YYYYMMDDHHMMSS format');
    return fn(error, null);
  }

  // Validate that start date is before end date
  if (args.end && parseInt(args.start) > parseInt(args.end)) {
    const error = new InvalidDateRangeError('Start date must be before end date');
    return fn(error, null);
  }

  const opts = util.mixin(this.opts, args);
  const ofxReq = ofx.buildStatementRequest(opts);

  // Add operation type hint for proper timeout classification
  const operationType = this._classifyStatementOperation(args);
  const requestOpts = Object.assign({}, this.opts, {
    operationType: operationType,
    // Cache configuration
    cacheOperation: 'statement',
    cacheParams: {
      fid: this.opts.fid,
      accId: this.opts.accId,
      accType: this.opts.accType,
      start: args.start,
      end: args.end,
      operationType: operationType
    }
  });

  util.request(requestOpts, ofxReq, (err, response) => {
    debug('Raw-Response:', response);
    if (err) return fn(err, null);

    try {
      ofx.parse(response, ofxObj => {
        fn(false, ofxObj);
      });
    } catch (parseError) {
      const error = new DataParsingError(`Failed to parse OFX response: ${parseError.message}`, {
        originalError: parseError,
        operationType: requestOpts.operationType,
        fid: this.opts.fid,
        fidOrg: this.opts.fidOrg
      });
      fn(error, null);
    }
  });
};

/**
 * Get a list of accounts from your the ofx server
 * @param args
 * @param fn
 */
Banking.prototype.getAccounts = function (fn) {
  const ofxReq = ofx.buildAccountListRequest(this.opts);

  // Account list requests are typically quick operations
  const requestOpts = Object.assign({}, this.opts, {
    operationType: 'quick',
    // Cache configuration
    cacheOperation: 'accounts',
    cacheParams: {
      fid: this.opts.fid,
      user: this.opts.user, // Will be hashed for security
      operationType: 'quick'
    }
  });

  util.request(requestOpts, ofxReq, (err, response) => {
    debug('Raw-Response:', response);
    if (err) return fn(err, null);

    try {
      ofx.parse(response, ofxObj => {
        fn(false, ofxObj);
      });
    } catch (parseError) {
      const error = new DataParsingError(`Failed to parse OFX account list response: ${parseError.message}`, {
        originalError: parseError,
        operationType: 'quick',
        fid: this.opts.fid,
        fidOrg: this.opts.fidOrg
      });
      fn(error, null);
    }
  });
};

/**
 * Classify statement operation type based on date range and other parameters
 * @param {object} args - Statement request arguments
 * @returns {string} Operation type: 'quick', 'standard', or 'heavy'
 */
Banking.prototype._classifyStatementOperation = function (args) {
  if (!args.start || !args.end) {
    return 'standard';
  }

  // Convert date format (YYYYMMDD) to Date objects
  const startStr = args.start.toString();
  const endStr = args.end.toString();

  const startDate = new Date(
    startStr.substring(0, 4),
    parseInt(startStr.substring(4, 6)) - 1,
    startStr.substring(6, 8)
  );
  const endDate = new Date(endStr.substring(0, 4), parseInt(endStr.substring(4, 6)) - 1, endStr.substring(6, 8));

  const daysDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

  if (daysDiff <= 30) {
    return 'quick'; // 30 days or less
  } else if (daysDiff <= 365) {
    return 'standard'; // Up to 1 year
  } else {
    return 'heavy'; // More than 1 year
  }
};
