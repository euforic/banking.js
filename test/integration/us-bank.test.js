import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import Banking from '../../index.js';
import {
  usBankStatementResponse,
  invalidCredentialsResponse,
  accountNotFoundResponse,
  malformedOFXResponse,
  bankConfigs
} from '../fixtures/responses.js';

describe('US Bank Integration Tests', () => {
  let banking;

  beforeEach(() => {
    banking = new Banking(bankConfigs.usBank);
  });

  describe('getStatement', () => {
    it('should successfully retrieve US Bank statement', done => {
      // Mock the OFX server response
      nock('https://www.usbank.com').post('/ofxroot').reply(200, usBankStatementResponse, {
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
        expect(ofx.SIGNONMSGSRSV1.SONRS.FI.ORG).toBe('U.S. Bank');
        expect(ofx.SIGNONMSGSRSV1.SONRS.FI.FID).toBe('1001');

        // Verify bank statement data
        expect(ofx.BANKMSGSRSV1).toBeDefined();
        const stmtrs = ofx.BANKMSGSRSV1.STMTTRNRS.STMTRS;
        expect(stmtrs.CURDEF).toBe('USD');
        expect(stmtrs.BANKACCTFROM.BANKID).toBe('091000022');
        expect(stmtrs.BANKACCTFROM.ACCTID).toBe('7777888899');
        expect(stmtrs.BANKACCTFROM.ACCTTYPE).toBe('SAVINGS');

        // Verify transactions
        const transactions = stmtrs.BANKTRANLIST.STMTTRN;
        expect(Array.isArray(transactions)).toBe(true);
        expect(transactions.length).toBeGreaterThan(0);

        // Verify specific US Bank transactions
        const transferTransaction = transactions.find(t => t.NAME === 'TRANSFER FROM CHECKING');
        expect(transferTransaction).toBeDefined();
        expect(transferTransaction.TRNTYPE).toBe('CREDIT');
        expect(transferTransaction.TRNAMT).toBe('5000.00');
        expect(transferTransaction.MEMO).toBe('INTERNAL TRANSFER');

        const interestTransaction = transactions.find(t => t.NAME === 'INTEREST PAYMENT');
        expect(interestTransaction).toBeDefined();
        expect(interestTransaction.TRNTYPE).toBe('CREDIT');
        expect(interestTransaction.TRNAMT).toBe('15.25');
        expect(interestTransaction.MEMO).toBe('MONTHLY INTEREST');

        // Verify balance information
        expect(stmtrs.LEDGERBAL).toBeDefined();
        expect(stmtrs.LEDGERBAL.BALAMT).toBe('15015.25');
        expect(stmtrs.AVAILBAL).toBeDefined();
        expect(stmtrs.AVAILBAL.BALAMT).toBe('15015.25');

        done();
      });
    });

    it('should handle US Bank authentication errors', done => {
      nock('https://www.usbank.com').post('/ofxroot').reply(200, invalidCredentialsResponse, {
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

    it('should send properly formatted US Bank OFX request', done => {
      const scope = nock('https://www.usbank.com')
        .post('/ofxroot', body => {
          // Verify US Bank-specific OFX request format
          expect(body).toContain('OFXHEADER:100');
          expect(body).toContain('DATA:OFXSGML');
          expect(body).toContain('VERSION:102');
          expect(body).toContain('<USERID>testuser');
          expect(body).toContain('<USERPASS>testpass');
          expect(body).toContain('<FID>1001');
          expect(body).toContain('<BANKID>091000022');
          expect(body).toContain('<ACCTID>7777888899');
          expect(body).toContain('<ACCTTYPE>SAVINGS');
          expect(body).toContain('<DTSTART>20241101');
          expect(body).toContain('<DTEND>20241201');
          return true;
        })
        .reply(200, usBankStatementResponse);

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(scope.isDone()).toBe(true);
        expect(err).toBe(false);
        done();
      });
    });

    it('should handle US Bank server errors', done => {
      nock('https://www.usbank.com').post('/ofxroot').reply(500, 'Internal Server Error');

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        done();
      });
    });

    it('should handle US Bank connection timeouts', done => {
      nock('https://www.usbank.com').post('/ofxroot').delay(8000).reply(200, usBankStatementResponse);

      const startTime = Date.now();
      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        const elapsedTime = Date.now() - startTime;
        expect(err).toBeTruthy();
        expect(elapsedTime).toBeGreaterThan(1000);
        done();
      });
    });

    it('should handle US Bank account not found error', done => {
      nock('https://www.usbank.com').post('/ofxroot').reply(200, accountNotFoundResponse, {
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
  });

  describe('getAccounts', () => {
    it('should successfully retrieve US Bank account list', done => {
      const usBankAccountListResponse = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:test-uid-usbank-accounts

<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
        <MESSAGE>SUCCESS
      </STATUS>
      <DTSERVER>20241201120000.000[-6:CST]
      <LANGUAGE>ENG
      <FI>
        <ORG>U.S. Bank
        <FID>1001
      </FI>
    </SONRS>
  </SIGNONMSGSRSV1>
  <SIGNUPMSGSRSV1>
    <ACCTINFOTRNRS>
      <TRNUID>usbank-accounts-uid-202
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
              <BANKID>091000022
              <ACCTID>7777888899
              <ACCTTYPE>SAVINGS
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
              <BANKID>091000022
              <ACCTID>1111222233
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
              <BANKID>091000022
              <ACCTID>9999888877
              <ACCTTYPE>MONEYMRKT
            </BANKACCTFROM>
            <SUPTXDL>Y
            <XFERSRC>Y
            <XFERDEST>Y
            <SVCSTATUS>ACTIVE
          </BANKACCTINFO>
        </ACCTINFO>
      </ACCTINFORS>
    </ACCTINFOTRNRS>
  </SIGNUPMSGSRSV1>
</OFX>`;

      nock('https://www.usbank.com').post('/ofxroot').reply(200, usBankAccountListResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getAccounts((err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX).toBeDefined();

        const acctInfo = res.body.OFX.SIGNUPMSGSRSV1.ACCTINFOTRNRS.ACCTINFORS.ACCTINFO;
        expect(Array.isArray(acctInfo)).toBe(true);
        expect(acctInfo.length).toBe(3); // Savings, checking, and money market

        // Verify savings account
        const savingsAccount = acctInfo.find(acc => acc.BANKACCTINFO && acc.BANKACCTINFO.BANKACCTFROM.ACCTTYPE === 'SAVINGS');
        expect(savingsAccount).toBeDefined();
        expect(savingsAccount.BANKACCTINFO.BANKACCTFROM.ACCTID).toBe('7777888899');
        expect(savingsAccount.BANKACCTINFO.BANKACCTFROM.BANKID).toBe('091000022');
        expect(savingsAccount.BANKACCTINFO.SVCSTATUS).toBe('ACTIVE');

        // Verify checking account
        const checkingAccount = acctInfo.find(acc => acc.BANKACCTINFO && acc.BANKACCTINFO.BANKACCTFROM.ACCTTYPE === 'CHECKING');
        expect(checkingAccount).toBeDefined();
        expect(checkingAccount.BANKACCTINFO.BANKACCTFROM.ACCTID).toBe('1111222233');

        // Verify money market account
        const moneyMarketAccount = acctInfo.find(acc => acc.BANKACCTINFO && acc.BANKACCTINFO.BANKACCTFROM.ACCTTYPE === 'MONEYMRKT');
        expect(moneyMarketAccount).toBeDefined();
        expect(moneyMarketAccount.BANKACCTINFO.BANKACCTFROM.ACCTID).toBe('9999888877');
        expect(moneyMarketAccount.BANKACCTINFO.SVCSTATUS).toBe('ACTIVE');

        done();
      });
    });
  });

  describe('US Bank Specific Features', () => {
    it('should handle US Bank interest calculations correctly', done => {
      nock('https://www.usbank.com').post('/ofxroot').reply(200, usBankStatementResponse);

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);

        const transactions = res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST.STMTTRN;

        // Verify interest transaction handling
        const interestTransactions = transactions.filter(t => t.NAME === 'INTEREST PAYMENT' || t.MEMO === 'MONTHLY INTEREST');
        expect(interestTransactions.length).toBeGreaterThan(0);

        const interestTransaction = interestTransactions[0];
        expect(interestTransaction.TRNTYPE).toBe('CREDIT');
        expect(parseFloat(interestTransaction.TRNAMT)).toBeGreaterThan(0);

        done();
      });
    });

    it('should handle US Bank internal transfers', done => {
      nock('https://www.usbank.com').post('/ofxroot').reply(200, usBankStatementResponse);

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);

        const transactions = res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST.STMTTRN;

        // Verify internal transfer transaction
        const transferTransactions = transactions.filter(t => t.MEMO === 'INTERNAL TRANSFER' || t.NAME.includes('TRANSFER'));
        expect(transferTransactions.length).toBeGreaterThan(0);

        const transferTransaction = transferTransactions[0];
        expect(transferTransaction.NAME).toBe('TRANSFER FROM CHECKING');
        expect(transferTransaction.TRNTYPE).toBe('CREDIT');
        expect(parseFloat(transferTransaction.TRNAMT)).toBeGreaterThan(0);

        done();
      });
    });

    it('should handle US Bank routing number validation', done => {
      const invalidRoutingBanking = new Banking({
        ...bankConfigs.usBank,
        bankId: '999999999' // Invalid routing number
      });

      const invalidRoutingResponse = `OFXHEADER:100
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
      <TRNUID>invalid-routing-error
      <STATUS>
        <CODE>10400
        <SEVERITY>ERROR
        <MESSAGE>INVALID BANK ROUTING NUMBER
      </STATUS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

      nock('https://www.usbank.com').post('/ofxroot').reply(200, invalidRoutingResponse, {
        'Content-Type': 'application/x-ofx'
      });

      invalidRoutingBanking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STATUS.CODE).toBe('10400');
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STATUS.MESSAGE).toBe('INVALID BANK ROUTING NUMBER');
        done();
      });
    });

    it('should handle US Bank account closure scenarios', done => {
      const closedAccountResponse = `OFXHEADER:100
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
      <TRNUID>closed-account-error
      <STATUS>
        <CODE>10404
        <SEVERITY>ERROR
        <MESSAGE>ACCOUNT CLOSED
      </STATUS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

      nock('https://www.usbank.com').post('/ofxroot').reply(200, closedAccountResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STATUS.CODE).toBe('10404');
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STATUS.MESSAGE).toBe('ACCOUNT CLOSED');
        done();
      });
    });

    it('should handle different savings account types', done => {
      // Test with a different savings account configuration
      const premiumSavingsBanking = new Banking({
        ...bankConfigs.usBank,
        accId: '5555666677',
        accType: 'SAVINGS'
      });

      const premiumSavingsResponse = usBankStatementResponse.replace('<ACCTID>7777888899', '<ACCTID>5555666677');

      const scope = nock('https://www.usbank.com')
        .post('/ofxroot', body => {
          expect(body).toContain('<ACCTID>5555666677');
          expect(body).toContain('<ACCTTYPE>SAVINGS');
          return true;
        })
        .reply(200, premiumSavingsResponse);

      premiumSavingsBanking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(scope.isDone()).toBe(true);
        expect(err).toBe(false);
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKACCTFROM.ACCTID).toBe('5555666677');
        done();
      });
    });
  });

  describe('US Bank Error Scenarios', () => {
    it('should handle US Bank maintenance windows', done => {
      const maintenanceResponse = `OFXHEADER:100
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
        <CODE>2025
        <SEVERITY>ERROR
        <MESSAGE>SYSTEM UNAVAILABLE - MAINTENANCE
      </STATUS>
      <DTSERVER>20241201120000.000
      <LANGUAGE>ENG
    </SONRS>
  </SIGNONMSGSRSV1>
</OFX>`;

      nock('https://www.usbank.com').post('/ofxroot').reply(503, maintenanceResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        done();
      });
    });

    it('should handle malformed OFX responses', done => {
      nock('https://www.usbank.com').post('/ofxroot').reply(200, malformedOFXResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        done();
      });
    });

    it('should handle network connectivity issues', done => {
      nock('https://www.usbank.com').post('/ofxroot').replyWithError('ENETUNREACH');

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        expect(err.code).toBe('ENETUNREACH');
        done();
      });
    });

    it('should handle US Bank rate limiting', done => {
      nock('https://www.usbank.com').post('/ofxroot').reply(429, 'Too Many Requests', {
        'Retry-After': '60'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        done();
      });
    });
  });

  describe('Date and Transaction Handling', () => {
    it('should handle empty transaction periods', done => {
      const emptyTransactionResponse = usBankStatementResponse.replace(/<STMTTRN>[\s\S]*?<\/STMTTRN>/g, '');

      nock('https://www.usbank.com').post('/ofxroot').reply(200, emptyTransactionResponse);

      banking.getStatement({ start: 20241101, end: 20241102 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST).toBeDefined();
        done();
      });
    });

    it('should validate date range parameters', done => {
      const scope = nock('https://www.usbank.com')
        .post('/ofxroot', body => {
          expect(body).toContain('<DTSTART>20241101');
          expect(body).toContain('<DTEND>20241201');
          return true;
        })
        .reply(200, usBankStatementResponse);

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(scope.isDone()).toBe(true);
        expect(err).toBe(false);
        done();
      });
    });
  });
});
