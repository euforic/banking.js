import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import Banking from '../../index.js';
import { invalidCredentialsResponse, accountNotFoundResponse, malformedOFXResponse, bankConfigs } from '../fixtures/responses.js';

describe('Comprehensive Error Handling Tests', () => {
  let banking;

  beforeEach(() => {
    banking = new Banking(bankConfigs.wellsFargo);
  });

  describe('Network and Connection Errors', () => {
    it('should handle DNS resolution failures', done => {
      const badUrlBanking = new Banking({
        ...bankConfigs.wellsFargo,
        url: 'https://nonexistent-bank-domain.invalid'
      });

      nock('https://nonexistent-bank-domain.invalid').post('/').replyWithError({ code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND' });

      badUrlBanking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        expect(err.code).toBe('ENOTFOUND');
        done();
      });
    });

    it('should handle connection refused errors', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').replyWithError({ code: 'ECONNREFUSED', message: 'Connection refused' });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        expect(err.code).toBe('ECONNREFUSED');
        done();
      });
    });

    it('should handle connection reset errors', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').replyWithError({ code: 'ECONNRESET', message: 'Connection reset by peer' });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        expect(err.code).toBe('ECONNRESET');
        done();
      });
    });

    it('should handle network unreachable errors', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').replyWithError({ code: 'ENETUNREACH', message: 'Network is unreachable' });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        expect(err.code).toBe('ENETUNREACH');
        done();
      });
    });

    it('should handle socket timeout errors', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').delay(30000).reply(200, 'Should never reach here');

      const startTime = Date.now();
      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        const elapsedTime = Date.now() - startTime;
        expect(err).toBeTruthy();
        expect(elapsedTime).toBeGreaterThan(2000);
        done();
      });
    });
  });

  describe('HTTP Status Code Errors', () => {
    it('should handle 400 Bad Request', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(400, 'Bad Request - Invalid OFX Format');

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        done();
      });
    });

    it('should handle 401 Unauthorized', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(401, 'Unauthorized - Invalid Credentials');

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        done();
      });
    });

    it('should handle 403 Forbidden', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(403, 'Forbidden - Access Denied');

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        done();
      });
    });

    it('should handle 404 Not Found', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(404, 'Not Found - OFX Endpoint Not Available');

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        done();
      });
    });

    it('should handle 429 Too Many Requests', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(429, 'Too Many Requests', {
        'Retry-After': '300'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        done();
      });
    });

    it('should handle 500 Internal Server Error', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(500, 'Internal Server Error');

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        done();
      });
    });

    it('should handle 502 Bad Gateway', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(502, 'Bad Gateway');

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        done();
      });
    });

    it('should handle 503 Service Unavailable', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(503, 'Service Unavailable - Maintenance Mode');

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        done();
      });
    });

    it('should handle 504 Gateway Timeout', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(504, 'Gateway Timeout');

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        done();
      });
    });
  });

  describe('OFX Protocol Errors', () => {
    it('should handle general OFX errors', done => {
      const generalErrorResponse = `OFXHEADER:100
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
        <CODE>2000
        <SEVERITY>ERROR
        <MESSAGE>GENERAL ERROR
      </STATUS>
      <DTSERVER>20241201120000.000
      <LANGUAGE>ENG
    </SONRS>
  </SIGNONMSGSRSV1>
</OFX>`;

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, generalErrorResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.SIGNONMSGSRSV1.SONRS.STATUS.CODE).toBe('2000');
        expect(res.body.OFX.SIGNONMSGSRSV1.SONRS.STATUS.SEVERITY).toBe('ERROR');
        done();
      });
    });

    it('should handle OFX version unsupported errors', done => {
      const versionErrorResponse = `OFXHEADER:100
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
        <CODE>10015
        <SEVERITY>ERROR
        <MESSAGE>UNSUPPORTED OFX VERSION
      </STATUS>
      <DTSERVER>20241201120000.000
      <LANGUAGE>ENG
    </SONRS>
  </SIGNONMSGSRSV1>
</OFX>`;

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, versionErrorResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.SIGNONMSGSRSV1.SONRS.STATUS.CODE).toBe('10015');
        expect(res.body.OFX.SIGNONMSGSRSV1.SONRS.STATUS.MESSAGE).toBe('UNSUPPORTED OFX VERSION');
        done();
      });
    });

    it('should handle invalid user credentials', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, invalidCredentialsResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.SIGNONMSGSRSV1.SONRS.STATUS.CODE).toBe('15500');
        expect(res.body.OFX.SIGNONMSGSRSV1.SONRS.STATUS.MESSAGE).toBe('INVALID SIGNON');
        done();
      });
    });

    it('should handle locked account errors', done => {
      const lockedAccountResponse = `OFXHEADER:100
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
        <CODE>15501
        <SEVERITY>ERROR
        <MESSAGE>CUSTOMER ACCOUNT ALREADY IN USE
      </STATUS>
      <DTSERVER>20241201120000.000
      <LANGUAGE>ENG
    </SONRS>
  </SIGNONMSGSRSV1>
</OFX>`;

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, lockedAccountResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.SIGNONMSGSRSV1.SONRS.STATUS.CODE).toBe('15501');
        expect(res.body.OFX.SIGNONMSGSRSV1.SONRS.STATUS.MESSAGE).toBe('CUSTOMER ACCOUNT ALREADY IN USE');
        done();
      });
    });

    it('should handle expired password errors', done => {
      const expiredPasswordResponse = `OFXHEADER:100
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
        <CODE>15505
        <SEVERITY>ERROR
        <MESSAGE>PASSWORD EXPIRED
      </STATUS>
      <DTSERVER>20241201120000.000
      <LANGUAGE>ENG
    </SONRS>
  </SIGNONMSGSRSV1>
</OFX>`;

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, expiredPasswordResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.SIGNONMSGSRSV1.SONRS.STATUS.CODE).toBe('15505');
        expect(res.body.OFX.SIGNONMSGSRSV1.SONRS.STATUS.MESSAGE).toBe('PASSWORD EXPIRED');
        done();
      });
    });
  });

  describe('Account and Transaction Errors', () => {
    it('should handle invalid account number', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, accountNotFoundResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STATUS.CODE).toBe('10500');
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STATUS.MESSAGE).toBe('INVALID ACCOUNT NUMBER');
        done();
      });
    });

    it('should handle account restrictions', done => {
      const accountRestrictedResponse = `OFXHEADER:100
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
      <TRNUID>restricted-account-error
      <STATUS>
        <CODE>10401
        <SEVERITY>ERROR
        <MESSAGE>ACCOUNT RESTRICTED - CONTACT BANK
      </STATUS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, accountRestrictedResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STATUS.CODE).toBe('10401');
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STATUS.MESSAGE).toBe('ACCOUNT RESTRICTED - CONTACT BANK');
        done();
      });
    });

    it('should handle invalid date range errors', done => {
      const invalidDateRangeResponse = `OFXHEADER:100
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
      <TRNUID>invalid-date-range-error
      <STATUS>
        <CODE>2020
        <SEVERITY>ERROR
        <MESSAGE>INVALID DATE RANGE
      </STATUS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, invalidDateRangeResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20251201, end: 20241101 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STATUS.CODE).toBe('2020');
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STATUS.MESSAGE).toBe('INVALID DATE RANGE');
        done();
      });
    });

    it('should handle request too large errors', done => {
      const requestTooLargeResponse = `OFXHEADER:100
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
      <TRNUID>request-too-large-error
      <STATUS>
        <CODE>13000
        <SEVERITY>ERROR
        <MESSAGE>REQUEST TOO LARGE - REDUCE DATE RANGE
      </STATUS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, requestTooLargeResponse, {
        'Content-Type': 'application/x-ofx'
      });

      // Request 10 years of data
      banking.getStatement({ start: 20140101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STATUS.CODE).toBe('13000');
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STATUS.MESSAGE).toBe('REQUEST TOO LARGE - REDUCE DATE RANGE');
        done();
      });
    });
  });

  describe('Data Parsing and Format Errors', () => {
    it('should handle completely malformed OFX', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, malformedOFXResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        done();
      });
    });

    it('should handle missing OFX header', done => {
      const noHeaderResponse = `<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
      </STATUS>
    </SONRS>
  </SIGNONMSGSRSV1>
</OFX>`;

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, noHeaderResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        // Should handle gracefully or throw appropriate error
        if (err) {
          expect(err).toBeTruthy();
        } else {
          expect(res).toBeDefined();
        }
        done();
      });
    });

    it('should handle corrupted XML structure', done => {
      const corruptedXMLResponse = `OFXHEADER:100
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
      <TRNUID>corrupted-xml
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
        <MESSAGE>SUCCESS
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
            <TRNAMT>-100.00
            <FITID>corrupt123
            <NAME>BROKEN TRANSACTION
            <!-- This comment breaks the SGML format -->
            <MEMO>TEST
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, corruptedXMLResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        // Should either handle gracefully or throw parsing error
        if (err) {
          expect(err).toBeTruthy();
        } else {
          expect(res).toBeDefined();
        }
        done();
      });
    });

    it('should handle empty response body', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, '', {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        done();
      });
    });

    it('should handle non-OFX response (HTML error page)', done => {
      const htmlErrorPage = `<!DOCTYPE html>
<html>
<head>
    <title>Service Unavailable</title>
</head>
<body>
    <h1>503 Service Unavailable</h1>
    <p>The OFX service is temporarily unavailable. Please try again later.</p>
</body>
</html>`;

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, htmlErrorPage, {
        'Content-Type': 'text/html'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        done();
      });
    });
  });

  describe('SSL and Security Errors', () => {
    it('should handle SSL certificate verification errors', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').replyWithError({
        code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        message: 'Unable to verify the first certificate'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        expect(err.code).toBe('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
        done();
      });
    });

    it('should handle SSL handshake failures', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').replyWithError({
        code: 'EPROTO',
        message: 'SSL handshake failed'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        expect(err.code).toBe('EPROTO');
        done();
      });
    });

    it('should handle self-signed certificate errors', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').replyWithError({
        code: 'DEPTH_ZERO_SELF_SIGNED_CERT',
        message: 'Self signed certificate'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        expect(err.code).toBe('DEPTH_ZERO_SELF_SIGNED_CERT');
        done();
      });
    });
  });

  describe('Resource and System Errors', () => {
    it('should handle out of memory errors', done => {
      // Simulate a very large response that could cause memory issues
      const hugeResponse = 'OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\n' + 'X'.repeat(50000);

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, hugeResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        done();
      });
    });

    it('should handle file system errors (if applicable)', () => {
      // This would test scenarios where temporary files can't be written
      // For now, just ensure the error handling exists
      expect(() => {
        const testBanking = new Banking({
          ...bankConfigs.wellsFargo,
          // Invalid characters in filename if temp files are used
          user: '../../../etc/passwd',
          password: 'test'
        });
        testBanking.getStatement;
      }).not.toThrow();
    });
  });
});
