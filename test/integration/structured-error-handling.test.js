import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import Banking from '../../index.js';
import { bankConfigs } from '../fixtures/responses.js';

describe('Structured Error Handling System', () => {
  let banking;

  beforeEach(() => {
    // Reset any existing nock interceptors
    nock.cleanAll();
  });

  describe('Error Class Inheritance and Structure', () => {
    it('should have proper error class hierarchy', () => {
      expect(Banking.BankingError).toBeDefined();
      expect(Banking.NetworkError).toBeDefined();
      expect(Banking.ConnectionError).toBeDefined();
      expect(Banking.TimeoutError).toBeDefined();
      expect(Banking.AuthenticationError).toBeDefined();
      expect(Banking.InvalidCredentialsError).toBeDefined();
      expect(Banking.BankingBusinessError).toBeDefined();
      expect(Banking.AccountNotFoundError).toBeDefined();
      expect(Banking.OFXProtocolError).toBeDefined();
      expect(Banking.MalformedResponseError).toBeDefined();
      expect(Banking.ConfigurationError).toBeDefined();
      expect(Banking.InvalidConfigurationError).toBeDefined();
    });

    it('should create errors with proper inheritance', () => {
      const connectionError = new Banking.ConnectionError('Test connection error');

      expect(connectionError).toBeInstanceOf(Banking.ConnectionError);
      expect(connectionError).toBeInstanceOf(Banking.NetworkError);
      expect(connectionError).toBeInstanceOf(Banking.BankingError);
      expect(connectionError).toBeInstanceOf(Error);
    });

    it('should include correlation IDs and structured information', () => {
      const error = new Banking.BankingError('Test error', {
        fid: 12345,
        fidOrg: 'Test Bank',
        operationType: 'statement'
      });

      expect(error.correlationId).toBeDefined();
      expect(error.correlationId).toMatch(/^[A-Za-z0-9]{16}$/);
      expect(error.timestamp).toBeDefined();
      expect(error.category).toBe('UNKNOWN');
      expect(error.bankingContext.fid).toBe(12345);
      expect(error.bankingContext.fidOrg).toBe('Test Bank');
      expect(error.bankingContext.operationType).toBe('statement');
    });

    it('should provide PCI-compliant logging', () => {
      const error = new Banking.BankingError('Test error', {
        fid: 12345,
        url: 'https://username:password@bank.com/ofx?secret=123'
      });

      const logObj = error.toLogObject();

      // Should sanitize URLs
      expect(logObj.bankingContext.url).not.toContain('username');
      expect(logObj.bankingContext.url).not.toContain('password');
      expect(logObj.bankingContext.url).not.toContain('secret');

      // Should include safe information
      expect(logObj.correlationId).toBeDefined();
      expect(logObj.timestamp).toBeDefined();
      expect(logObj.bankingContext.fid).toBe(12345);
    });
  });

  describe('Configuration Validation', () => {
    it('should throw InvalidConfigurationError for missing config', () => {
      expect(() => new Banking()).toThrow(Banking.InvalidConfigurationError);
      expect(() => new Banking()).toThrow('Configuration object is required');
    });

    it('should throw MissingParameterError for missing required fields', () => {
      expect(() => new Banking({})).toThrow(Banking.MissingParameterError);
      expect(() => new Banking({})).toThrow("Required parameter 'fid' is missing");
    });

    it('should throw InvalidConfigurationError for invalid FID', () => {
      expect(
        () =>
          new Banking({
            fid: 'invalid',
            url: 'https://bank.com',
            user: 'user',
            password: 'pass',
            accId: '123',
            accType: 'CHECKING'
          })
      ).toThrow(Banking.InvalidConfigurationError);
      expect(
        () =>
          new Banking({
            fid: 'invalid',
            url: 'https://bank.com',
            user: 'user',
            password: 'pass',
            accId: '123',
            accType: 'CHECKING'
          })
      ).toThrow('FID must be a positive number');
    });

    it('should throw InvalidConfigurationError for invalid URL', () => {
      expect(
        () =>
          new Banking({
            fid: 12345,
            url: 'invalid-url',
            user: 'user',
            password: 'pass',
            accId: '123',
            accType: 'CHECKING'
          })
      ).toThrow(Banking.InvalidConfigurationError);
      expect(
        () =>
          new Banking({
            fid: 12345,
            url: 'invalid-url',
            user: 'user',
            password: 'pass',
            accId: '123',
            accType: 'CHECKING'
          })
      ).toThrow('Invalid URL format');
    });

    it('should throw InvalidConfigurationError for invalid account type', () => {
      expect(
        () =>
          new Banking({
            fid: 12345,
            url: 'https://bank.com',
            user: 'user',
            password: 'pass',
            accId: '123',
            accType: 'INVALID'
          })
      ).toThrow(Banking.InvalidConfigurationError);
      expect(
        () =>
          new Banking({
            fid: 12345,
            url: 'https://bank.com',
            user: 'user',
            password: 'pass',
            accId: '123',
            accType: 'INVALID'
          })
      ).toThrow('Invalid account type');
    });
  });

  describe('Network Error Classification', () => {
    beforeEach(() => {
      banking = new Banking(bankConfigs.wellsFargo);
    });

    it('should classify DNS errors correctly', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').replyWithError({ code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND' });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeInstanceOf(Banking.DNSError);
        expect(err).toBeInstanceOf(Banking.NetworkError);
        expect(err.code).toBe('DNS_ERROR');
        expect(err.retryable).toBe(false);
        expect(err.recommendations).toContain('Verify the banking server URL is correct');
        done();
      });
    });

    it('should classify connection errors correctly', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').replyWithError({ code: 'ECONNREFUSED', message: 'Connection refused' });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeInstanceOf(Banking.ConnectionError);
        expect(err).toBeInstanceOf(Banking.NetworkError);
        expect(err.code).toBe('CONNECTION_ERROR');
        expect(err.retryable).toBe(true);
        expect(err.maxRetries).toBe(3);
        expect(err.recommendations).toContain('Check network connectivity');
        done();
      });
    });

    it('should classify certificate errors correctly', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').replyWithError({ code: 'CERT_HAS_EXPIRED', message: 'Certificate has expired' });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeInstanceOf(Banking.CertificateError);
        expect(err).toBeInstanceOf(Banking.NetworkError);
        expect(err.code).toBe('CERTIFICATE_ERROR');
        expect(err.retryable).toBe(false);
        expect(err.recommendations).toContain('Verify SSL certificate configuration');
        done();
      });
    });
  });

  describe('HTTP Status Code Classification', () => {
    beforeEach(() => {
      banking = new Banking(bankConfigs.wellsFargo);
    });

    it('should classify 401 as InvalidCredentialsError', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(401, 'Unauthorized');

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeInstanceOf(Banking.InvalidCredentialsError);
        expect(err).toBeInstanceOf(Banking.AuthenticationError);
        expect(err.technicalDetails.httpStatus).toBe(401);
        expect(err.retryable).toBe(false);
        expect(err.recommendations).toContain('Verify username and password are correct');
        done();
      });
    });

    it('should classify 404 as AccountNotFoundError', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(404, 'Not Found');

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeInstanceOf(Banking.AccountNotFoundError);
        expect(err).toBeInstanceOf(Banking.BankingBusinessError);
        expect(err.technicalDetails.httpStatus).toBe(404);
        expect(err.recommendations).toContain('Verify the account ID/number is correct');
        done();
      });
    });

    it('should classify 429 as TooManyRequestsError', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(429, 'Too Many Requests');

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeInstanceOf(Banking.TooManyRequestsError);
        expect(err).toBeInstanceOf(Banking.RateLimitError);
        expect(err.technicalDetails.httpStatus).toBe(429);
        expect(err.retryable).toBe(true);
        expect(err.retryAfter).toBe(300); // 5 minutes
        expect(err.recommendations).toContain('Wait before making additional requests');
        done();
      });
    });

    it('should classify 503 as MaintenanceModeError', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(503, 'Service Unavailable');

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeInstanceOf(Banking.MaintenanceModeError);
        expect(err).toBeInstanceOf(Banking.BankingBusinessError);
        expect(err.technicalDetails.httpStatus).toBe(503);
        expect(err.retryable).toBe(true);
        expect(err.retryAfter).toBe(3600); // 1 hour
        expect(err.recommendations).toContain('Wait for maintenance window to complete');
        done();
      });
    });
  });

  describe('Date Validation', () => {
    beforeEach(() => {
      banking = new Banking(bankConfigs.wellsFargo);
    });

    it('should validate missing start date', () => {
      return new Promise(resolve => {
        banking.getStatement({}, (err, res) => {
          expect(err).toBeInstanceOf(Banking.InvalidDateRangeError);
          expect(err.code).toBe('INVALID_DATE_RANGE');
          expect(err.message).toContain('Start date is required');
          resolve();
        });
      });
    });

    it('should validate invalid date format', () => {
      return new Promise(resolve => {
        banking.getStatement({ start: 'invalid-date' }, (err, res) => {
          expect(err).toBeInstanceOf(Banking.InvalidDateRangeError);
          expect(err.message).toContain('Start date must be in YYYYMMDD or YYYYMMDDHHMMSS format');
          resolve();
        });
      });
    });

    it('should validate date range order', () => {
      return new Promise(resolve => {
        banking.getStatement({ start: 20241201, end: 20241101 }, (err, res) => {
          expect(err).toBeInstanceOf(Banking.InvalidDateRangeError);
          expect(err.message).toContain('Start date must be before end date');
          resolve();
        });
      });
    });

    it('should accept valid date formats', done => {
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
</STATUS>
<DTSERVER>20241101000000
<LANGUAGE>ENG
<FI>
<ORG>Wells Fargo
<FID>4000
</FI>
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>USD
<BANKACCTFROM>
<BANKID>121000248
<ACCTID>123456789
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20241101
<DTEND>20241201
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>1000.00
<DTASOF>20241201
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`
        );

      // Test YYYYMMDD format
      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeFalsy();
        expect(res).toBeDefined();
        done();
      });
    });
  });

  describe('Error Factory Function', () => {
    it('should create appropriate error types from factory', () => {
      const dnsError = Banking.createBankingError({
        message: 'DNS lookup failed',
        originalError: { code: 'ENOTFOUND' }
      });
      expect(dnsError).toBeInstanceOf(Banking.DNSError);

      const authError = Banking.createBankingError({
        message: 'Invalid credentials',
        httpStatus: 401
      });
      expect(authError).toBeInstanceOf(Banking.InvalidCredentialsError);

      const rateError = Banking.createBankingError({
        message: 'Rate limited',
        code: 'RATE_LIMITED'
      });
      expect(rateError).toBeInstanceOf(Banking.RateLimitError);
    });

    it('should preserve banking context in factory-created errors', () => {
      const error = Banking.createBankingError(
        {
          message: 'Test error',
          httpStatus: 500
        },
        {
          fid: 12345,
          operationType: 'statement',
          url: 'https://bank.com/ofx'
        }
      );

      expect(error.bankingContext.fid).toBe(12345);
      expect(error.bankingContext.operationType).toBe('statement');
      expect(error.bankingContext.url).toBe('https://bank.com/ofx');
    });
  });

  describe('Error Serialization', () => {
    it('should serialize to JSON correctly', () => {
      const error = new Banking.TimeoutError('Connection timeout', {
        fid: 12345,
        operationType: 'statement',
        metadata: { timeoutValue: 30000 }
      });

      const json = JSON.stringify(error);
      const parsed = JSON.parse(json);

      expect(parsed.name).toBe('TimeoutError');
      expect(parsed.code).toBe('TIMEOUT_ERROR');
      expect(parsed.category).toBe('NETWORK');
      expect(parsed.retryable).toBe(true);
      expect(parsed.bankingContext.fid).toBe(12345);
      expect(parsed.bankingContext.operationType).toBe('statement');
    });

    it('should create log objects without sensitive data', () => {
      const error = new Banking.BankingError('Test error', {
        url: 'https://user:pass@bank.com/ofx?token=secret',
        metadata: { sensitiveData: 'should not appear in logs' }
      });

      const logObj = error.toLogObject();

      expect(logObj.bankingContext.url).not.toContain('user');
      expect(logObj.bankingContext.url).not.toContain('pass');
      expect(logObj.bankingContext.url).not.toContain('token');
      expect(logObj.bankingContext.url).not.toContain('secret');
    });
  });

  describe('Retry Recommendations', () => {
    it('should provide correct retry information for different error types', () => {
      const timeoutError = new Banking.TimeoutError('Timeout occurred');
      expect(timeoutError.retryable).toBe(true);
      expect(timeoutError.maxRetries).toBe(2);

      const dnsError = new Banking.DNSError('DNS failed');
      expect(dnsError.retryable).toBe(false);
      expect(dnsError.maxRetries).toBe(0);

      const authError = new Banking.InvalidCredentialsError('Bad credentials');
      expect(authError.retryable).toBe(false);

      const maintenanceError = new Banking.MaintenanceModeError('Under maintenance');
      expect(maintenanceError.retryable).toBe(true);
      expect(maintenanceError.retryAfter).toBe(3600);
    });

    it('should include actionable recommendations', () => {
      const connectionError = new Banking.ConnectionError('Connection failed');
      expect(connectionError.recommendations).toContain('Check network connectivity');
      expect(connectionError.recommendations).toContain('Verify firewall settings');

      const credentialsError = new Banking.InvalidCredentialsError('Invalid login');
      expect(credentialsError.recommendations).toContain('Verify username and password are correct');
      expect(credentialsError.recommendations).toContain('Check if account is locked or suspended');
    });
  });
});
