/*!
 * Banking.js Caching Example
 * Demonstrates sophisticated caching functionality for banking operations
 */

const Banking = require('../index');

// Example banking configuration
const bankConfig = {
  fid: 12345,
  fidOrg: 'Example Bank',
  url: 'https://banking.example.com/ofxpath',
  bankId: '123456789',
  user: 'your_username',
  password: 'your_password',
  accId: 'CHK123456',
  accType: 'CHECKING'
};

async function demonstrateCaching() {
  console.log('=== Banking.js Caching Example ===\n');

  // 1. Configure sophisticated caching
  console.log('1. Configuring cache with production-ready settings...');
  const cacheConfig = Banking.configureCache({
    enabled: true,
    maxSize: 1000,
    defaultTTL: 300000, // 5 minutes

    // Operation-specific caching with different TTL strategies
    operationTTL: {
      // Account information - cache for 10 minutes
      accounts: {
        ttl: 600000, // 10 minutes
        enabled: true,
        maxEntries: 50
      },

      // Balance information - cache for 2 minutes (more real-time)
      balance: {
        ttl: 120000, // 2 minutes
        enabled: true,
        maxEntries: 100
      },

      // Transaction statements - smart caching based on data age
      statement: {
        ttl: 300000, // 5 minutes default
        enabled: true,
        maxEntries: 200,
        dynamicTTL: {
          // Historical data (older than 30 days) - cache for 1 hour
          historical: 3600000, // 1 hour
          // Recent data (last 30 days) - cache for 5 minutes
          recent: 300000, // 5 minutes
          // Real-time data (today) - cache for 1 minute
          realtime: 60000 // 1 minute
        }
      },

      // Institution metadata - cache for 24 hours
      institution: {
        ttl: 86400000, // 24 hours
        enabled: true,
        maxEntries: 20
      }
    },

    // PCI-compliant security settings
    security: {
      encryptSensitiveData: true,
      useSecureKeys: true,
      sensitiveFields: ['password', 'user', 'accId', 'pin', 'ssn', 'credentials']
    },

    // Performance monitoring
    metrics: {
      enabled: true,
      trackHitRate: true,
      trackResponseTime: true,
      trackMemoryUsage: true,
      metricsInterval: 60000 // Report every minute
    }
  });

  console.log('Cache configured with settings:');
  console.log(`- Max size: ${cacheConfig.maxSize} entries`);
  console.log(`- Default TTL: ${cacheConfig.defaultTTL / 1000} seconds`);
  console.log(`- Security: ${cacheConfig.security.encryptSensitiveData ? 'Enabled' : 'Disabled'}`);
  console.log(`- Metrics: ${cacheConfig.metrics.enabled ? 'Enabled' : 'Disabled'}\n`);

  // 2. Initialize banking client
  console.log('2. Initializing banking client...');
  const _banking = new Banking(bankConfig);
  console.log('Banking client ready\n');

  // 3. Demonstrate caching with simulated banking operations
  console.log('3. Demonstrating caching behavior...\n');

  // Simulate account list caching
  console.log('🏦 Account List Caching:');
  console.log('- First request will be cached for 10 minutes');
  console.log('- Subsequent requests within TTL will be served from cache');
  console.log('- Cache keys use secure hashing to protect sensitive data\n');

  // Simulate statement caching with different date ranges
  console.log('📊 Statement Caching with Dynamic TTL:');

  // Today's data (real-time)
  const today = new Date();
  const todayStr =
    today.getFullYear() + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');

  console.log(`- Today's data (${todayStr}): 1 minute cache (real-time)`);

  // Recent data (last 30 days)
  const recent = new Date();
  recent.setDate(recent.getDate() - 15);
  const recentStr =
    recent.getFullYear() + String(recent.getMonth() + 1).padStart(2, '0') + String(recent.getDate()).padStart(2, '0');

  console.log(`- Recent data (${recentStr}): 5 minutes cache`);

  // Historical data (older than 30 days)
  const historical = new Date();
  historical.setDate(historical.getDate() - 60);
  const historicalStr =
    historical.getFullYear() +
    String(historical.getMonth() + 1).padStart(2, '0') +
    String(historical.getDate()).padStart(2, '0');

  console.log(`- Historical data (${historicalStr}): 1 hour cache\n`);

  // 4. Monitor cache performance
  console.log('4. Cache Performance Monitoring:');

  function displayMetrics() {
    const metrics = Banking.getCacheMetrics();
    if (metrics) {
      console.log(`📈 Cache Metrics:`);
      console.log(`   Hit Rate: ${metrics.performance.hitRate}%`);
      console.log(
        `   Cache Size: ${metrics.cache.size}/${metrics.cache.maxSize} (${metrics.cache.utilizationPercent}%)`
      );
      console.log(`   Requests: ${metrics.requests.hits} hits, ${metrics.requests.misses} misses`);
      console.log(`   Average Response Time: ${metrics.performance.averageResponseTime}ms`);
      console.log(`   Uptime: ${Math.round(metrics.uptime / 1000)}s`);
    }
  }

  displayMetrics();
  console.log();

  // 5. Demonstrate cache operations
  console.log('5. Cache Management Operations:\n');

  // Cache invalidation examples
  console.log('🔄 Cache Invalidation:');
  console.log('- Invalidate all account data when user changes settings');
  const accountsInvalidated = Banking.invalidateCache('accounts');
  console.log(`   Invalidated ${accountsInvalidated} account cache entries`);

  console.log('- Invalidate specific statement when real-time update needed');
  const statementParams = {
    fid: bankConfig.fid,
    accId: bankConfig.accId,
    start: todayStr,
    end: todayStr
  };
  const statementInvalidated = Banking.invalidateCache('statement', statementParams);
  console.log(`   Invalidated ${statementInvalidated} specific statement cache entries`);

  // Clear all cache
  console.log('- Clear all cached data during maintenance');
  const totalCleared = Banking.clearCache();
  console.log(`   Cleared ${totalCleared} total cache entries\n`);

  // 6. Security and compliance features
  console.log('6. Security and PCI Compliance:\n');
  console.log('🔒 Security Features:');
  console.log('- Sensitive data encrypted in cache using AES-256');
  console.log('- Cache keys use SHA-256 hashing to protect account numbers');
  console.log('- No plaintext passwords or account details in cache keys');
  console.log('- Automatic secure key generation with salts');
  console.log('- Configurable sensitive field detection');
  console.log('- TTL-based automatic data expiration\n');

  // 7. Production recommendations
  console.log('7. Production Deployment Recommendations:\n');
  console.log('⚡ Performance Optimization:');
  console.log('- Use Redis for distributed caching in multi-server environments');
  console.log('- Configure cache warming for frequently accessed data');
  console.log('- Monitor hit rates and adjust TTL values based on usage patterns');
  console.log('- Set appropriate cache size limits based on available memory\n');

  console.log('🛡️  Security Best Practices:');
  console.log('- Enable encryption for all sensitive cached data');
  console.log('- Regularly rotate encryption keys in production');
  console.log('- Monitor cache access patterns for anomalies');
  console.log('- Implement cache isolation per user/session when needed\n');

  console.log('📊 Monitoring and Alerting:');
  console.log('- Set up alerts for low hit rates (< 70%)');
  console.log('- Monitor cache memory usage and eviction rates');
  console.log('- Track response time improvements from caching');
  console.log('- Log cache errors for debugging and optimization\n');

  // 8. Example configuration for different environments
  console.log('8. Environment-Specific Configurations:\n');

  console.log('🚀 Production Configuration:');
  console.log('```javascript');
  console.log('Banking.configureCache({');
  console.log('  enabled: true,');
  console.log('  maxSize: 5000,');
  console.log('  storage: {');
  console.log('    type: "redis",');
  console.log('    options: {');
  console.log('      redis: {');
  console.log('        host: "redis.banking.internal",');
  console.log('        port: 6379,');
  console.log('        keyPrefix: "banking:cache:"');
  console.log('      }');
  console.log('    }');
  console.log('  },');
  console.log('  security: {');
  console.log('    encryptSensitiveData: true,');
  console.log('    useSecureKeys: true');
  console.log('  },');
  console.log('  warming: {');
  console.log('    enabled: true,');
  console.log('    preloadAccounts: true');
  console.log('  }');
  console.log('});');
  console.log('```\n');

  console.log('🧪 Development Configuration:');
  console.log('```javascript');
  console.log('Banking.configureCache({');
  console.log('  enabled: true,');
  console.log('  maxSize: 100,');
  console.log('  defaultTTL: 60000, // Shorter TTL for testing');
  console.log('  storage: { type: "memory" },');
  console.log('  security: {');
  console.log('    encryptSensitiveData: false, // Disable for easier debugging');
  console.log('    useSecureKeys: true');
  console.log('  }');
  console.log('});');
  console.log('```\n');

  // Final metrics display
  console.log('9. Final Cache State:');
  displayMetrics();

  // Cleanup
  console.log('\n10. Cleanup:');
  Banking.destroyPool();
  console.log('✅ All resources cleaned up');

  console.log('\n=== Caching Example Complete ===');
}

