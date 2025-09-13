/*!
 * Structured Error Classes for banking.js
 * Provides comprehensive error handling and classification for banking operations
 */

const debug = require('debug')('banking:errors');

/**
 * Generate a simple UUID for correlation IDs
 * @param {number} len - Length of the UUID
 * @returns {string} - Generated UUID
 */
function generateCorrelationId(len = 16) {
  const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
  const chars = CHARS;
  const uuid = [];

  for (let i = 0; i < len; i++) {
    uuid[i] = chars[Math.floor(Math.random() * chars.length)];
  }

  return uuid.join('');
}

/**
 * Base error class for all banking operations
 * Provides structured error information, correlation IDs, and PCI-compliant logging
 */
class BankingError extends Error {
  constructor(message, options = {}) {
    super(message);

    // Set error name and maintain prototype chain
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);

    // Core error properties
    this.code = options.code || 'BANKING_ERROR';
    this.correlationId = options.correlationId || generateCorrelationId(16);
    this.timestamp = options.timestamp || new Date().toISOString();
    this.category = options.category || 'UNKNOWN';

    // Classification and retry information
    this.retryable = options.retryable !== undefined ? options.retryable : false;
    this.retryAfter = options.retryAfter || null;
    this.maxRetries = options.maxRetries || 0;

    // Context information (PCI-compliant - no sensitive data)
    this.bankingContext = {
      fid: options.fid || null,
      fidOrg: options.fidOrg || null,
      operationType: options.operationType || null,
      accountType: options.accountType || null,
      // Never include account numbers, credentials, or transaction details
      url: options.url ? this._sanitizeUrl(options.url) : null
    };

    // Technical details for debugging
    this.technicalDetails = {
      originalError: options.originalError || null,
      httpStatus: options.httpStatus || null,
      ofxStatus: options.ofxStatus || null,
      requestId: options.requestId || null,
      userAgent: options.userAgent || 'banking-js',
      ofxVersion: options.ofxVersion || null
    };

    // Recommendations for resolution
    this.recommendations = options.recommendations || [];

    // Additional metadata
    this.metadata = options.metadata || {};

    debug('BankingError created:', {
      name: this.name,
      code: this.code,
      correlationId: this.correlationId,
      category: this.category,
      retryable: this.retryable
    });
  }

  /**
   * Sanitize URL to remove sensitive query parameters or credentials
   * @private
   */
  _sanitizeUrl(url) {
    try {
      const urlObj = new URL(url);
      // Remove any query parameters that might contain sensitive data
      urlObj.search = '';
      // Remove user info if present
      urlObj.username = '';
      urlObj.password = '';
      return urlObj.toString();
    } catch (e) {
      return '[INVALID_URL]';
    }
  }

  /**
   * Get a sanitized version of the error for logging (PCI compliant)
   */
  toLogObject() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      correlationId: this.correlationId,
      timestamp: this.timestamp,
      category: this.category,
      retryable: this.retryable,
      bankingContext: {
        fid: this.bankingContext.fid,
        fidOrg: this.bankingContext.fidOrg,
        operationType: this.bankingContext.operationType,
        accountType: this.bankingContext.accountType,
        url: this.bankingContext.url
      },
      technicalDetails: {
        httpStatus: this.technicalDetails.httpStatus,
        ofxStatus: this.technicalDetails.ofxStatus,
        requestId: this.technicalDetails.requestId,
        userAgent: this.technicalDetails.userAgent,
        ofxVersion: this.technicalDetails.ofxVersion
      },
      recommendations: this.recommendations
    };
  }

  /**
   * Get JSON representation of the error
   */
  toJSON() {
    return this.toLogObject();
  }
}

/**
 * Network-related errors
 */
class NetworkError extends BankingError {
  constructor(message, options = {}) {
    super(message, { ...options, category: 'NETWORK' });
    this.retryable = options.retryable !== undefined ? options.retryable : true;
    this.maxRetries = options.maxRetries || 3;
  }
}

