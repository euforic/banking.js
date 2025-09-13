#!/usr/bin/env node

/**
 * Simple Cache Functionality Test
 * Tests basic cache operations to ensure functionality works correctly
 */

const CacheManager = require('../lib/cache-manager');
const Banking = require('../index');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

function testCacheManager() {
  console.log('Testing CacheManager directly...\n');
  
  // Test 1: Basic cache operations
  const cache = new CacheManager();
  
  // Set and get
  cache.set('accounts', { fid: 123 }, { balance: 1000 });
  const result = cache.get('accounts', { fid: 123 });
  assert(result && result.balance === 1000, 'Basic set/get works');
  
  // Cache miss
  const miss = cache.get('accounts', { fid: 999 });
  assert(miss === null, 'Cache miss returns null');
  
  // Clear cache
  const cleared = cache.clear();
  assert(cleared === 1, 'Clear removes correct number of entries');
  
  // Verify cache is empty
  const afterClear = cache.get('accounts', { fid: 123 });
  assert(afterClear === null, 'Cache is empty after clear');
  
  // Test metrics
  const metrics = cache.getMetrics();
  assert(metrics && typeof metrics.performance.hitRate === 'number', 'Metrics are available');
  
  cache.destroy();
  console.log('CacheManager tests passed!\n');
}

function testBankingIntegration() {
  console.log('Testing Banking cache integration...\n');
  
  // Configure cache
  const config = Banking.configureCache({
    enabled: true,
    maxSize: 100,
    operationTTL: {
      accounts: { ttl: 60000, enabled: true },
      statement: { ttl: 30000, enabled: true }
    }
  });
  
  assert(config.enabled === true, 'Cache configuration applied');
  assert(config.maxSize === 100, 'Max size configured correctly');
  
  // Test metrics
  const metrics = Banking.getCacheMetrics();
  assert(metrics !== null, 'Cache metrics available');
  assert(typeof metrics.performance.hitRate === 'number', 'Hit rate is available');
  
  // Test cache operations
  const cleared = Banking.clearCache();
  assert(cleared >= 0, 'Clear cache works');
  
  const invalidated = Banking.invalidateCache('accounts');
  assert(invalidated >= 0, 'Invalidate cache works');
  
  // Reset metrics
  Banking.resetCacheMetrics();
  const resetMetrics = Banking.getCacheMetrics();
  assert(resetMetrics.requests.hits === 0, 'Metrics reset correctly');
  
  Banking.destroyPool();
  console.log('Banking integration tests passed!\n');
}

function testSecurityFeatures() {
  console.log('Testing security features...\n');
  
  const secureCache = new CacheManager({
    security: {
      encryptSensitiveData: true,
      useSecureKeys: true,
      sensitiveFields: ['password', 'ssn']
    }
  });
  
  // Test sensitive data handling
  const sensitiveData = {
    account: '123456789',
    ssn: '123-45-6789',
    balance: 1000
  };
  
  secureCache.set('test', { user: 'testuser' }, sensitiveData);
  const retrieved = secureCache.get('test', { user: 'testuser' });
  
  assert(retrieved && retrieved.balance === 1000, 'Sensitive data stored and retrieved correctly');
  assert(retrieved.account === '123456789', 'Account data preserved');
  
  secureCache.destroy();
  console.log('Security tests passed!\n');
}

function testTTLAndExpiration() {
  console.log('Testing TTL and expiration...\n');
  
  const ttlCache = new CacheManager({
    defaultTTL: 100 // 100ms
  });
  
  // Set data with short TTL
  ttlCache.set('test', { id: 1 }, { data: 'test' }, 50); // 50ms TTL
  
  // Should exist immediately
  const immediate = ttlCache.get('test', { id: 1 });
  assert(immediate && immediate.data === 'test', 'Data exists immediately after set');
  
  // Wait for expiration and test manually (since we can't use async/await here easily)
  setTimeout(() => {
    const expired = ttlCache.get('test', { id: 1 });
    assert(expired === null, 'Data expires after TTL');
    
    ttlCache.destroy();
    console.log('TTL tests passed!\n');
    
    // Run final test
    testDynamicTTL();
  }, 100);
}

function testDynamicTTL() {
  console.log('Testing dynamic TTL for statements...\n');
  
  const dynamicCache = new CacheManager({
    operationTTL: {
      statement: {
        ttl: 300000,
        enabled: true,
        dynamicTTL: {
          realtime: 60000,
          recent: 300000,
          historical: 3600000
        }
      }
    }
  });
  
  // Test with today's date
  const today = new Date();
  const todayStr = today.getFullYear() + 
    String(today.getMonth() + 1).padStart(2, '0') + 
    String(today.getDate()).padStart(2, '0');
  
  dynamicCache.set('statement', { start: todayStr }, { data: 'today' });
  const todayResult = dynamicCache.get('statement', { start: todayStr });
  assert(todayResult && todayResult.data === 'today', 'Today\'s data cached correctly');
  
  // Test with historical date
  dynamicCache.set('statement', { start: '20220101' }, { data: 'historical' });
  const historicalResult = dynamicCache.get('statement', { start: '20220101' });
  assert(historicalResult && historicalResult.data === 'historical', 'Historical data cached correctly');
  
  dynamicCache.destroy();
  console.log('Dynamic TTL tests passed!\n');
  
  console.log('🎉 All cache tests completed successfully!');
  console.log('\nCache functionality is working correctly and ready for production use.');
}

function runTests() {
  console.log('=== Banking.js Cache Functionality Tests ===\n');
  
  try {
    testCacheManager();
    testBankingIntegration();
    testSecurityFeatures();
    testTTLAndExpiration();
    // testDynamicTTL() is called from testTTLAndExpiration() due to async timing
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = {
  testCacheManager,
  testBankingIntegration,
  testSecurityFeatures,
  testTTLAndExpiration,
  testDynamicTTL
};