// Example error handling
function handleCacheErrors() {
  console.log('\n=== Cache Error Handling Example ===\n');

  try {
    // Configure cache with error monitoring
    Banking.configureCache({
      enabled: true,
      metrics: { enabled: true }
    });

    // Monitor for cache errors
    const metrics = Banking.getCacheMetrics();
    if (metrics && metrics.errors) {
      const totalErrors = Object.values(metrics.errors).reduce((sum, count) => sum + count, 0);

      if (totalErrors > 0) {
        console.log(`⚠️  Cache errors detected: ${totalErrors} total`);
        console.log('Consider:');
        console.log('- Checking cache storage accessibility');
        console.log('- Reviewing cache configuration');
        console.log('- Monitoring memory usage');
        console.log('- Temporarily disabling cache if issues persist');
      } else {
        console.log('✅ No cache errors detected');
      }
    }
  } catch (error) {
    console.log(`❌ Cache configuration error: ${error.message}`);
    console.log('Falling back to no caching...');

    // Disable caching on error
    Banking.configureCache({ enabled: false });
  }
}

// Run the examples
if (require.main === module) {
  demonstrateCaching()
    .then(() => handleCacheErrors())
    .catch(console.error);
}

module.exports = {
  demonstrateCaching,
  handleCacheErrors
};