class ConnectionError extends NetworkError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'CONNECTION_ERROR' });
    this.recommendations = [
      'Check network connectivity',
      'Verify firewall settings',
      'Ensure the banking server is accessible',
      'Try again in a few moments'
    ];
  }
}

class TimeoutError extends NetworkError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'TIMEOUT_ERROR' });
    this.retryable = true;
    this.maxRetries = 2; // Fewer retries for timeouts
    this.recommendations = [
      'Increase timeout values for the operation type',
      'Check network latency to the banking server',
      'Consider reducing the date range for large requests',
      'Retry the operation'
    ];
  }
}

class DNSError extends NetworkError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'DNS_ERROR' });
    this.retryable = false; // DNS errors usually indicate configuration issues
    this.maxRetries = 0; // DNS errors shouldn't be retried
    this.recommendations = [
      'Verify the banking server URL is correct',
      'Check DNS configuration',
      'Ensure network connectivity',
      'Contact the financial institution for correct server details'
    ];
  }
}

class CertificateError extends NetworkError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'CERTIFICATE_ERROR' });
    this.retryable = false;
    this.recommendations = [
      'Verify SSL certificate configuration',
      'Check if rejectUnauthorized should be disabled (not recommended for production)',
      'Ensure system clock is correct',
      'Contact the financial institution about certificate issues'
    ];
  }
}

/**
 * Authentication and authorization errors
 */
class AuthenticationError extends BankingError {
  constructor(message, options = {}) {
    super(message, { ...options, category: 'AUTHENTICATION' });
    this.retryable = false; // Authentication errors usually require user intervention
  }
}

class InvalidCredentialsError extends AuthenticationError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'INVALID_CREDENTIALS' });
    this.recommendations = [
      'Verify username and password are correct',
      'Check if account is locked or suspended',
      'Ensure account has OFX access enabled',
      'Contact the financial institution if credentials are correct'
    ];
  }
}

class ExpiredSessionError extends AuthenticationError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'EXPIRED_SESSION' });
    this.retryable = true;
    this.maxRetries = 1;
    this.recommendations = [
      'Reauthenticate with fresh credentials',
      'Clear any cached session data',
      'Retry the operation with new authentication'
    ];
  }
}

class InsufficientPermissionsError extends AuthenticationError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'INSUFFICIENT_PERMISSIONS' });
    this.recommendations = [
      'Verify account has OFX download permissions',
      'Check with the financial institution about account access',
      'Ensure account type supports the requested operation'
    ];
  }
}

/**
 * Banking-specific business logic errors
 */
class BankingBusinessError extends BankingError {
  constructor(message, options = {}) {
    super(message, { ...options, category: 'BANKING_BUSINESS' });
  }
}

class AccountNotFoundError extends BankingBusinessError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'ACCOUNT_NOT_FOUND' });
    this.recommendations = [
      'Verify the account ID/number is correct',
      'Check if the account type matches the actual account',
      'Ensure the account is active and not closed',
      'Verify bank routing number (for bank accounts)'
    ];
  }
}

class InsufficientFundsError extends BankingBusinessError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'INSUFFICIENT_FUNDS' });
    this.recommendations = [
      'Check account balance',
      'Verify transaction amount',
      'Consider overdraft protection settings'
    ];
  }
}

class MaintenanceModeError extends BankingBusinessError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'MAINTENANCE_MODE' });
    this.retryable = true;
    this.maxRetries = 1;
    this.retryAfter = options.retryAfter || 3600; // Retry after 1 hour by default
    this.recommendations = [
      'Wait for maintenance window to complete',
      "Check the financial institution's website for maintenance schedules",
      'Retry the operation later',
      'Consider using alternative banking channels temporarily'
    ];
  }
}

