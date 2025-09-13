#!/usr/bin/env node

/*!
 * Banking.js Timeout and Retry Configuration Examples
 *
 * This example demonstrates how to configure comprehensive timeout and retry
 * logic for banking operations to improve reliability and handle various
 * failure scenarios gracefully.
 */

const Banking = require('../index.js');

console.log('Banking.js Timeout and Retry Configuration Examples');
console.log('===================================================\n');

// Example 1: Basic Pool Configuration with Timeouts and Retries
console.log('1. Basic Configuration');
console.log('----------------------');

const basicConfig = Banking.configurePool({
  // Connection pool settings
  pool: {
    maxSockets: 5,
    maxFreeSockets: 2,
    keepAlive: true,
    keepAliveMsecs: 30000
  },

  // Operation-specific timeout configuration
  timeouts: {
    quick: {
      connection: 5000, // 5 seconds to establish connection
      request: 15000, // 15 seconds total request timeout
      socket: 10000, // 10 seconds socket idle timeout
      idle: 30000 // 30 seconds keep-alive timeout
    },
    standard: {
      connection: 10000, // 10 seconds to establish connection
      request: 60000, // 1 minute total request timeout
      socket: 30000, // 30 seconds socket idle timeout
      idle: 60000 // 1 minute keep-alive timeout
    },
    heavy: {
      connection: 15000, // 15 seconds to establish connection
      request: 180000, // 3 minutes total request timeout
      socket: 90000, // 90 seconds socket idle timeout
      idle: 120000 // 2 minutes keep-alive timeout
    }
  },

  // Retry configuration
  retry: {
    maxRetries: {
      quick: 3, // 3 retries for quick operations
      standard: 5, // 5 retries for standard operations
      heavy: 2 // 2 retries for heavy operations
    },
    baseDelay: 1000, // 1 second base delay
    maxDelay: 30000, // 30 second maximum delay
    backoffStrategy: 'exponential', // exponential backoff

    // Jitter configuration to prevent thundering herd
    jitter: {
      enabled: true,
      type: 'full', // full jitter randomization
      factor: 0.1
    },

    // Rate limiting to be respectful to banking servers
    rateLimiting: {
      enabled: true,
      maxConcurrent: 3, // Max 3 concurrent requests per host
      requestInterval: 500 // 500ms minimum between requests
    }
  }
});

console.log('Applied Configuration:', JSON.stringify(basicConfig, null, 2));
console.log();

// Example 2: Advanced Retry Configuration
console.log('2. Advanced Retry Configuration');
console.log('-------------------------------');

const advancedRetryConfig = Banking.configureRetry({
  maxRetries: {
    quick: 2,
    standard: 4,
    heavy: 1
  },
  baseDelay: 2000, // 2 second base delay
  maxDelay: 60000, // 1 minute maximum delay
  backoffStrategy: 'decorrelated', // decorrelated jitter backoff

  jitter: {
    enabled: true,
    type: 'decorrelated',
    factor: 0.2
  },

  // Custom retry conditions
  retryConditions: {
    networkErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'ENETUNREACH', 'EHOSTUNREACH'],
    httpStatusCodes: [408, 429, 500, 502, 503, 504, 507, 520, 521, 522, 523, 524],
    sslErrors: ['EPROTO', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_HAS_EXPIRED'],
    // Banking-specific OFX codes that should NOT be retried
    nonRetryableOFXCodes: [
      '15500', // Invalid credentials
      '15501', // Account in use
      '15502', // Invalid user ID
      '15503', // Invalid password
      '15505', // Password expired
      '10500', // Invalid account number
      '10401' // Account restricted
    ]
  }
});

console.log('Advanced Retry Configuration Applied:', JSON.stringify(advancedRetryConfig, null, 2));
console.log();

// Example 3: Custom Timeout Configuration
console.log('3. Custom Timeout Configuration');
console.log('-------------------------------');

const customTimeouts = Banking.configureTimeouts({
  quick: {
    connection: 3000, // 3 seconds
    request: 10000, // 10 seconds
    socket: 5000 // 5 seconds
  },
  standard: {
    connection: 8000, // 8 seconds
    request: 45000, // 45 seconds
    socket: 20000 // 20 seconds
  },
  heavy: {
    connection: 12000, // 12 seconds
    request: 300000, // 5 minutes
    socket: 120000 // 2 minutes
  }
});

console.log('Custom Timeouts Applied:', JSON.stringify(customTimeouts, null, 2));
console.log();

// Example 4: Creating Banking Instance with Configuration
console.log('4. Banking Instance with Custom Configuration');
console.log('--------------------------------------------');

// Wells Fargo example configuration
const wellsFargo = new Banking({
  fid: '3000',
  fidOrg: 'WF',
  url: 'https://www.oasis.cfree.com/3001.ofxgp',
  bankId: '123456789',
  user: 'your-username',
  password: 'your-password',
  accId: '987654321',
  accType: 'CHECKING',

  // Instance-specific timeout configuration
  timeoutConfig: {
    operationType: 'standard', // Default operation type for this instance
    customTimeouts: {
      connection: 8000,
      request: 45000,
      socket: 25000
    }
  },

  // Instance-specific retry configuration
  retryConfig: {
    maxRetries: 4,
    baseDelay: 1500,
    backoffStrategy: 'exponential'
  }
});

