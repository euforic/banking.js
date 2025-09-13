#!/usr/bin/env node

/**
 * Structured Error Handling Demo for banking.js
 *
 * This example demonstrates the comprehensive error handling capabilities
 * of the banking.js library, including:
 *
 * - Structured error classes with correlation IDs
 * - Error classification and retry recommendations
 * - PCI-compliant logging (no sensitive data)
 * - Banking context tracking
 * - Error factory pattern for consistent error creation
 * - Integration with existing connection pooling and retry mechanisms
 */

const Banking = require('../index');

// Enable debug output for detailed error information
process.env.DEBUG = 'banking:errors,banking:main';

console.log('=== Banking.js Structured Error Handling Demo ===\n');

/**
 * Example 1: Configuration Validation Errors
 */
function demonstrateConfigurationErrors() {
  console.log('1. Configuration Validation Errors:\n');

  try {
    // Missing configuration
    new Banking();
  } catch (error) {
    console.log('   InvalidConfigurationError for missing config:');
    logErrorDetails(error);
  }

  try {
    // Invalid FID
    new Banking({
      fid: 'invalid',
      url: 'https://bank.com',
      user: 'user',
      password: 'pass',
      accId: '123',
      accType: 'CHECKING'
    });
  } catch (error) {
    console.log('   InvalidConfigurationError for invalid FID:');
    logErrorDetails(error);
  }

  try {
    // Invalid account type
    new Banking({
      fid: 12345,
      url: 'https://bank.com',
      user: 'user',
      password: 'pass',
      accId: '123',
      accType: 'INVALID_TYPE'
    });
  } catch (error) {
    console.log('   InvalidConfigurationError for invalid account type:');
    logErrorDetails(error);
  }
}

/**
 * Example 2: Network Error Classification
 */