class DailyLimitExceededError extends BankingBusinessError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'DAILY_LIMIT_EXCEEDED' });
    this.retryable = true;
    this.retryAfter = 86400; // Retry after 24 hours
    this.recommendations = [
      'Wait until the next business day',
      'Contact the financial institution to increase limits',
      'Split large requests into smaller date ranges'
    ];
  }
}

/**
 * OFX protocol-specific errors
 */
class OFXProtocolError extends BankingError {
  constructor(message, options = {}) {
    super(message, { ...options, category: 'OFX_PROTOCOL' });
  }
}

class MalformedResponseError extends OFXProtocolError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'MALFORMED_RESPONSE' });
    this.retryable = true;
    this.maxRetries = 2;
    this.recommendations = [
      'Check OFX version compatibility',
      'Verify the financial institution supports the requested OFX version',
      'Try with a different OFX version',
      'Contact the financial institution about response format issues'
    ];
  }
}

class VersionMismatchError extends OFXProtocolError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'VERSION_MISMATCH' });
    this.retryable = true;
    this.maxRetries = 1;
    this.recommendations = [
      'Update to a supported OFX version',
      "Check the financial institution's supported OFX versions",
      'Try with OFX version 1.0.2 or 2.0.3',
      'Verify application version compatibility'
    ];
  }
}

class InvalidOFXHeaderError extends OFXProtocolError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'INVALID_OFX_HEADER' });
    this.recommendations = [
      'Check OFX header format',
      'Verify required header fields are present',
      'Ensure proper encoding and character set',
      'Validate against OFX specification'
    ];
  }
}

/**
 * Rate limiting and throttling errors
 */
class RateLimitError extends BankingError {
  constructor(message, options = {}) {
    super(message, { ...options, category: 'RATE_LIMIT', code: 'RATE_LIMITED' });
    this.retryable = true;
    this.maxRetries = 3;
    this.retryAfter = options.retryAfter || 60; // Default 1 minute
    this.recommendations = [
      'Reduce request frequency',
      'Implement exponential backoff',
      'Check rate limiting policies with the financial institution',
      'Consider batching requests'
    ];
  }
}

class TooManyRequestsError extends RateLimitError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'TOO_MANY_REQUESTS' });
    this.retryAfter = options.retryAfter || 300; // 5 minutes
    this.recommendations = [
      'Wait before making additional requests',
      'Implement request queuing with delays',
      'Contact the financial institution about rate limits',
      'Spread requests across multiple connections if allowed'
    ];
  }
}

/**
 * Configuration and setup errors
 */
class ConfigurationError extends BankingError {
  constructor(message, options = {}) {
    super(message, { ...options, category: 'CONFIGURATION' });
    this.retryable = false; // Configuration errors require code changes
  }
}

class InvalidConfigurationError extends ConfigurationError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'INVALID_CONFIGURATION' });
    this.recommendations = [
      'Verify all required configuration parameters',
      'Check parameter formats and types',
      'Ensure FID and bank ID are correct',
      'Validate URL format and accessibility'
    ];
  }
}

class MissingParameterError extends ConfigurationError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'MISSING_PARAMETER' });
    this.recommendations = [
      'Provide all required parameters',
      'Check documentation for required fields',
      'Verify parameter names are spelled correctly'
    ];
  }
}

/**
 * Data validation and parsing errors
 */
class DataError extends BankingError {
  constructor(message, options = {}) {
    super(message, { ...options, category: 'DATA' });
  }
}

class InvalidDateRangeError extends DataError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'INVALID_DATE_RANGE' });
    this.recommendations = [
      'Ensure start date is before end date',
      'Use YYYYMMDD or YYYYMMDDHHMMSS format',
      'Check date range limits imposed by the financial institution',
      'Verify dates are not in the future'
    ];
  }
}

class DataParsingError extends DataError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'DATA_PARSING_ERROR' });
    this.retryable = true;
    this.maxRetries = 1;
    this.recommendations = [
      'Check data format and encoding',
      'Verify character set compatibility',
      'Try parsing with different options',
      'Contact support if data appears corrupted'
    ];
  }
}

