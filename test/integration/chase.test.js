import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import Banking from '../../index.js';
import {
  chaseStatementResponse,
  invalidCredentialsResponse,
  accountNotFoundResponse,
  malformedOFXResponse,
  bankConfigs
} from '../fixtures/responses.js';

describe('Chase Bank Integration Tests', () => {
  let banking;

  beforeEach(() => {
    banking = new Banking(bankConfigs.chase);
  });

  describe('getStatement', () => {
    it('should successfully retrieve Chase bank statement', done => {
      // Mock the OFX server response
      nock('https://ofx.chase.com').post('/').reply(200, chaseStatementResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body).toBeDefined();
        expect(res.body.OFX).toBeDefined();

        // Verify OFX structure
        const ofx = res.body.OFX;
        expect(ofx.SIGNONMSGSRSV1).toBeDefined();
        expect(ofx.SIGNONMSGSRSV1.SONRS.STATUS.CODE).toBe('0');
        expect(ofx.SIGNONMSGSRSV1.SONRS.FI.ORG).toBe('JPMorgan Chase Bank, N.A.');
        expect(ofx.SIGNONMSGSRSV1.SONRS.FI.FID).toBe('636');

        // Verify Chase-specific INTU.BID field
        expect(ofx.SIGNONMSGSRSV1.SONRS['INTU.BID']).toBe('636');

        // Verify bank statement data
        expect(ofx.BANKMSGSRSV1).toBeDefined();
        const stmtrs = ofx.BANKMSGSRSV1.STMTTRNRS.STMTRS;
        expect(stmtrs.CURDEF).toBe('USD');
        expect(stmtrs.BANKACCTFROM.BANKID).toBe('322271627');
        expect(stmtrs.BANKACCTFROM.ACCTID).toBe('5555666677');
        expect(stmtrs.BANKACCTFROM.ACCTTYPE).toBe('CHECKING');

        // Verify transactions
        const transactions = stmtrs.BANKTRANLIST.STMTTRN;
        expect(Array.isArray(transactions)).toBe(true);
        expect(transactions.length).toBeGreaterThan(0);

        // Verify specific Chase transactions
        const atmTransaction = transactions.find(t => t.NAME === 'ATM WITHDRAWAL');
        expect(atmTransaction).toBeDefined();
        expect(atmTransaction.TRNTYPE).toBe('DEBIT');
        expect(atmTransaction.TRNAMT).toBe('-75.00');
        expect(atmTransaction.MEMO).toBe('CHASE ATM #1234');

        const payrollTransaction = transactions.find(t => t.NAME === 'DIRECT DEPOSIT');
        expect(payrollTransaction).toBeDefined();
        expect(payrollTransaction.TRNTYPE).toBe('CREDIT');
        expect(payrollTransaction.TRNAMT).toBe('3000.00');

        const rentTransaction = transactions.find(t => t.NAME === 'RENT PAYMENT');
        expect(rentTransaction).toBeDefined();
        expect(rentTransaction.TRNTYPE).toBe('DEBIT');
        expect(rentTransaction.TRNAMT).toBe('-1200.00');
        expect(rentTransaction.MEMO).toBe('AUTO PAY RENT');

        // Verify balance information
        expect(stmtrs.LEDGERBAL).toBeDefined();
        expect(stmtrs.LEDGERBAL.BALAMT).toBe('1725.00');
        expect(stmtrs.AVAILBAL).toBeDefined();
        expect(stmtrs.AVAILBAL.BALAMT).toBe('1725.00');

        done();
      });
    });

    it('should handle Chase multi-factor authentication requirements', done => {
      // Chase may require additional authentication steps
      const mfaResponse = `OFXHEADER:100
DATA:OFXSGML
VERSION:103
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:test-uid-chase-mfa

<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS>
        <CODE>15000
        <SEVERITY>ERROR
        <MESSAGE>MFA CHALLENGE REQUIRED
      </STATUS>
      <DTSERVER>20241201120000.000[-5:EST]
      <LANGUAGE>ENG
      <FI>
        <ORG>JPMorgan Chase Bank, N.A.
        <FID>636
      </FI>
      <MFACHALLENGERQ>
        <MFACHALLENGE>Please check your email for verification code</MFACHALLENGE>
      </MFACHALLENGERQ>
    </SONRS>
  </SIGNONMSGSRSV1>
</OFX>`;

      nock('https://ofx.chase.com').post('/').reply(200, mfaResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.SIGNONMSGSRSV1.SONRS.STATUS.CODE).toBe('15000');
        expect(res.body.OFX.SIGNONMSGSRSV1.SONRS.STATUS.MESSAGE).toBe('MFA CHALLENGE REQUIRED');
        expect(res.body.OFX.SIGNONMSGSRSV1.SONRS.MFACHALLENGERQ).toBeDefined();
        done();
      });
    });

    it('should send Chase-specific request format with ClientUID', done => {
      const scope = nock('https://ofx.chase.com')
        .post('/', body => {
          // Verify Chase-specific OFX request format
          expect(body).toContain('OFXHEADER:100');
          expect(body).toContain('VERSION:103'); // Chase requires version 103
          expect(body).toContain('<USERID>testuser');
          expect(body).toContain('<USERPASS>testpass');
          expect(body).toContain('<FID>636');
          expect(body).toContain('<BANKID>322271627');
          expect(body).toContain('<ACCTID>5555666677');
          expect(body).toContain('<ACCTTYPE>CHECKING');

          // Chase-specific fields
          if (bankConfigs.chase.clientId) {
            expect(body).toContain('<CLIENTUID>test-client-id-123');
          }

          return true;
        })
        .reply(200, chaseStatementResponse);

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(scope.isDone()).toBe(true);
        expect(err).toBe(false);
        done();
      });
    });

    it('should handle Chase server errors gracefully', done => {
      nock('https://ofx.chase.com').post('/').reply(503, 'Service Temporarily Unavailable');

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        done();
      });
    });

    it('should handle Chase account verification errors', done => {
      const chaseAccountError = `OFXHEADER:100
DATA:OFXSGML
VERSION:103
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
      <TRNUID>chase-error-transaction
      <STATUS>
        <CODE>10403
        <SEVERITY>ERROR
        <MESSAGE>ACCOUNT VERIFICATION REQUIRED
      </STATUS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

      nock('https://ofx.chase.com').post('/').reply(200, chaseAccountError, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STATUS.CODE).toBe('10403');
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STATUS.MESSAGE).toBe('ACCOUNT VERIFICATION REQUIRED');
        done();
      });
    });
  });

  describe('getAccounts', () => {
    it('should successfully retrieve Chase account list', done => {
      const chaseAccountListResponse = `OFXHEADER:100
DATA:OFXSGML
VERSION:103
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:test-uid-chase-accounts

<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
        <MESSAGE>SUCCESS
      </STATUS>
      <DTSERVER>20241201120000.000[-5:EST]
      <LANGUAGE>ENG
      <FI>
        <ORG>JPMorgan Chase Bank, N.A.
        <FID>636
      </FI>
      <INTU.BID>636
    </SONRS>
  </SIGNONMSGSRSV1>
  <SIGNUPMSGSRSV1>
    <ACCTINFOTRNRS>
      <TRNUID>chase-accounts-uid-789
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
        <MESSAGE>SUCCESS
      </STATUS>
      <ACCTINFORS>
        <DTACCTUP>20241201120000.000
        <ACCTINFO>
          <BANKACCTINFO>
            <BANKACCTFROM>
              <BANKID>322271627
              <ACCTID>5555666677
              <ACCTTYPE>CHECKING
            </BANKACCTFROM>
            <SUPTXDL>Y
            <XFERSRC>Y
            <XFERDEST>Y
            <SVCSTATUS>ACTIVE
          </BANKACCTINFO>
        </ACCTINFO>
        <ACCTINFO>
          <BANKACCTINFO>
            <BANKACCTFROM>
              <BANKID>322271627
              <ACCTID>5555666688
              <ACCTTYPE>SAVINGS
            </BANKACCTFROM>
            <SUPTXDL>Y
            <XFERSRC>Y
            <XFERDEST>Y
            <SVCSTATUS>ACTIVE
          </BANKACCTINFO>
        </ACCTINFO>
        <ACCTINFO>
          <CCACCTINFO>
            <CCACCTFROM>
              <ACCTID>4111111111111111
            </CCACCTFROM>
            <SUPTXDL>Y
            <XFERSRC>N
            <XFERDEST>N
            <SVCSTATUS>ACTIVE
          </CCACCTINFO>
        </ACCTINFO>
      </ACCTINFORS>
    </ACCTINFOTRNRS>
  </SIGNUPMSGSRSV1>
</OFX>`;

      nock('https://ofx.chase.com').post('/').reply(200, chaseAccountListResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getAccounts((err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX).toBeDefined();

        const acctInfo = res.body.OFX.SIGNUPMSGSRSV1.ACCTINFOTRNRS.ACCTINFORS.ACCTINFO;
        expect(Array.isArray(acctInfo)).toBe(true);
        expect(acctInfo.length).toBe(3); // Checking, savings, and credit card

        // Verify checking account
        const checkingAccount = acctInfo.find(acc => acc.BANKACCTINFO && acc.BANKACCTINFO.BANKACCTFROM.ACCTTYPE === 'CHECKING');
        expect(checkingAccount).toBeDefined();
        expect(checkingAccount.BANKACCTINFO.BANKACCTFROM.ACCTID).toBe('5555666677');
        expect(checkingAccount.BANKACCTINFO.BANKACCTFROM.BANKID).toBe('322271627');

        // Verify savings account
        const savingsAccount = acctInfo.find(acc => acc.BANKACCTINFO && acc.BANKACCTINFO.BANKACCTFROM.ACCTTYPE === 'SAVINGS');
        expect(savingsAccount).toBeDefined();
        expect(savingsAccount.BANKACCTINFO.BANKACCTFROM.ACCTID).toBe('5555666688');

        // Verify credit card account
        const creditCardAccount = acctInfo.find(acc => acc.CCACCTINFO);
        expect(creditCardAccount).toBeDefined();
        expect(creditCardAccount.CCACCTINFO.CCACCTFROM.ACCTID).toBe('4111111111111111');
        expect(creditCardAccount.CCACCTINFO.SVCSTATUS).toBe('ACTIVE');

        done();
      });
    });
  });

  describe('Chase-Specific Error Handling', () => {
    it('should handle Chase rate limiting', done => {
      const rateLimitResponse = `OFXHEADER:100
DATA:OFXSGML
VERSION:103
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
        <MESSAGE>GENERAL ERROR - TOO MANY REQUESTS
      </STATUS>
      <DTSERVER>20241201120000.000
      <LANGUAGE>ENG
    </SONRS>
  </SIGNONMSGSRSV1>
</OFX>`;

      nock('https://ofx.chase.com').post('/').reply(429, rateLimitResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        done();
      });
    });

    it('should handle Chase maintenance windows', done => {
      const maintenanceResponse = `OFXHEADER:100
DATA:OFXSGML
VERSION:103
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
        <CODE>2025
        <SEVERITY>ERROR
        <MESSAGE>SYSTEM TEMPORARILY UNAVAILABLE
      </STATUS>
      <DTSERVER>20241201120000.000
      <LANGUAGE>ENG
    </SONRS>
  </SIGNONMSGSRSV1>
</OFX>`;

      nock('https://ofx.chase.com').post('/').reply(200, maintenanceResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.SIGNONMSGSRSV1.SONRS.STATUS.CODE).toBe('2025');
        expect(res.body.OFX.SIGNONMSGSRSV1.SONRS.STATUS.MESSAGE).toBe('SYSTEM TEMPORARILY UNAVAILABLE');
        done();
      });
    });

    it('should handle invalid date range errors', done => {
      const dateRangeError = `OFXHEADER:100
DATA:OFXSGML
VERSION:103
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
      <TRNUID>chase-date-error
      <STATUS>
        <CODE>2020
        <SEVERITY>ERROR
        <MESSAGE>INVALID DATE RANGE
      </STATUS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

      nock('https://ofx.chase.com').post('/').reply(200, dateRangeError, {
        'Content-Type': 'application/x-ofx'
      });

      // Test with invalid date range (end before start)
      banking.getStatement({ start: 20241201, end: 20241101 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STATUS.CODE).toBe('2020');
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STATUS.MESSAGE).toBe('INVALID DATE RANGE');
        done();
      });
    });
  });

  describe('Chase OFX Version Compatibility', () => {
    it('should work with OFX version 103 (required by Chase)', done => {
      const chaseWithV103 = new Banking({
        ...bankConfigs.chase,
        ofxVer: '103'
      });

      const scope = nock('https://ofx.chase.com')
        .post('/', body => {
          expect(body).toContain('VERSION:103');
          return true;
        })
        .reply(200, chaseStatementResponse);

      chaseWithV103.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(scope.isDone()).toBe(true);
        expect(err).toBe(false);
        done();
      });
    });

    it('should handle version mismatch gracefully', done => {
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
        <MESSAGE>INVALID OFX VERSION
      </STATUS>
      <DTSERVER>20241201120000.000
      <LANGUAGE>ENG
    </SONRS>
  </SIGNONMSGSRSV1>
</OFX>`;

      nock('https://ofx.chase.com').post('/').reply(200, versionErrorResponse, {
        'Content-Type': 'application/x-ofx'
      });

      const chaseWithOldVersion = new Banking({
        ...bankConfigs.chase,
        ofxVer: '102'
      });

      chaseWithOldVersion.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.SIGNONMSGSRSV1.SONRS.STATUS.CODE).toBe('10015');
        done();
      });
    });
  });
});