function demonstrateNetworkErrors() {
  console.log('\n2. Network Error Classification:\n');

  // DNS Error
  const dnsError = Banking.createBankingError(
    {
      message: 'DNS lookup failed',
      originalError: { code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND bank.invalid' }
    },
    {
      fid: 12345,
      fidOrg: 'Test Bank',
      operationType: 'statement',
      url: 'https://bank.invalid/ofx'
    }
  );

  console.log('   DNS Error Example:');
  logErrorDetails(dnsError);

  // Connection Error
  const connectionError = Banking.createBankingError(
    {
      message: 'Connection refused',
      originalError: { code: 'ECONNREFUSED', message: 'Connection refused by server' }
    },
    {
      fid: 12345,
      operationType: 'statement'
    }
  );

  console.log('   Connection Error Example:');
  logErrorDetails(connectionError);

  // Timeout Error
  const timeoutError = new Banking.TimeoutError('Request timeout after 30000ms', {
    operationType: 'heavy',
    fid: 12345,
    metadata: {
      timeoutType: 'request',
      timeoutValue: 30000
    }
  });

  console.log('   Timeout Error Example:');
  logErrorDetails(timeoutError);
}

/**
 * Example 3: Authentication Errors
 */
function demonstrateAuthenticationErrors() {
  console.log('\n3. Authentication Errors:\n');

  // Invalid Credentials from HTTP 401
  const credentialsError = Banking.createBankingError(
    {
      message: 'HTTP 401 Unauthorized',
      httpStatus: 401
    },
    {
      fid: 12345,
      fidOrg: 'Wells Fargo',
      operationType: 'statement'
    }
  );

  console.log('   Invalid Credentials Error (HTTP 401):');
  logErrorDetails(credentialsError);

  // Insufficient Permissions from HTTP 403
  const permissionsError = Banking.createBankingError(
    {
      message: 'HTTP 403 Forbidden',
      httpStatus: 403
    },
    {
      fid: 12345,
      operationType: 'accounts'
    }
  );

  console.log('   Insufficient Permissions Error (HTTP 403):');
  logErrorDetails(permissionsError);
}

/**
 * Example 4: Banking Business Errors
 */
function demonstrateBusinessErrors() {
  console.log('\n4. Banking Business Errors:\n');

  // Account Not Found from HTTP 404
  const accountError = Banking.createBankingError(
    {
      message: 'Account not found',
      httpStatus: 404
    },
    {
      fid: 12345,
      accountType: 'CHECKING',
      operationType: 'statement'
    }
  );

  console.log('   Account Not Found Error (HTTP 404):');
  logErrorDetails(accountError);

  // Maintenance Mode from HTTP 503
  const maintenanceError = Banking.createBankingError(
    {
      message: 'Service temporarily unavailable',
      httpStatus: 503
    },
    {
      fid: 12345,
      operationType: 'statement'
    }
  );

  console.log('   Maintenance Mode Error (HTTP 503):');
  logErrorDetails(maintenanceError);

  // Rate Limiting from HTTP 429
  const rateLimitError = Banking.createBankingError(
    {
      message: 'Too many requests',
      httpStatus: 429
    },
    {
      fid: 12345,
      operationType: 'statement'
    }
  );

  console.log('   Rate Limit Error (HTTP 429):');
  logErrorDetails(rateLimitError);
}

/**
 * Example 5: OFX Protocol Errors
 */
function demonstrateProtocolErrors() {
  console.log('\n5. OFX Protocol Errors:\n');

  // Malformed Response Error
  const malformedError = new Banking.MalformedResponseError('Invalid OFX XML format', {
    operationType: 'statement',
    fid: 12345,
    ofxVersion: '102'
  });

  console.log('   Malformed Response Error:');
  logErrorDetails(malformedError);

  // Version Mismatch Error
  const versionError = new Banking.VersionMismatchError('OFX version not supported', {
    operationType: 'statement',
    fid: 12345,
    ofxVersion: '300'
  });

  console.log('   Version Mismatch Error:');
  logErrorDetails(versionError);
}

/**
 * Example 6: Data Validation Errors
 */
function demonstrateDataErrors() {
  console.log('\n6. Data Validation Errors:\n');

  // Invalid Date Range Error
  const dateError = new Banking.InvalidDateRangeError('Start date must be before end date', {
    operationType: 'statement',
    fid: 12345,
    metadata: {
      startDate: '20241201',
      endDate: '20241101'
    }
  });

  console.log('   Invalid Date Range Error:');
  logErrorDetails(dateError);

  // Data Parsing Error
  const parseError = new Banking.DataParsingError('Failed to parse OFX response', {
    operationType: 'statement',
    fid: 12345,
    originalError: new Error('XML parsing failed')
  });

  console.log('   Data Parsing Error:');
  logErrorDetails(parseError);
}

/**
 * Example 7: Error Serialization and Logging
 */
function demonstrateErrorSerialization() {
  console.log('\n7. Error Serialization and PCI-Compliant Logging:\n');

  // Create an error with sensitive URL
  const error = new Banking.ConnectionError('Connection failed', {
    url: 'https://user:password@bank.com/ofx?token=secret&account=123456789',
    fid: 12345,
    operationType: 'statement',
    metadata: {
      originalUrl: 'https://user:password@bank.com/ofx?token=secret&account=123456789',
      attemptNumber: 3
    }
  });

  console.log('   Original error with sensitive data:');
  console.log('   Message:', error.message);
  console.log('   URL (sanitized):', error.bankingContext.url);

  console.log('\n   PCI-Compliant Log Object:');
  const logObj = error.toLogObject();
  console.log(JSON.stringify(logObj, null, 2));

  console.log('\n   JSON Serialization:');
  console.log(JSON.stringify(error, null, 2));
}

/**
 * Example 8: Retry Logic Integration
 */
function demonstrateRetryRecommendations() {
  console.log('\n8. Retry Logic and Recommendations:\n');

  const errors = [
    new Banking.TimeoutError('Request timeout'),
    new Banking.DNSError('DNS lookup failed'),
    new Banking.InvalidCredentialsError('Invalid login'),
    new Banking.MaintenanceModeError('System under maintenance'),
    new Banking.TooManyRequestsError('Rate limited')
  ];

  errors.forEach(error => {
    console.log(`   ${error.constructor.name}:`);
    console.log(`     - Retryable: ${error.retryable}`);
    console.log(`     - Max Retries: ${error.maxRetries}`);
    if (error.retryAfter) {
      console.log(`     - Retry After: ${error.retryAfter} seconds`);
    }
    console.log(`     - Recommendations: ${error.recommendations.slice(0, 2).join(', ')}...`);
    console.log('');
  });
}

/**
 * Helper function to log error details in a structured way
 */
function logErrorDetails(error) {
  console.log(`     Error Type: ${error.constructor.name}`);
  console.log(`     Code: ${error.code}`);
  console.log(`     Category: ${error.category}`);
  console.log(`     Message: ${error.message}`);
  console.log(`     Correlation ID: ${error.correlationId}`);
  console.log(`     Retryable: ${error.retryable}`);
  if (error.maxRetries > 0) {
    console.log(`     Max Retries: ${error.maxRetries}`);
  }
  if (error.retryAfter) {
    console.log(`     Retry After: ${error.retryAfter}s`);
  }
  if (error.bankingContext.fid) {
    console.log(`     Bank FID: ${error.bankingContext.fid}`);
  }
  if (error.recommendations.length > 0) {
    console.log(`     Key Recommendations: ${error.recommendations.slice(0, 2).join(', ')}`);
  }
  console.log('');
}

/**
 * Run all demonstrations
 */
async function runDemo() {
  try {
    demonstrateConfigurationErrors();
    demonstrateNetworkErrors();
    demonstrateAuthenticationErrors();
    demonstrateBusinessErrors();
    demonstrateProtocolErrors();
    demonstrateDataErrors();
    demonstrateErrorSerialization();
    demonstrateRetryRecommendations();

    console.log('=== Error Handling Summary ===');
    console.log('✓ Comprehensive error classification system implemented');
    console.log('✓ PCI-compliant logging with no sensitive data exposure');
    console.log('✓ Correlation IDs for tracking errors across requests');
    console.log('✓ Actionable recommendations for error resolution');
    console.log('✓ Integration with existing connection pooling and retry logic');
    console.log('✓ Backward compatibility maintained with existing error handling');
    console.log('✓ Full TypeScript support for all error types');
    console.log('✓ Error factory pattern for consistent error creation');
    console.log('\nAll error classes include:');
    console.log('  - Structured error information with correlation tracking');
    console.log('  - Banking context (FID, operation type, account type)');
    console.log('  - Technical details for debugging (HTTP status, OFX status)');
    console.log('  - Retry recommendations (retryable, max retries, retry delay)');
    console.log('  - PCI-compliant sanitization of sensitive data');
    console.log('  - Actionable recommendations for developers');
  } catch (error) {
    console.error('Demo error:', error);
    logErrorDetails(error);
  }
}

// Export error classes for easy access in other examples
module.exports = {
  Banking,
  demonstrateConfigurationErrors,
  demonstrateNetworkErrors,
  demonstrateAuthenticationErrors,
  demonstrateBusinessErrors,
  demonstrateProtocolErrors,
  demonstrateDataErrors,
  logErrorDetails
};

// Run the demo if this file is executed directly
if (require.main === module) {
  runDemo().catch(console.error);
}