/**
 * Cache-related errors
 * Used for cache operations, storage issues, and cache configuration problems
 */
class CacheError extends BankingError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'CACHE_ERROR',
      category: 'CACHE'
    });
    this.retryable = options.retryable !== undefined ? options.retryable : false;
    this.maxRetries = options.maxRetries || 0;
    this.recommendations = options.recommendations || [
      'Check cache configuration',
      'Verify cache storage accessibility',
      'Consider disabling cache temporarily',
      'Review cache memory limits'
    ];
  }
}

/**
 * Error factory function to create appropriate error types
 */
function createBankingError(errorInfo, options = {}) {
  const { code, message, httpStatus, originalError } = errorInfo;

  // Map common Node.js error codes to banking error types
  if (originalError) {
    const nodeErrorCode = originalError.code;
    const nodeMessage = originalError.message || message;

    switch (nodeErrorCode) {
      case 'ENOTFOUND':
      case 'EAI_NODATA':
      case 'EAI_NONAME':
        return new DNSError(nodeMessage, { ...options, originalError });

      case 'ECONNREFUSED':
      case 'ECONNRESET':
      case 'ENETUNREACH':
      case 'EHOSTUNREACH':
        return new ConnectionError(nodeMessage, { ...options, originalError });

      case 'ETIMEDOUT':
      case 'ESOCKETTIMEDOUT':
        return new TimeoutError(nodeMessage, { ...options, originalError });

      case 'CERT_SIGNATURE_FAILURE':
      case 'CERT_NOT_YET_VALID':
      case 'CERT_HAS_EXPIRED':
      case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
        return new CertificateError(nodeMessage, { ...options, originalError });
    }
  }

  // Map HTTP status codes
  if (httpStatus) {
    switch (httpStatus) {
      case 401:
        return new InvalidCredentialsError(message, { ...options, httpStatus });
      case 403:
        return new InsufficientPermissionsError(message, { ...options, httpStatus });
      case 404:
        return new AccountNotFoundError(message, { ...options, httpStatus });
      case 429:
        return new TooManyRequestsError(message, { ...options, httpStatus });
      case 503:
        return new MaintenanceModeError(message, { ...options, httpStatus });
    }
  }

  // Map by error code
  switch (code) {
    case 'INVALID_CREDENTIALS':
      return new InvalidCredentialsError(message, options);
    case 'ACCOUNT_NOT_FOUND':
      return new AccountNotFoundError(message, options);
    case 'MALFORMED_RESPONSE':
      return new MalformedResponseError(message, options);
    case 'RATE_LIMITED':
      return new RateLimitError(message, options);
    case 'INVALID_CONFIGURATION':
      return new InvalidConfigurationError(message, options);
    default:
      return new BankingError(message, { ...options, code });
  }
}

// Export all error classes
module.exports = {
  // Base error
  BankingError,

  // Network errors
  NetworkError,
  ConnectionError,
  TimeoutError,
  DNSError,
  CertificateError,

  // Authentication errors
  AuthenticationError,
  InvalidCredentialsError,
  ExpiredSessionError,
  InsufficientPermissionsError,

  // Banking business errors
  BankingBusinessError,
  AccountNotFoundError,
  InsufficientFundsError,
  MaintenanceModeError,
  DailyLimitExceededError,

  // OFX protocol errors
  OFXProtocolError,
  MalformedResponseError,
  VersionMismatchError,
  InvalidOFXHeaderError,

  // Rate limiting errors
  RateLimitError,
  TooManyRequestsError,

  // Configuration errors
  ConfigurationError,
  InvalidConfigurationError,
  MissingParameterError,

  // Data errors
  DataError,
  InvalidDateRangeError,
  DataParsingError,

  // Cache errors
  CacheError,

  // Factory function
  createBankingError
};
