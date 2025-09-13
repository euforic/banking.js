# Banking.js Caching Layer

A sophisticated, PCI-compliant caching solution for banking operations that
improves performance while maintaining security and data freshness requirements.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Security & PCI Compliance](#security--pci-compliance)
- [Performance Optimization](#performance-optimization)
- [Monitoring & Metrics](#monitoring--metrics)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Best Practices](#best-practices)

## Overview

The banking.js caching layer provides intelligent caching for banking operations
with:

- **Operation-specific TTL strategies** - Different cache durations for
  accounts, statements, balances
- **Dynamic TTL based on data age** - Longer cache for historical data, shorter
  for real-time
- **PCI-compliant security** - Encrypted sensitive data, secure key generation
- **LRU eviction** - Automatic cleanup of least recently used entries
- **Comprehensive metrics** - Hit rates, performance tracking, error monitoring

## Features

### 🚀 Performance

- **Intelligent caching** reduces load on banking servers
- **LRU eviction** manages memory efficiently
- **Operation classification** optimizes TTL per data type
- **Connection pooling integration** for maximum efficiency

### 🛡️ Security & Compliance

- **PCI DSS compliant** - no sensitive data in plain text
- **Encrypted cache storage** for sensitive financial data
- **Secure key generation** with SHA-256 hashing and salts
- **Configurable sensitive field detection**

### 📊 Monitoring

- **Real-time metrics** - hit rates, response times, cache utilization
- **Error tracking** - comprehensive error statistics
- **Performance insights** - cache effectiveness analysis
- **Resource monitoring** - memory usage and cleanup tracking

### ⚙️ Flexibility

- **Multiple storage backends** - memory, Redis, file system
- **Configurable TTL per operation** - accounts, statements, balances
- **Cache warming** - preload frequently accessed data
- **Graceful degradation** - continues operation on cache failures

## Quick Start

```javascript
const Banking = require('banking');

// Configure caching for optimal performance
Banking.configureCache({
  enabled: true,
  maxSize: 1000,

  // Operation-specific caching
  operationTTL: {
    accounts: { ttl: 600000, enabled: true }, // 10 minutes
    statement: { ttl: 300000, enabled: true }, // 5 minutes
    balance: { ttl: 120000, enabled: true } // 2 minutes
  },

  // PCI-compliant security
  security: {
    encryptSensitiveData: true,
    useSecureKeys: true
  }
});

// Use banking operations normally - caching is automatic
const banking = new Banking(config);

banking.getAccounts((err, accounts) => {
  // First call: fetched from bank, cached for future use
  // Subsequent calls: served from cache (10x faster!)
});

banking.getStatement(
  { start: '20240101', end: '20240131' },
  (err, statement) => {
    // Cached with smart TTL based on data age
  }
);
```

## Configuration

### Basic Configuration

```javascript
Banking.configureCache({
  // Global settings
  enabled: true, // Enable/disable caching
  maxSize: 1000, // Maximum cache entries
  defaultTTL: 300000, // Default TTL (5 minutes)
  cleanupInterval: 300000, // Cleanup interval (5 minutes)

  // Operation-specific TTL
  operationTTL: {
    accounts: {
      ttl: 600000, // 10 minutes
      enabled: true,
      maxEntries: 50
    },
    statement: {
      ttl: 300000, // 5 minutes
      enabled: true,
      maxEntries: 200,
      // Dynamic TTL based on data age
      dynamicTTL: {
        historical: 3600000, // 1 hour for old data
        recent: 300000, // 5 minutes for recent
        realtime: 60000 // 1 minute for today
      }
    },
    balance: {
      ttl: 120000, // 2 minutes
      enabled: true,
      maxEntries: 100
    }
  }
});
```

### Production Configuration

```javascript
Banking.configureCache({
  enabled: true,
  maxSize: 5000,

  // Redis for distributed caching
  storage: {
    type: 'redis',
    options: {
      redis: {
        host: 'redis.banking.internal',
        port: 6379,
        db: 0,
        keyPrefix: 'banking:cache:'
      }
    }
  },

  // Enhanced security for production
  security: {
    encryptSensitiveData: true,
    useSecureKeys: true,
    sensitiveFields: ['password', 'user', 'accId', 'pin', 'ssn']
  },

  // Cache warming for performance
  warming: {
    enabled: true,
    preloadAccounts: true,
    preloadRecentStatements: true,
    schedule: {
      accounts: '0 */30 * * * *', // Every 30 minutes
      statements: '0 */15 * * * *' // Every 15 minutes
    }
  },

  // Comprehensive monitoring
  metrics: {
    enabled: true,
    trackHitRate: true,
    trackResponseTime: true,
    trackMemoryUsage: true,
    metricsInterval: 60000
  }
});
```

## Security & PCI Compliance

### Encryption

Sensitive financial data is automatically encrypted before caching:

```javascript
Banking.configureCache({
  security: {
    encryptSensitiveData: true, // Enable encryption
    encryptionKey: null, // Auto-generated if not provided
    useSecureKeys: true, // Use SHA-256 hashing
    salt: null, // Auto-generated if not provided

    // Fields that trigger encryption
    sensitiveFields: [
      'password',
      'user',
      'accId',
      'pin',
      'ssn',
      'accountNumber',
      'routingNumber',
      'credentials'
    ]
  }
});
```

### Secure Key Generation

Cache keys are generated securely to prevent data exposure:

- **No sensitive data in keys** - account numbers and credentials are hashed
- **SHA-256 hashing** with configurable salts
- **Deterministic keys** for consistent caching
- **Operation prefixes** for cache isolation

### PCI DSS Compliance

The caching layer follows PCI DSS requirements:

- ✅ **No plaintext sensitive data** in cache keys or storage
- ✅ **Encryption at rest** for cached financial data
- ✅ **Secure key management** with automatic key generation
- ✅ **Data lifecycle management** with TTL-based expiration
- ✅ **Access controls** through secure key generation
- ✅ **Audit logging** through comprehensive metrics

## Performance Optimization

### TTL Strategies

Different operations use optimized TTL strategies:

#### Account Information

- **TTL: 10 minutes** - account lists change infrequently
- **Use case**: Account discovery, basic account info
- **Invalidation**: When user updates account settings

#### Balance Information

- **TTL: 2 minutes** - balances need to be relatively current
- **Use case**: Account balance checks, quick balance updates
- **Invalidation**: After transactions are posted

#### Transaction Statements

- **Dynamic TTL** based on data age:
  - **Today's data**: 1 minute (real-time requirements)
  - **Recent data (30 days)**: 5 minutes (moderate freshness)
  - **Historical data (>30 days)**: 1 hour (rarely changes)

#### Institution Metadata

- **TTL: 24 hours** - rarely changes
- **Use case**: Bank information, routing numbers, FID data

### Cache Hit Rate Optimization

Achieve optimal hit rates with these strategies:

```javascript
// 1. Appropriate TTL values
Banking.configureCache({
  operationTTL: {
    // Longer TTL for stable data
    institution: { ttl: 86400000 }, // 24 hours

    // Shorter TTL for dynamic data
    balance: { ttl: 120000 }, // 2 minutes

    // Smart TTL for statements
    statement: {
      dynamicTTL: {
        historical: 3600000, // 1 hour
        recent: 300000, // 5 minutes
        realtime: 60000 // 1 minute
      }
    }
  }
});

// 2. Cache warming for frequently accessed data
Banking.configureCache({
  warming: {
    enabled: true,
    preloadAccounts: true,
    preloadRecentStatements: true
  }
});

// 3. Proper cache size management
Banking.configureCache({
  maxSize: 5000, // Adjust based on available memory

  operationTTL: {
    accounts: { maxEntries: 100 },
    statement: { maxEntries: 1000 },
    balance: { maxEntries: 200 }
  }
});
```

## Monitoring & Metrics

### Real-time Metrics

Monitor cache performance with comprehensive metrics:

```javascript
const metrics = Banking.getCacheMetrics();

console.log('Cache Performance:');
console.log(`Hit Rate: ${metrics.performance.hitRate}%`);
console.log(`Avg Response Time: ${metrics.performance.averageResponseTime}ms`);
console.log(`Cache Utilization: ${metrics.cache.utilizationPercent}%`);

console.log('Request Statistics:');
console.log(`Hits: ${metrics.requests.hits}`);
console.log(`Misses: ${metrics.requests.misses}`);
console.log(`Sets: ${metrics.requests.sets}`);

console.log('Error Statistics:');
console.log(`Get Errors: ${metrics.errors.get}`);
console.log(`Set Errors: ${metrics.errors.set}`);
```

### Performance Alerts

Set up monitoring alerts for optimal performance:

```javascript
function monitorCacheHealth() {
  const metrics = Banking.getCacheMetrics();

  // Alert on low hit rate
  if (metrics.performance.hitRate < 70) {
    console.warn('⚠️  Low cache hit rate detected');
    // Consider adjusting TTL values or cache size
  }

  // Alert on high error rate
  const totalErrors = Object.values(metrics.errors).reduce((a, b) => a + b, 0);
  const totalRequests = metrics.requests.hits + metrics.requests.misses;
  const errorRate = (totalErrors / totalRequests) * 100;

  if (errorRate > 5) {
    console.warn('⚠️  High cache error rate detected');
    // Check cache storage accessibility
  }

  // Alert on high memory usage
  if (metrics.cache.utilizationPercent > 90) {
    console.warn('⚠️  Cache memory usage high');
    // Consider increasing maxSize or implementing cleanup
  }
}
```

## API Reference

### Configuration Methods

#### `Banking.configureCache(config)`

Configure caching settings for all banking operations.

**Parameters:**

- `config` (Object): Cache configuration options

**Returns:** Applied cache configuration

#### `Banking.getCacheMetrics()`

Get current cache performance metrics.

**Returns:** CacheMetrics object or null if caching disabled

#### `Banking.clearCache()`

Clear all cached data.

**Returns:** Number of entries cleared

#### `Banking.invalidateCache(operation, params?)`

Invalidate cache entries for specific operation.

**Parameters:**

- `operation` (String): Operation type ('accounts', 'statement', etc.)
- `params` (Object, optional): Specific parameters to invalidate

**Returns:** Number of entries invalidated

#### `Banking.resetCacheMetrics()`

Reset cache performance metrics.

### Cache Events

Monitor cache operations through metrics:

```javascript
// Monitor cache events
setInterval(() => {
  const metrics = Banking.getCacheMetrics();

  // Log cache hits/misses
  console.log(
    `Cache activity: ${metrics.requests.hits} hits, ${metrics.requests.misses} misses`
  );

  // Track performance trends
  if (metrics.performance.hitRate < previousHitRate) {
    console.log('Hit rate declining - consider cache optimization');
  }
}, 60000);
```

## Examples

### Basic Usage

```javascript
const Banking = require('banking');

// Enable caching with defaults
Banking.configureCache({ enabled: true });

const banking = new Banking({
  fid: 12345,
  url: 'https://banking.example.com/ofx',
  user: 'username',
  password: 'password',
  accId: 'CHK123',
  accType: 'CHECKING'
});

// Cached automatically
banking.getAccounts((err, accounts) => {
  console.log('Accounts:', accounts);
});
```

### Advanced Configuration

```javascript
// Production-ready configuration
Banking.configureCache({
  enabled: true,
  maxSize: 5000,

  operationTTL: {
    accounts: { ttl: 600000, enabled: true },
    statement: {
      ttl: 300000,
      enabled: true,
      dynamicTTL: {
        historical: 3600000,
        recent: 300000,
        realtime: 60000
      }
    },
    balance: { ttl: 120000, enabled: true }
  },

  security: {
    encryptSensitiveData: true,
    useSecureKeys: true
  },

  storage: {
    type: 'redis',
    options: {
      redis: {
        host: 'localhost',
        port: 6379,
        keyPrefix: 'banking:cache:'
      }
    }
  },

  metrics: {
    enabled: true,
    trackHitRate: true,
    trackResponseTime: true
  }
});
```

### Cache Management

```javascript
// Monitor cache performance
const metrics = Banking.getCacheMetrics();
console.log(`Hit rate: ${metrics.performance.hitRate}%`);

// Invalidate when data changes
Banking.invalidateCache('accounts'); // Clear all account data
Banking.invalidateCache('statement', {
  start: '20240101',
  end: '20240131'
}); // Clear specific statement

// Clear all cache during maintenance
const cleared = Banking.clearCache();
console.log(`Cleared ${cleared} entries`);

// Reset metrics for new measurement period
Banking.resetCacheMetrics();
```

## Best Practices

### Production Deployment

1. **Use Redis for distributed caching**:

   ```javascript
   Banking.configureCache({
     storage: {
       type: 'redis',
       options: {
         redis: {
           host: 'redis-cluster.internal',
           port: 6379,
           keyPrefix: 'banking:cache:'
         }
       }
     }
   });
   ```

2. **Enable comprehensive monitoring**:

   ```javascript
   Banking.configureCache({
     metrics: {
       enabled: true,
       trackHitRate: true,
       trackResponseTime: true,
       trackMemoryUsage: true
     }
   });
   ```

3. **Configure appropriate TTL values**:
   - Accounts: 10 minutes (stable data)
   - Balances: 2 minutes (needs freshness)
   - Statements: Dynamic based on age
   - Institution data: 24 hours (rarely changes)

### Security Guidelines

1. **Always enable encryption for sensitive data**:

   ```javascript
   Banking.configureCache({
     security: {
       encryptSensitiveData: true,
       useSecureKeys: true
     }
   });
   ```

2. **Regularly rotate encryption keys in production**
3. **Monitor cache access patterns for anomalies**
4. **Implement proper cache isolation per user/session**

### Performance Optimization

1. **Monitor hit rates and adjust TTL accordingly**
2. **Use cache warming for frequently accessed data**
3. **Set appropriate cache size limits based on available memory**
4. **Implement proper cache invalidation strategies**

### Error Handling

1. **Cache failures should not break banking operations**:

   ```javascript
   try {
     Banking.configureCache(config);
   } catch (error) {
     console.warn('Cache configuration failed, continuing without cache');
     Banking.configureCache({ enabled: false });
   }
   ```

2. **Monitor cache errors and implement alerting**
3. **Have fallback strategies for cache storage failures**

### Testing

1. **Test cache behavior in different scenarios**
2. **Verify TTL expiration works correctly**
3. **Test cache invalidation strategies**
4. **Validate security measures (encryption, key hashing)**

## Troubleshooting

### Common Issues

**Low hit rate (<50%)**:

- Check TTL values - may be too short
- Verify cache size is adequate
- Check for excessive cache invalidation

**High memory usage**:

- Reduce cache size or implement more aggressive cleanup
- Check for memory leaks in cache storage
- Consider TTL optimization

**Cache errors**:

- Verify storage backend accessibility (Redis, file system)
- Check encryption key availability
- Monitor network connectivity for distributed cache

**Performance degradation**:

- Monitor cache response times
- Check for storage backend performance issues
- Verify cache cleanup is working properly

For more examples and advanced usage, see the `/examples` directory.