console.log('Wells Fargo Banking instance created with custom configuration');
console.log();

// Example 5: Monitoring Metrics
console.log('5. Monitoring and Metrics');
console.log('-------------------------');

// Function to demonstrate metrics collection
async function demonstrateMetrics() {
  console.log('Initial Metrics:');
  const initialPoolMetrics = Banking.getPoolMetrics();
  const initialRetryMetrics = Banking.getRetryMetrics();

  console.log('Pool Metrics:', JSON.stringify(initialPoolMetrics, null, 2));
  console.log('Retry Metrics:', JSON.stringify(initialRetryMetrics, null, 2));

  // Example of making a request (would normally be to actual bank)
  console.log('\nNote: In a real application, you would make banking requests here');
  console.log('and monitor the metrics to understand retry patterns and performance.\n');

  // Simulate some metrics for demonstration
  console.log('After banking operations, you might see metrics like:');
  console.log({
    poolMetrics: {
      totalRequests: 15,
      activeConnections: 0,
      poolHits: 12,
      poolMisses: 3,
      errors: 2,
      retries: 3,
      timeouts: 1,
      averageResponseTime: 2340,
      operationTypes: {
        quick: 8,
        standard: 6,
        heavy: 1
      }
    },
    retryMetrics: {
      totalAttempts: 18,
      successfulRetries: 3,
      failedRetries: 0,
      timeouts: 1,
      networkErrors: 2,
      httpErrors: 1,
      sslErrors: 0,
      ofxErrors: 0,
      averageAttempts: 1.2,
      retrySuccessRate: 1.0,
      averageDelay: 1850
    }
  });
}

// Example 6: Error Handling Strategies
console.log('6. Error Handling Best Practices');
console.log('--------------------------------');

function handleBankingErrors(error) {
  console.log('Error handling strategy based on error type:');

  if (error.code === 'ETIMEDOUT') {
    console.log('- Timeout Error: Consider increasing timeout for this operation type');
    console.log('- Or check if server is experiencing high load');
  } else if (error.code === 'ECONNRESET') {
    console.log('- Connection Reset: Network issue, likely to succeed on retry');
  } else if (error.statusCode === 429) {
    console.log('- Rate Limited: Back off requests, respect Retry-After header');
  } else if (error.statusCode >= 500) {
    console.log('- Server Error: Likely transient, good candidate for retry');
  } else if (error.ofxCode === '15500') {
    console.log('- OFX Invalid Credentials: Do not retry, fix authentication');
  } else if (error.ofxCode === '10500') {
    console.log('- OFX Invalid Account: Do not retry, check account number');
  } else {
    console.log('- Unknown Error: Log for analysis, may not be retryable');
  }

  return error;
}

// Example 7: Production Configuration Recommendations
console.log('7. Production Configuration Recommendations');
console.log('------------------------------------------');

const productionConfig = {
  // Conservative connection pooling for production
  pool: {
    maxSockets: 3, // Limit concurrent connections
    maxFreeSockets: 1, // Conservative keep-alive
    keepAlive: true,
    keepAliveMsecs: 60000 // 1 minute keep-alive
  },

  // Production timeouts - longer to accommodate bank server variance
  timeouts: {
    quick: {
      connection: 10000, // 10 seconds
      request: 30000, // 30 seconds
      socket: 20000 // 20 seconds
    },
    standard: {
      connection: 15000, // 15 seconds
      request: 120000, // 2 minutes
      socket: 60000 // 1 minute
    },
    heavy: {
      connection: 20000, // 20 seconds
      request: 300000, // 5 minutes
      socket: 180000 // 3 minutes
    }
  },

  // Conservative retry policy
  retry: {
    maxRetries: {
      quick: 2,
      standard: 3,
      heavy: 1 // Heavy operations get fewer retries
    },
    baseDelay: 2000, // 2 second base delay
    maxDelay: 60000, // 1 minute max delay
    backoffStrategy: 'exponential',

    jitter: {
      enabled: true,
      type: 'equal', // Balanced jitter
      factor: 0.1
    },

    // Respectful rate limiting
    rateLimiting: {
      enabled: true,
      maxConcurrent: 2, // Very conservative
      requestInterval: 1000 // 1 second between requests
    }
  }
};

console.log('Production Configuration:', JSON.stringify(productionConfig, null, 2));
console.log();

console.log('8. Clean Up');
console.log('-----------');

// Always clean up resources when shutting down
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  Banking.destroyPool();
  process.exit(0);
});

console.log('Banking.js timeout and retry configuration examples completed.');
console.log('Use Ctrl+C to exit and clean up resources.');

// Run the metrics demonstration
demonstrateMetrics();
