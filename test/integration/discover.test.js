import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import Banking from '../../index.js';
import { discoverCardStatementResponse, invalidCredentialsResponse, malformedOFXResponse, bankConfigs } from '../fixtures/responses.js';

describe('Discover Financial Integration Tests', () => {
  let banking;

  beforeEach(() => {
    banking = new Banking(bankConfigs.discover);
  });

  describe('getStatement', () => {
    it('should successfully retrieve credit card statement', done => {
      // Mock the OFX server response
      nock('https://ofx.discovercard.com').post('/').reply(200, discoverCardStatementResponse, {
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
        expect(ofx.SIGNONMSGSRSV1.SONRS.FI.ORG).toBe('Discover Financial Services');
        expect(ofx.SIGNONMSGSRSV1.SONRS.FI.FID).toBe('7101');

        // Verify credit card statement data (different structure than bank statements)
        expect(ofx.CREDITCARDMSGSRSV1).toBeDefined();
        const ccstmtrs = ofx.CREDITCARDMSGSRSV1.CCSTMTTRNRS.CCSTMTRS;
        expect(ccstmtrs.CURDEF).toBe('USD');
        expect(ccstmtrs.CCACCTFROM.ACCTID).toBe('6011123456789012');

        // Verify transactions
        const transactions = ccstmtrs.BANKTRANLIST.STMTTRN;
        expect(Array.isArray(transactions)).toBe(true);
        expect(transactions.length).toBeGreaterThan(0);

        // Verify specific transaction data
        const amazonTransaction = transactions.find(t => t.NAME === 'AMAZON.COM');
        expect(amazonTransaction).toBeDefined();
        expect(amazonTransaction.TRNTYPE).toBe('DEBIT');
        expect(amazonTransaction.TRNAMT).toBe('-89.99');
        expect(amazonTransaction.MEMO).toBe('ONLINE PURCHASE');

        const paymentTransaction = transactions.find(t => t.NAME === 'PAYMENT THANK YOU');
        expect(paymentTransaction).toBeDefined();
        expect(paymentTransaction.TRNTYPE).toBe('CREDIT');
        expect(paymentTransaction.TRNAMT).toBe('100.00');

        // Verify balance information (credit cards show negative balance when you owe money)
        expect(ccstmtrs.LEDGERBAL).toBeDefined();
        expect(ccstmtrs.LEDGERBAL.BALAMT).toBe('-35.66');

        done();
      });
    });

    it('should handle invalid credentials for Discover', done => {
      nock('https://ofx.discovercard.com').post('/').reply(200, invalidCredentialsResponse, {
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

    it('should handle Discover-specific headers correctly', done => {
      const discoverWithHeaders = new Banking({
        ...bankConfigs.discover,
        headers: ['Content-Type', 'Host', 'Content-Length', 'Connection']
      });

      const scope = nock('https://ofx.discovercard.com')
        .post('/', body => {
          // Verify Discover-specific OFX request
          expect(body).toContain('OFXHEADER:100');
          expect(body).toContain('<FID>7101');
          expect(body).toContain('<ACCTID>6011123456789012');
          expect(body).not.toContain('<BANKID>'); // Credit cards don't use bank routing numbers
          return true;
        })
        .reply(200, discoverCardStatementResponse);

      discoverWithHeaders.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(scope.isDone()).toBe(true);
        expect(err).toBe(false);
        expect(res).toBeDefined();
        done();
      });
    });

    it('should handle HTTP errors from Discover servers', done => {
      nock('https://ofx.discovercard.com').post('/').reply(503, 'Service Unavailable');

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        done();
      });
    });

    it('should handle connection timeouts', done => {
      nock('https://ofx.discovercard.com').post('/').delay(10000).reply(200, discoverCardStatementResponse);

      const startTime = Date.now();
      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        const elapsedTime = Date.now() - startTime;
        expect(err).toBeTruthy();
        expect(elapsedTime).toBeGreaterThan(1000);
        done();
      });
    });

    it('should handle malformed responses from Discover', done => {
      nock('https://ofx.discovercard.com').post('/').reply(200, malformedOFXResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        done();
      });
    });
  });

  describe('getAccounts', () => {
    it('should successfully retrieve Discover card account info', done => {
      const discoverAccountResponse = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:test-uid-discover-accounts

<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
      </STATUS>
      <DTSERVER>20241201120000.000[-5:EST]
      <LANGUAGE>ENG
      <FI>
        <ORG>Discover Financial Services
        <FID>7101
      </FI>
    </SONRS>
  </SIGNONMSGSRSV1>
  <SIGNUPMSGSRSV1>
    <ACCTINFOTRNRS>
      <TRNUID>discover-accounts-uid-456
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
      </STATUS>
      <ACCTINFORS>
        <DTACCTUP>20241201120000.000
        <ACCTINFO>
          <CCACCTINFO>
            <CCACCTFROM>
              <ACCTID>6011123456789012
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

      nock('https://ofx.discovercard.com').post('/').reply(200, discoverAccountResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getAccounts((err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX).toBeDefined();

        const acctInfo = res.body.OFX.SIGNUPMSGSRSV1.ACCTINFOTRNRS.ACCTINFORS.ACCTINFO;
        expect(acctInfo.CCACCTINFO).toBeDefined();
        expect(acctInfo.CCACCTINFO.CCACCTFROM.ACCTID).toBe('6011123456789012');
        expect(acctInfo.CCACCTINFO.SVCSTATUS).toBe('ACTIVE');
        expect(acctInfo.CCACCTINFO.SUPTXDL).toBe('Y'); // Supports transaction download

        done();
      });
    });

    it('should handle authentication error for Discover account list', done => {
      nock('https://ofx.discovercard.com').post('/').reply(200, invalidCredentialsResponse, {
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

  describe('Credit Card Specific Features', () => {
    it('should correctly parse credit card transaction types', done => {
      nock('https://ofx.discovercard.com').post('/').reply(200, discoverCardStatementResponse);

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);

        const transactions = res.body.OFX.CREDITCARDMSGSRSV1.CCSTMTTRNRS.CCSTMTRS.BANKTRANLIST.STMTTRN;

        // Verify transaction types common to credit cards
        const debitTransactions = transactions.filter(t => t.TRNTYPE === 'DEBIT');
        expect(debitTransactions.length).toBeGreaterThan(0);

        const creditTransactions = transactions.filter(t => t.TRNTYPE === 'CREDIT');
        expect(creditTransactions.length).toBeGreaterThan(0);

        // All debit amounts should be negative (charges)
        debitTransactions.forEach(t => {
          expect(parseFloat(t.TRNAMT)).toBeLessThan(0);
        });

        // All credit amounts should be positive (payments)
        creditTransactions.forEach(t => {
          expect(parseFloat(t.TRNAMT)).toBeGreaterThan(0);
        });

        done();
      });
    });

    it('should handle zero balance scenarios', done => {
      const zeroBalanceResponse = discoverCardStatementResponse.replace('<BALAMT>-35.66', '<BALAMT>0.00');

      nock('https://ofx.discovercard.com').post('/').reply(200, zeroBalanceResponse);

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res.body.OFX.CREDITCARDMSGSRSV1.CCSTMTTRNRS.CCSTMTRS.LEDGERBAL.BALAMT).toBe('0.00');
        done();
      });
    });

    it('should validate request format for credit card accounts', done => {
      const scope = nock('https://ofx.discovercard.com')
        .post('/', body => {
          // Verify credit card-specific request structure
          expect(body).toContain('OFXHEADER:100');
          expect(body).toContain('<CCSTMTRQ>'); // Credit card statement request
          expect(body).toContain('<CCACCTFROM>');
          expect(body).toContain('<ACCTID>6011123456789012');
          expect(body).not.toContain('<BANKACCTFROM>'); // Should not contain bank account structure
          expect(body).not.toContain('<BANKID>'); // Credit cards don't use routing numbers
          return true;
        })
        .reply(200, discoverCardStatementResponse);

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(scope.isDone()).toBe(true);
        expect(err).toBe(false);
        done();
      });
    });
  });

  describe('Date Range Handling', () => {
    it('should handle different date formats', done => {
      nock('https://ofx.discovercard.com').post('/').reply(200, discoverCardStatementResponse);

      // Test with string dates
      banking.getStatement({ start: '20241101', end: '20241201' }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        done();
      });
    });

    it('should handle year-long date ranges', done => {
      nock('https://ofx.discovercard.com').post('/').reply(200, discoverCardStatementResponse);

      banking.getStatement({ start: 20240101, end: 20241231 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        done();
      });
    });
  });
});
