import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import Banking from '../../index.js';
import {
  bankOfAmericaStatementResponse,
  invalidCredentialsResponse,
  accountNotFoundResponse,
  malformedOFXResponse,
  bankConfigs
} from '../fixtures/responses.js';

describe('Bank of America Integration Tests', () => {
  let banking;

  beforeEach(() => {
    banking = new Banking(bankConfigs.bankOfAmerica);
  });

  describe('getStatement', () => {
    it('should successfully retrieve Bank of America statement', done => {
      // Mock the OFX server response
      nock('https://eftx.bankofamerica.com').post('/eftxweb/access.ofx').reply(200, bankOfAmericaStatementResponse, {
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
        expect(ofx.SIGNONMSGSRSV1.SONRS.FI.ORG).toBe('Bank of America');
        expect(ofx.SIGNONMSGSRSV1.SONRS.FI.FID).toBe('5959');

        // Verify bank statement data
        expect(ofx.BANKMSGSRSV1).toBeDefined();
        const stmtrs = ofx.BANKMSGSRSV1.STMTTRNRS.STMTRS;
        expect(stmtrs.CURDEF).toBe('USD');
        expect(stmtrs.BANKACCTFROM.BANKID).toBe('026009593');
        expect(stmtrs.BANKACCTFROM.ACCTID).toBe('3333444455');
        expect(stmtrs.BANKACCTFROM.ACCTTYPE).toBe('CHECKING');

        // Verify transactions
        const transactions = stmtrs.BANKTRANLIST.STMTTRN;
        expect(Array.isArray(transactions)).toBe(true);
        expect(transactions.length).toBeGreaterThan(0);

        // Verify specific Bank of America transactions
        const costcoTransaction = transactions.find(t => t.NAME === 'COSTCO WHOLESALE');
        expect(costcoTransaction).toBeDefined();
        expect(costcoTransaction.TRNTYPE).toBe('DEBIT');
        expect(costcoTransaction.TRNAMT).toBe('-125.50');
        expect(costcoTransaction.MEMO).toBe('DEBIT CARD PURCHASE');

        const salaryTransaction = transactions.find(t => t.NAME === 'DIRECT DEPOSIT');
        expect(salaryTransaction).toBeDefined();
        expect(salaryTransaction.TRNTYPE).toBe('CREDIT');
        expect(salaryTransaction.TRNAMT).toBe('2800.00');
        expect(salaryTransaction.MEMO).toBe('SALARY DEPOSIT');

        const feeTransaction = transactions.find(t => t.NAME === 'OVERDRAFT FEE');
        expect(feeTransaction).toBeDefined();
        expect(feeTransaction.TRNTYPE).toBe('FEE');
        expect(feeTransaction.TRNAMT).toBe('-25.00');
        expect(feeTransaction.MEMO).toBe('INSUFFICIENT FUNDS FEE');

        // Verify balance information
        expect(stmtrs.LEDGERBAL).toBeDefined();
        expect(stmtrs.LEDGERBAL.BALAMT).toBe('2649.50');
        expect(stmtrs.AVAILBAL).toBeDefined();
        expect(stmtrs.AVAILBAL.BALAMT).toBe('2649.50');

        done();
      });
    });

    it('should handle Bank of America authentication errors', done => {
      nock('https://eftx.bankofamerica.com').post('/eftxweb/access.ofx').reply(200, invalidCredentialsResponse, {
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

    it('should send properly formatted Bank of America OFX request', done => {
      const scope = nock('https://eftx.bankofamerica.com')
        .post('/eftxweb/access.ofx', body => {
          // Verify Bank of America-specific OFX request format
          expect(body).toContain('OFXHEADER:100');
          expect(body).toContain('DATA:OFXSGML');
          expect(body).toContain('VERSION:102');
          expect(body).toContain('<USERID>testuser');
          expect(body).toContain('<USERPASS>testpass');
          expect(body).toContain('<FID>5959');
          expect(body).toContain('<BANKID>026009593');
          expect(body).toContain('<ACCTID>3333444455');
          expect(body).toContain('<ACCTTYPE>CHECKING');
          expect(body).toContain('<DTSTART>20241101');
          expect(body).toContain('<DTEND>20241201');
          return true;
        })
        .reply(200, bankOfAmericaStatementResponse);

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(scope.isDone()).toBe(true);
        expect(err).toBe(false);
        done();
      });
    });

    it('should handle Bank of America server timeouts', done => {
      nock('https://eftx.bankofamerica.com').post('/eftxweb/access.ofx').delay(5000).reply(200, bankOfAmericaStatementResponse);

      const startTime = Date.now();
      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        const elapsedTime = Date.now() - startTime;
        expect(err).toBeTruthy();
        expect(elapsedTime).toBeGreaterThan(1000);
        done();
      });
    });

    it('should handle Bank of America SSL certificate issues', done => {
      nock('https://eftx.bankofamerica.com').post('/eftxweb/access.ofx').replyWithError('UNABLE_TO_VERIFY_LEAF_SIGNATURE');

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        done();
      });
    });

    it('should handle Bank of America account restrictions', done => {
      const restrictionResponse = `OFXHEADER:100
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
      <TRNUID>boa-restriction-error
      <STATUS>
        <CODE>10401
        <SEVERITY>ERROR
        <MESSAGE>ACCOUNT RESTRICTED
      </STATUS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

      nock('https://eftx.bankofamerica.com').post('/eftxweb/access.ofx').reply(200, restrictionResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STATUS.CODE).toBe('10401');
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STATUS.MESSAGE).toBe('ACCOUNT RESTRICTED');
        done();
      });
    });
  });

  describe('getAccounts', () => {
    it('should successfully retrieve Bank of America account list', done => {
      const boaAccountListResponse = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:test-uid-boa-accounts

<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
        <MESSAGE>SUCCESS
      </STATUS>
      <DTSERVER>20241201120000.000[-8:PST]
      <LANGUAGE>ENG
      <FI>
        <ORG>Bank of America
        <FID>5959
      </FI>
    </SONRS>
  </SIGNONMSGSRSV1>
  <SIGNUPMSGSRSV1>
    <ACCTINFOTRNRS>
      <TRNUID>boa-accounts-uid-101
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
              <BANKID>026009593
              <ACCTID>3333444455
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
              <BANKID>026009593
              <ACCTID>3333444466
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
              <ACCTID>4111111111111112
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

      nock('https://eftx.bankofamerica.com').post('/eftxweb/access.ofx').reply(200, boaAccountListResponse, {
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
        expect(checkingAccount.BANKACCTINFO.BANKACCTFROM.ACCTID).toBe('3333444455');
        expect(checkingAccount.BANKACCTINFO.BANKACCTFROM.BANKID).toBe('026009593');
        expect(checkingAccount.BANKACCTINFO.SVCSTATUS).toBe('ACTIVE');

        // Verify savings account
        const savingsAccount = acctInfo.find(acc => acc.BANKACCTINFO && acc.BANKACCTINFO.BANKACCTFROM.ACCTTYPE === 'SAVINGS');
        expect(savingsAccount).toBeDefined();
        expect(savingsAccount.BANKACCTINFO.BANKACCTFROM.ACCTID).toBe('3333444466');

        // Verify credit card account
        const creditCardAccount = acctInfo.find(acc => acc.CCACCTINFO);
        expect(creditCardAccount).toBeDefined();
        expect(creditCardAccount.CCACCTINFO.CCACCTFROM.ACCTID).toBe('4111111111111112');
        expect(creditCardAccount.CCACCTINFO.SVCSTATUS).toBe('ACTIVE');

        done();
      });
    });
  });

  describe('Bank of America Specific Features', () => {
    it('should handle Bank of America fee transactions correctly', done => {
      nock('https://eftx.bankofamerica.com').post('/eftxweb/access.ofx').reply(200, bankOfAmericaStatementResponse);

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);

        const transactions = res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST.STMTTRN;

        // Verify fee transaction handling
        const feeTransactions = transactions.filter(t => t.TRNTYPE === 'FEE');
        expect(feeTransactions.length).toBeGreaterThan(0);

        const overdraftFee = feeTransactions.find(t => t.NAME === 'OVERDRAFT FEE');
        expect(overdraftFee).toBeDefined();
        expect(parseFloat(overdraftFee.TRNAMT)).toBeLessThan(0);
        expect(overdraftFee.MEMO).toBe('INSUFFICIENT FUNDS FEE');

        done();
      });
    });

    it('should handle Bank of America routing number validation', done => {
      // Test with invalid routing number
      const invalidBankId = new Banking({
        ...bankConfigs.bankOfAmerica,
        bankId: '000000000' // Invalid routing number
      });

      const invalidAccountResponse = `OFXHEADER:100
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
        <MESSAGE>INVALID BANK ID
      </STATUS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

      nock('https://eftx.bankofamerica.com').post('/eftxweb/access.ofx').reply(200, invalidAccountResponse, {
        'Content-Type': 'application/x-ofx'
      });

      invalidBankId.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STATUS.CODE).toBe('10400');
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STATUS.MESSAGE).toBe('INVALID BANK ID');
        done();
      });
    });

    it('should handle Bank of America transaction limits', done => {
      const limitResponse = `OFXHEADER:100
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
      <TRNUID>limit-error-transaction
      <STATUS>
        <CODE>13000
        <SEVERITY>ERROR
        <MESSAGE>REQUEST TOO LARGE
      </STATUS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

      nock('https://eftx.bankofamerica.com').post('/eftxweb/access.ofx').reply(200, limitResponse, {
        'Content-Type': 'application/x-ofx'
      });

      // Test with very large date range (5 years)
      banking.getStatement({ start: 20200101, end: 20241231 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STATUS.CODE).toBe('13000');
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STATUS.MESSAGE).toBe('REQUEST TOO LARGE');
        done();
      });
    });

    it('should handle different account types properly', done => {
      // Test with a MONEYMRKT (Money Market) account
      const mmBanking = new Banking({
        ...bankConfigs.bankOfAmerica,
        accType: 'MONEYMRKT',
        accId: '7777888899'
      });

      const mmResponse = bankOfAmericaStatementResponse
        .replace('<ACCTTYPE>CHECKING', '<ACCTTYPE>MONEYMRKT')
        .replace('<ACCTID>3333444455', '<ACCTID>7777888899');

      const scope = nock('https://eftx.bankofamerica.com')
        .post('/eftxweb/access.ofx', body => {
          expect(body).toContain('<ACCTTYPE>MONEYMRKT');
          expect(body).toContain('<ACCTID>7777888899');
          return true;
        })
        .reply(200, mmResponse);

      mmBanking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(scope.isDone()).toBe(true);
        expect(err).toBe(false);
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKACCTFROM.ACCTTYPE).toBe('MONEYMRKT');
        done();
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle partial response corruption', done => {
      const partiallyCorruptedResponse = bankOfAmericaStatementResponse.replace('</STMTTRN>', '</STMTTRN><INVALID>CORRUPT DATA</INVALID>');

      nock('https://eftx.bankofamerica.com').post('/eftxweb/access.ofx').reply(200, partiallyCorruptedResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        // Should still parse the valid parts
        if (!err) {
          expect(res).toBeDefined();
          expect(res.body.OFX.SIGNONMSGSRSV1.SONRS.STATUS.CODE).toBe('0');
        }
        done();
      });
    });

    it('should handle network interruptions gracefully', done => {
      nock('https://eftx.bankofamerica.com').post('/eftxweb/access.ofx').replyWithError('ECONNRESET');

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBeTruthy();
        expect(err.code).toBe('ECONNRESET');
        done();
      });
    });
  });
});
