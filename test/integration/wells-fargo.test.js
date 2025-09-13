import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import Banking from '../../index.js';
import {
  wellsFargoStatementResponse,
  wellsFargoAccountListResponse,
  invalidCredentialsResponse,
  accountNotFoundResponse,
  malformedOFXResponse,
  bankConfigs
} from '../fixtures/responses.js';

describe('Wells Fargo Integration Tests', () => {
  let banking;

  beforeEach(() => {
    banking = new Banking(bankConfigs.wellsFargo);
  });

  describe('getStatement', () => {
    it('should successfully retrieve transaction statement', done => {
      // Mock the OFX server response
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, wellsFargoStatementResponse, {
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
        expect(ofx.SIGNONMSGSRSV1.SONRS.FI.ORG).toBe('Wells Fargo');
        expect(ofx.SIGNONMSGSRSV1.SONRS.FI.FID).toBe('3001');

        // Verify bank statement data
        expect(ofx.BANKMSGSRSV1).toBeDefined();
        const stmtrs = ofx.BANKMSGSRSV1.STMTTRNRS.STMTRS;
        expect(stmtrs.CURDEF).toBe('USD');
        expect(stmtrs.BANKACCTFROM.BANKID).toBe('123006800');
        expect(stmtrs.BANKACCTFROM.ACCTID).toBe('1234567890');
        expect(stmtrs.BANKACCTFROM.ACCTTYPE).toBe('CHECKING');

        // Verify transactions
        const transactions = stmtrs.BANKTRANLIST.STMTTRN;
        expect(Array.isArray(transactions)).toBe(true);
        expect(transactions.length).toBeGreaterThan(0);

        // Verify specific transaction data
        const debitTransaction = transactions.find(t => t.TRNTYPE === 'DEBIT');
        expect(debitTransaction).toBeDefined();
        expect(debitTransaction.TRNAMT).toBe('-150.00');
        expect(debitTransaction.NAME).toBe('GROCERY STORE PURCHASE');

        const creditTransaction = transactions.find(t => t.TRNTYPE === 'CREDIT');
        expect(creditTransaction).toBeDefined();
        expect(creditTransaction.TRNAMT).toBe('2500.00');
        expect(creditTransaction.NAME).toBe('DIRECT DEPOSIT');

        // Verify balance information
        expect(stmtrs.LEDGERBAL).toBeDefined();
        expect(stmtrs.LEDGERBAL.BALAMT).toBe('2338.00');
        expect(stmtrs.AVAILBAL).toBeDefined();
        expect(stmtrs.AVAILBAL.BALAMT).toBe('2338.00');

        done();
      });
    });

    it('should handle invalid credentials error', done => {
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

    it('should handle account not found error', done => {
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

    it('should handle network timeout', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').delay(5000).reply(200, wellsFargoStatementResponse);

      const startTime = Date.now();
      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        const elapsedTime = Date.now() - startTime;
        expect(err).toBeTruthy();
        expect(elapsedTime).toBeGreaterThan(1000); // Should timeout
        done();
      });
    });

    it('should handle malformed OFX response', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, malformedOFXResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        // Should handle parsing errors gracefully
        expect(err).toBeTruthy();
        done();
      });
    });

    it('should handle HTTP 500 server error', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(500, 'Internal Server Error');

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        done();
      });
    });
  });

  describe('getAccounts', () => {
    it('should successfully retrieve account list', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, wellsFargoAccountListResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getAccounts((err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body).toBeDefined();
        expect(res.body.OFX).toBeDefined();

        // Verify OFX structure
        const ofx = res.body.OFX;
        expect(ofx.SIGNONMSGSRSV1).toBeDefined();
        expect(ofx.SIGNONMSGSRSV1.SONRS.STATUS.CODE).toBe('0');

        // Verify account information
        expect(ofx.SIGNUPMSGSRSV1).toBeDefined();
        const acctInfo = ofx.SIGNUPMSGSRSV1.ACCTINFOTRNRS.ACCTINFORS.ACCTINFO;
        expect(Array.isArray(acctInfo)).toBe(true);
        expect(acctInfo.length).toBeGreaterThan(0);

        // Verify checking account
        const checkingAccount = acctInfo.find(acc => acc.BANKACCTINFO && acc.BANKACCTINFO.BANKACCTFROM.ACCTTYPE === 'CHECKING');
        expect(checkingAccount).toBeDefined();
        expect(checkingAccount.BANKACCTINFO.BANKACCTFROM.ACCTID).toBe('1234567890');
        expect(checkingAccount.BANKACCTINFO.BANKACCTFROM.BANKID).toBe('123006800');
        expect(checkingAccount.BANKACCTINFO.SVCSTATUS).toBe('ACTIVE');

        // Verify savings account
        const savingsAccount = acctInfo.find(acc => acc.BANKACCTINFO && acc.BANKACCTINFO.BANKACCTFROM.ACCTTYPE === 'SAVINGS');
        expect(savingsAccount).toBeDefined();
        expect(savingsAccount.BANKACCTINFO.BANKACCTFROM.ACCTID).toBe('9876543210');
        expect(savingsAccount.BANKACCTINFO.SVCSTATUS).toBe('ACTIVE');

        done();
      });
    });

    it('should handle authentication error for account list', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, invalidCredentialsResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getAccounts((err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.SIGNONMSGSRSV1.SONRS.STATUS.CODE).toBe('15500');
        done();
      });
    });
  });

  describe('OFX Request Validation', () => {
    it('should send properly formatted OFX request for statement', done => {
      const scope = nock('https://www.oasis.cfree.com')
        .post('/3001.ofxgp', body => {
          // Verify OFX request format
          expect(body).toContain('OFXHEADER:100');
          expect(body).toContain('DATA:OFXSGML');
          expect(body).toContain('VERSION:');
          expect(body).toContain('<USERID>testuser');
          expect(body).toContain('<USERPASS>testpass');
          expect(body).toContain('<FID>3001');
          expect(body).toContain('<BANKID>123006800');
          expect(body).toContain('<ACCTID>1234567890');
          expect(body).toContain('<ACCTTYPE>CHECKING');
          expect(body).toContain('<DTSTART>20241101');
          expect(body).toContain('<DTEND>20241201');
          return true;
        })
        .reply(200, wellsFargoStatementResponse);

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(scope.isDone()).toBe(true);
        expect(err).toBe(false);
        done();
      });
    });

    it('should send properly formatted OFX request for account list', done => {
      const scope = nock('https://www.oasis.cfree.com')
        .post('/3001.ofxgp', body => {
          // Verify OFX account list request format
          expect(body).toContain('OFXHEADER:100');
          expect(body).toContain('<USERID>testuser');
          expect(body).toContain('<USERPASS>testpass');
          expect(body).toContain('<FID>3001');
          expect(body).toContain('<ACCTINFORQ>');
          return true;
        })
        .reply(200, wellsFargoAccountListResponse);

      banking.getAccounts((err, res) => {
        expect(scope.isDone()).toBe(true);
        expect(err).toBe(false);
        done();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty transaction list', done => {
      const emptyTransactionResponse = wellsFargoStatementResponse.replace(/<STMTTRN>[\s\S]*?<\/STMTTRN>/g, '');

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, emptyTransactionResponse);

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST).toBeDefined();
        done();
      });
    });

    it('should handle different date ranges', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, wellsFargoStatementResponse);

      banking.getStatement({ start: 20240101, end: 20241231 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        done();
      });
    });

    it('should handle custom headers', done => {
      const customBanking = new Banking({
        ...bankConfigs.wellsFargo,
        headers: ['Content-Type', 'Host', 'Content-Length', 'Connection']
      });

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, wellsFargoStatementResponse);

      customBanking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        done();
      });
    });
  });
});
