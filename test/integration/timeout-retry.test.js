import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import Banking from '../../index.js';
import { bankConfigs } from '../fixtures/responses.js';

describe('Comprehensive Timeout and Retry Tests', () => {
  let banking;

  beforeEach(() => {
    banking = new Banking(bankConfigs.wellsFargo);

    // Configure aggressive timeouts for testing
    Banking.configurePool({
      timeouts: {
        quick: {
          connection: 1000, // 1 second
          request: 2000, // 2 seconds
          socket: 1500, // 1.5 seconds
          idle: 5000
        },
        standard: {
          connection: 2000, // 2 seconds
          request: 5000, // 5 seconds
          socket: 3000, // 3 seconds
          idle: 10000
        },
        heavy: {
          connection: 3000, // 3 seconds
          request: 10000, // 10 seconds
          socket: 5000, // 5 seconds
          idle: 15000
        }
      },
      retry: {
        maxRetries: {
          quick: 2,
          standard: 3,
          heavy: 2
        },
        baseDelay: 100, // Fast retries for testing
        maxDelay: 2000,
        backoffStrategy: 'exponential',
        jitter: {
          enabled: true,
          type: 'equal',
          factor: 0.1
        }
      }
    });
  });

  afterEach(() => {
    nock.cleanAll();
    Banking.destroyPool();
  });

  describe('Operation Type Classification', () => {
    it('should classify account list requests as quick operations', done => {
      const startTime = Date.now();

      nock('https://www.oasis.cfree.com')
        .post('/3001.ofxgp')
        .delay(1800) // Just under quick timeout limit
        .reply(
          200,
          `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
        <MESSAGE>SUCCESS
      </STATUS>
      <DTSERVER>20241201120000.000
      <LANGUAGE>ENG
    </SONRS>
  </SIGNONMSGSRSV1>
  <SIGNUPMSGSRSV1>
    <ACCTINFOTRNRS>
      <TRNUID>account-list-success
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
      </STATUS>
      <ACCTINFORS>
        <DTACCTUP>20241201
        <ACCTINFO>
          <DESC>Checking Account
          <PHONE>555-1234
          <BANKACCTFROM>
            <BANKID>123456789
            <ACCTID>987654321
            <ACCTTYPE>CHECKING
          </BANKACCTFROM>
        </ACCTINFO>
      </ACCTINFORS>
    </ACCTINFOTRNRS>
  </SIGNUPMSGSRSV1>
</OFX>`
        );

      banking.getAccounts((err, res) => {
        const elapsed = Date.now() - startTime;
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(elapsed).toBeGreaterThan(1800);
        expect(elapsed).toBeLessThan(2500); // Should complete before standard timeout
        done();
      });
    });

    it('should classify 30-day statement requests as quick operations', done => {
      const startTime = Date.now();

      nock('https://www.oasis.cfree.com')
        .post('/3001.ofxgp')
        .delay(1800)
        .reply(
          200,
          `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
        <MESSAGE>SUCCESS
      </STATUS>
      <DTSERVER>20241201120000.000
      <LANGUAGE>ENG
    </SONRS>
  </SIGNONMSGSRSV1>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <TRNUID>quick-statement
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
      </STATUS>
      <STMTRS>
        <CURDEF>USD
        <BANKACCTFROM>
          <BANKID>123456789
          <ACCTID>987654321
          <ACCTTYPE>CHECKING
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>20241101
          <DTEND>20241201
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20241115
            <TRNAMT>-50.00
            <FITID>quick123
            <NAME>Quick Transaction
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`
        );

      // Request 30 days (should be classified as quick)
      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        const elapsed = Date.now() - startTime;
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(elapsed).toBeGreaterThan(1800);
        expect(elapsed).toBeLessThan(2500);
        done();
      });
    });

    it('should classify 6-month statement requests as standard operations', done => {
      const startTime = Date.now();

      nock('https://www.oasis.cfree.com')
        .post('/3001.ofxgp')
        .delay(4000) // Under standard timeout
        .reply(
          200,
          `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
        <MESSAGE>SUCCESS
      </STATUS>
      <DTSERVER>20241201120000.000
      <LANGUAGE>ENG
    </SONRS>
  </SIGNONMSGSRSV1>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <TRNUID>standard-statement
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
      </STATUS>
      <STMTRS>
        <CURDEF>USD
        <BANKACCTFROM>
          <BANKID>123456789
          <ACCTID>987654321
          <ACCTTYPE>CHECKING
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>20240601
          <DTEND>20241201
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`
        );

      // Request 6 months (should be classified as standard)
      banking.getStatement({ start: 20240601, end: 20241201 }, (err, res) => {
        const elapsed = Date.now() - startTime;
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(elapsed).toBeGreaterThan(4000);
        expect(elapsed).toBeLessThan(6000);
        done();
      });
    });

    it('should classify 2-year statement requests as heavy operations', done => {
      const startTime = Date.now();

      nock('https://www.oasis.cfree.com')
        .post('/3001.ofxgp')
        .delay(8000) // Under heavy timeout
        .reply(
          200,
          `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
        <MESSAGE>SUCCESS
      </STATUS>
      <DTSERVER>20241201120000.000
      <LANGUAGE>ENG
    </SONRS>
  </SIGNONMSGSRSV1>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <TRNUID>heavy-statement
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
      </STATUS>
      <STMTRS>
        <CURDEF>USD
        <BANKACCTFROM>
          <BANKID>123456789
          <ACCTID>987654321
          <ACCTTYPE>CHECKING
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>20221201
          <DTEND>20241201
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`
        );

      // Request 2 years (should be classified as heavy)
      banking.getStatement({ start: 20221201, end: 20241201 }, (err, res) => {
        const elapsed = Date.now() - startTime;
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(elapsed).toBeGreaterThan(8000);
        expect(elapsed).toBeLessThan(11000);
        done();
      });
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout quick operations appropriately', done => {
      const startTime = Date.now();

      nock('https://www.oasis.cfree.com')
        .post('/3001.ofxgp')
        .delay(3000) // Longer than quick timeout
        .reply(200, 'Should not reach here');

      banking.getAccounts((err, res) => {
        const elapsed = Date.now() - startTime;
        expect(err).toBeTruthy();
        expect(err.code).toMatch(/ETIMEDOUT|ESOCKETTIMEDOUT|ECONNTIMEDOUT/);
        expect(elapsed).toBeGreaterThan(2000);
        expect(elapsed).toBeLessThan(4000);
        done();
      });
    });

    it('should timeout standard operations appropriately', done => {
      const startTime = Date.now();

      nock('https://www.oasis.cfree.com')
        .post('/3001.ofxgp')
        .delay(7000) // Longer than standard timeout
        .reply(200, 'Should not reach here');

      banking.getStatement({ start: 20240601, end: 20241201 }, (err, res) => {
        const elapsed = Date.now() - startTime;
        expect(err).toBeTruthy();
        expect(err.code).toMatch(/ETIMEDOUT|ESOCKETTIMEDOUT|ECONNTIMEDOUT/);
        expect(elapsed).toBeGreaterThan(5000);
        expect(elapsed).toBeLessThan(8000);
        done();
      });
    });

    it('should timeout heavy operations appropriately', done => {
      const startTime = Date.now();

      nock('https://www.oasis.cfree.com')
        .post('/3001.ofxgp')
        .delay(12000) // Longer than heavy timeout
        .reply(200, 'Should not reach here');

      banking.getStatement({ start: 20221201, end: 20241201 }, (err, res) => {
        const elapsed = Date.now() - startTime;
        expect(err).toBeTruthy();
        expect(err.code).toMatch(/ETIMEDOUT|ESOCKETTIMEDOUT|ECONNTIMEDOUT/);
        expect(elapsed).toBeGreaterThan(10000);
        expect(elapsed).toBeLessThan(15000);
        done();
      });
    }, 20000); // Increase test timeout
  });

  describe('Retry Logic', () => {
    it('should retry on connection reset errors', done => {
      let attemptCount = 0;

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').times(2).replyWithError({ code: 'ECONNRESET', message: 'Connection reset by peer' });

      nock('https://www.oasis.cfree.com')
        .post('/3001.ofxgp')
        .reply(
          200,
          `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
        <MESSAGE>SUCCESS
      </STATUS>
      <DTSERVER>20241201120000.000
      <LANGUAGE>ENG
    </SONRS>
  </SIGNONMSGSRSV1>
</OFX>`
        );

      const startTime = Date.now();
      banking.getAccounts((err, res) => {
        const elapsed = Date.now() - startTime;
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(elapsed).toBeGreaterThan(200); // Should have some retry delay
        done();
      });
    });

    it('should retry on 500 server errors', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').times(2).reply(500, 'Internal Server Error');

      nock('https://www.oasis.cfree.com')
        .post('/3001.ofxgp')
        .reply(
          200,
          `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
        <MESSAGE>SUCCESS
      </STATUS>
      <DTSERVER>20241201120000.000
      <LANGUAGE>ENG
    </SONRS>
  </SIGNONMSGSRSV1>
</OFX>`
        );

      banking.getAccounts((err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        done();
      });
    });

    it('should NOT retry on 401 authentication errors', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(401, 'Unauthorized - Invalid Credentials');

      const startTime = Date.now();
      banking.getAccounts((err, res) => {
        const elapsed = Date.now() - startTime;
        expect(err).toBeTruthy();
        expect(err.statusCode).toBe(401);
        expect(elapsed).toBeLessThan(1000); // Should fail quickly without retries
        done();
      });
    });

    it('should NOT retry on OFX invalid credentials errors', done => {
      const invalidCredentialsResponse = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS>
        <CODE>15500
        <SEVERITY>ERROR
        <MESSAGE>INVALID SIGNON
      </STATUS>
      <DTSERVER>20241201120000.000
      <LANGUAGE>ENG
    </SONRS>
  </SIGNONMSGSRSV1>
</OFX>`;

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, invalidCredentialsResponse);

      const startTime = Date.now();
      banking.getAccounts((err, res) => {
        const elapsed = Date.now() - startTime;
        expect(err).toBe(false); // OFX errors are not HTTP errors
        expect(res).toBeDefined();
        expect(res.body.OFX.SIGNONMSGSRSV1.SONRS.STATUS.CODE).toBe('15500');
        expect(elapsed).toBeLessThan(1000); // Should complete quickly
        done();
      });
    });

    it('should respect maximum retry limits', done => {
      // Mock 4 failures (more than max retries for quick operations)
      nock('https://www.oasis.cfree.com')
        .post('/3001.ofxgp')
        .times(3) // 2 retries + 1 initial = 3 total attempts
        .replyWithError({ code: 'ECONNRESET', message: 'Connection reset by peer' });

      const startTime = Date.now();
      banking.getAccounts((err, res) => {
        const elapsed = Date.now() - startTime;
        expect(err).toBeTruthy();
        expect(err.code).toBe('ECONNRESET');
        expect(elapsed).toBeGreaterThan(200); // Should have some retry delays
        done();
      });
    });
  });

  describe('Exponential Backoff', () => {
    it('should increase delay between retries exponentially', done => {
      const delays = [];
      let startTime = Date.now();

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').times(3).replyWithError({ code: 'ETIMEDOUT', message: 'Request timeout' });

      banking.getAccounts((err, res) => {
        const totalTime = Date.now() - startTime;
        expect(err).toBeTruthy();
        expect(err.code).toBe('ETIMEDOUT');
        // With exponential backoff (base 100ms): attempt 1 -> wait ~100ms -> attempt 2 -> wait ~200ms -> attempt 3
        expect(totalTime).toBeGreaterThan(300); // At least base delays
        done();
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limiting between requests', done => {
      // Configure more aggressive rate limiting for testing
      Banking.configurePool({
        retry: {
          rateLimiting: {
            enabled: true,
            maxConcurrent: 1,
            requestInterval: 200 // 200ms between requests
          }
        }
      });

      const startTime = Date.now();
      let firstCompleted = false;
      let firstTime = 0;

      nock('https://www.oasis.cfree.com')
        .post('/3001.ofxgp')
        .times(2)
        .reply(
          200,
          `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
        <MESSAGE>SUCCESS
      </STATUS>
      <DTSERVER>20241201120000.000
      <LANGUAGE>ENG
    </SONRS>
  </SIGNONMSGSRSV1>
</OFX>`
        );

      // Make first request
      banking.getAccounts((err, res) => {
        expect(err).toBe(false);
        firstCompleted = true;
        firstTime = Date.now() - startTime;
      });

      // Make second request immediately
      banking.getAccounts((err, res) => {
        expect(err).toBe(false);
        expect(firstCompleted).toBe(true);

        const secondTime = Date.now() - startTime;
        const timeDiff = secondTime - firstTime;

        // Second request should be delayed by rate limiting
        expect(timeDiff).toBeGreaterThan(200);
        done();
      });
    });
  });

  describe('Metrics Collection', () => {
    it('should collect comprehensive metrics', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(500, 'Server Error');

      nock('https://www.oasis.cfree.com')
        .post('/3001.ofxgp')
        .reply(
          200,
          `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
        <MESSAGE>SUCCESS
      </STATUS>
      <DTSERVER>20241201120000.000
      <LANGUAGE>ENG
    </SONRS>
  </SIGNONMSGSRSV1>
</OFX>`
        );

      banking.getAccounts((err, res) => {
        expect(err).toBe(false);

        const metrics = Banking.getPoolMetrics();
        expect(metrics).toBeDefined();
        expect(metrics.totalRequests).toBeGreaterThan(0);
        expect(metrics.operationTypes.quick).toBeGreaterThan(0);

        const retryMetrics = Banking.getRetryMetrics();
        expect(retryMetrics).toBeDefined();
        expect(retryMetrics.httpErrors).toBeGreaterThan(0);
        expect(retryMetrics.successfulRetries).toBeGreaterThan(0);

        done();
      });
    });

    it('should reset retry metrics when requested', () => {
      const initialMetrics = Banking.getRetryMetrics();
      Banking.resetRetryMetrics();
      const resetMetrics = Banking.getRetryMetrics();

      expect(resetMetrics.totalAttempts).toBe(0);
      expect(resetMetrics.successfulRetries).toBe(0);
      expect(resetMetrics.failedRetries).toBe(0);
    });
  });

  describe('Configuration Flexibility', () => {
    it('should allow custom timeout configuration', done => {
      Banking.configureTimeouts({
        quick: {
          connection: 500,
          request: 1000,
          socket: 750
        }
      });

      const startTime = Date.now();

      nock('https://www.oasis.cfree.com')
        .post('/3001.ofxgp')
        .delay(1200) // Longer than custom quick timeout
        .reply(200, 'Should not reach here');

      banking.getAccounts((err, res) => {
        const elapsed = Date.now() - startTime;
        expect(err).toBeTruthy();
        expect(err.code).toMatch(/ETIMEDOUT|ESOCKETTIMEDOUT|ECONNTIMEDOUT/);
        expect(elapsed).toBeGreaterThan(1000);
        expect(elapsed).toBeLessThan(1500);
        done();
      });
    });

    it('should allow custom retry configuration', done => {
      Banking.configureRetry({
        maxRetries: {
          quick: 1 // Only 1 retry
        },
        baseDelay: 50,
        backoffStrategy: 'fixed'
      });

      nock('https://www.oasis.cfree.com')
        .post('/3001.ofxgp')
        .times(2) // Should only make 2 attempts total (1 retry)
        .replyWithError({ code: 'ECONNRESET', message: 'Connection reset' });

      const startTime = Date.now();
      banking.getAccounts((err, res) => {
        const elapsed = Date.now() - startTime;
        expect(err).toBeTruthy();
        expect(err.code).toBe('ECONNRESET');
        expect(elapsed).toBeGreaterThan(50); // At least one retry delay
        expect(elapsed).toBeLessThan(200); // But not too many retries
        done();
      });
    });
  });
});
