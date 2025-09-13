import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import Banking from '../../index.js';

describe('Connection Pool Integration Tests', () => {
  let banking;
  let originalPoolConfig;

  beforeEach(() => {
    // Store original pool config
    originalPoolConfig = Banking.getPoolMetrics();

    // Reset pool configuration
    Banking.destroyPool();

    banking = new Banking({
      fid: 3001,
      fidOrg: 'Test Bank',
      url: 'https://testbank.example.com/ofx',
      bankId: '123456789',
      user: 'testuser',
      password: 'testpass',
      accId: '1234567890',
      accType: 'CHECKING'
    });
  });

  afterEach(() => {
    Banking.destroyPool();
    nock.cleanAll();
  });

  describe('Pool Configuration', () => {
    it('should use default pool configuration', () => {
      const config = Banking.configurePool();

      expect(config.maxSockets).toBe(5);
      expect(config.maxFreeSockets).toBe(2);
      expect(config.keepAlive).toBe(true);
      expect(config.keepAliveMsecs).toBe(30000);
      expect(config.timeout).toBe(60000);
      expect(config.maxRetries).toBe(3);
      expect(config.enableMetrics).toBe(true);
    });

    it('should accept custom pool configuration', () => {
      const customConfig = {
        maxSockets: 10,
        keepAlive: false,
        timeout: 120000,
        maxRetries: 5,
        enableMetrics: false
      };

      const config = Banking.configurePool(customConfig);

      expect(config.maxSockets).toBe(10);
      expect(config.keepAlive).toBe(false);
      expect(config.timeout).toBe(120000);
      expect(config.maxRetries).toBe(5);
      expect(config.enableMetrics).toBe(false);
    });

    it('should return null metrics when pool not initialized', () => {
      Banking.destroyPool();
      const metrics = Banking.getPoolMetrics();
      expect(metrics).toBeNull();
    });
  });

  describe('Pool Metrics', () => {
    beforeEach(() => {
      Banking.configurePool({
        maxSockets: 3,
        enableMetrics: true
      });
    });

    it('should track basic request metrics', done => {
      const mockResponse = 'HTTP/1.1 200 OK\r\n\r\nOFXHEADER:100\r\nDATA:OFXSGML\r\n';

      nock('https://testbank.example.com').post('/ofx').reply(200, mockResponse);

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        const metrics = Banking.getPoolMetrics();

        expect(metrics.totalRequests).toBe(1);
        expect(metrics.poolMisses).toBe(1); // First request creates new agent
        expect(metrics.poolHits).toBe(0);
        expect(metrics.errors).toBe(0);
        expect(metrics.agentCount).toBe(1);
        expect(metrics.averageResponseTime).toBeGreaterThan(0);

        done();
      });
    });

    it('should track pool hits on subsequent requests', done => {
      const mockResponse = 'HTTP/1.1 200 OK\r\n\r\nOFXHEADER:100\r\nDATA:OFXSGML\r\n';

      nock('https://testbank.example.com').post('/ofx').times(2).reply(200, mockResponse);

      // First request
      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);

        // Second request to same host should reuse agent
        banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
          expect(err).toBe(false);

          const metrics = Banking.getPoolMetrics();
          expect(metrics.totalRequests).toBe(2);
          expect(metrics.poolMisses).toBe(1); // Only first request creates agent
          expect(metrics.poolHits).toBe(1); // Second request reuses agent

          done();
        });
      });
    });

    it('should track errors in metrics', done => {
      nock('https://testbank.example.com').post('/ofx').reply(500, 'Internal Server Error');

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();

        const metrics = Banking.getPoolMetrics();
        expect(metrics.totalRequests).toBe(1);
        expect(metrics.errors).toBeGreaterThan(0); // Should track the error

        done();
      });
    });
  });

  describe('Connection Reuse', () => {
    beforeEach(() => {
      Banking.configurePool({
        maxSockets: 5,
        keepAlive: true,
        enableMetrics: true
      });
    });

    it('should reuse connections for same host', done => {
      const mockResponse = 'HTTP/1.1 200 OK\r\n\r\nOFXHEADER:100\r\nDATA:OFXSGML\r\n';

      nock('https://testbank.example.com').post('/ofx').times(3).reply(200, mockResponse);

      let completedRequests = 0;
      const checkCompletion = () => {
        completedRequests++;
        if (completedRequests === 3) {
          const metrics = Banking.getPoolMetrics();
          expect(metrics.totalRequests).toBe(3);
          expect(metrics.agentCount).toBe(1); // Should only create one agent
          expect(metrics.poolHits).toBe(2); // 2nd and 3rd requests reuse agent
          done();
        }
      };

      // Make three concurrent requests
      banking.getStatement({ start: 20241101, end: 20241201 }, checkCompletion);
      banking.getStatement({ start: 20241101, end: 20241201 }, checkCompletion);
      banking.getStatement({ start: 20241101, end: 20241201 }, checkCompletion);
    });

    it('should create separate agents for different hosts', done => {
      const mockResponse = 'HTTP/1.1 200 OK\r\n\r\nOFXHEADER:100\r\nDATA:OFXSGML\r\n';

      nock('https://testbank.example.com').post('/ofx').reply(200, mockResponse);

      nock('https://anotherbank.example.com').post('/ofx').reply(200, mockResponse);

      const anotherBanking = new Banking({
        ...banking.opts,
        url: 'https://anotherbank.example.com/ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);

        anotherBanking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
          expect(err).toBe(false);

          const metrics = Banking.getPoolMetrics();
          expect(metrics.totalRequests).toBe(2);
          expect(metrics.agentCount).toBe(2); // Should create agents for both hosts
          expect(metrics.poolMisses).toBe(2); // Both are first requests to their hosts

          done();
        });
      });
    });
  });

  describe('Retry Logic', () => {
    beforeEach(() => {
      Banking.configurePool({
        maxRetries: 2,
        retryDelay: 100, // Short delay for testing
        enableMetrics: true
      });
    });

    it('should retry on server errors', done => {
      const mockResponse = 'HTTP/1.1 200 OK\r\n\r\nOFXHEADER:100\r\nDATA:OFXSGML\r\n';

      nock('https://testbank.example.com').post('/ofx').reply(500, 'Internal Server Error').post('/ofx').reply(200, mockResponse);

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false); // Should succeed after retry

        const metrics = Banking.getPoolMetrics();
        expect(metrics.retries).toBe(1); // Should have retried once

        done();
      });
    });

    it('should retry on network errors', done => {
      const mockResponse = 'HTTP/1.1 200 OK\r\n\r\nOFXHEADER:100\r\nDATA:OFXSGML\r\n';

      nock('https://testbank.example.com').post('/ofx').replyWithError('ECONNRESET').post('/ofx').reply(200, mockResponse);

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false); // Should succeed after retry

        const metrics = Banking.getPoolMetrics();
        expect(metrics.retries).toBe(1); // Should have retried once

        done();
      });
    });

    it('should fail after max retries', done => {
      nock('https://testbank.example.com')
        .post('/ofx')
        .times(3) // Initial + 2 retries
        .reply(500, 'Internal Server Error');

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy(); // Should fail after max retries

        const metrics = Banking.getPoolMetrics();
        expect(metrics.retries).toBe(2); // Should have retried max times
        expect(metrics.errors).toBeGreaterThan(0);

        done();
      });
    });
  });

  describe('Timeout Handling', () => {
    beforeEach(() => {
      Banking.configurePool({
        timeout: 1000, // 1 second timeout for testing
        maxRetries: 1,
        enableMetrics: true
      });
    });

    it('should timeout slow requests', done => {
      nock('https://testbank.example.com')
        .post('/ofx')
        .delay(2000) // 2 second delay
        .reply(200, 'Too late');

      const startTime = Date.now();
      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        const elapsedTime = Date.now() - startTime;

        expect(err).toBeTruthy();
        expect(err.code).toBe('ETIMEDOUT');
        expect(elapsedTime).toBeGreaterThan(1000);
        expect(elapsedTime).toBeLessThan(4000); // Should timeout before 4s (with retries)

        const metrics = Banking.getPoolMetrics();
        expect(metrics.errors).toBeGreaterThan(0);

        done();
      });
    });
  });

  describe('Legacy Mode Support', () => {
    it('should use legacy TLS sockets when pooling disabled', done => {
      const bankingWithoutPool = new Banking({
        ...banking.opts,
        usePooling: false
      });

      const mockResponse = 'HTTP/1.1 200 OK\r\n\r\nOFXHEADER:100\r\nDATA:OFXSGML\r\n';

      nock('https://testbank.example.com').post('/ofx').reply(200, mockResponse);

      bankingWithoutPool.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);

        // Pool metrics should not be affected since pooling was disabled
        const metrics = Banking.getPoolMetrics();
        // Metrics might be null if no other pooled requests were made
        if (metrics) {
          expect(metrics.totalRequests).toBe(0);
        }

        done();
      });
    });
  });

  describe('Pool Lifecycle', () => {
    it('should properly initialize and destroy pool', () => {
      expect(Banking.getPoolMetrics()).toBeNull();

      Banking.configurePool();
      // Pool is created immediately when configured
      const metrics = Banking.getPoolMetrics();
      expect(metrics).not.toBeNull();
      expect(metrics.totalRequests).toBe(0);

      Banking.destroyPool();
      expect(Banking.getPoolMetrics()).toBeNull();
    });

    it('should handle multiple destroy calls gracefully', () => {
      Banking.configurePool();
      Banking.destroyPool();
      Banking.destroyPool(); // Should not throw
      expect(Banking.getPoolMetrics()).toBeNull();
    });
  });

  describe('Banking-Specific Optimizations', () => {
    beforeEach(() => {
      Banking.configurePool({
        maxSockets: 5,
        keepAlive: true,
        keepAliveMsecs: 30000,
        enableMetrics: true
      });
    });

    it('should handle OFX-specific headers correctly', done => {
      const mockResponse = 'HTTP/1.1 200 OK\r\nContent-Type: application/x-ofx\r\n\r\nOFXHEADER:100\r\n';

      nock('https://testbank.example.com')
        .post('/ofx')
        .matchHeader('Content-Type', 'application/x-ofx')
        .matchHeader('Content-Length', /\d+/)
        .reply(200, mockResponse);

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        done();
      });
    });

    it('should maintain SSL security for banking connections', () => {
      const config = Banking.configurePool();

      expect(config.secureProtocol).toBe('TLSv1_2_method');
      expect(config.rejectUnauthorized).toBe(true);
    });
  });
});
