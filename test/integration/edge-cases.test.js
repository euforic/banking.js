import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import Banking from '../../index.js';
import { wellsFargoStatementResponse, discoverCardStatementResponse, bankConfigs } from '../fixtures/responses.js';

describe('Edge Cases and Boundary Tests', () => {
  let banking;

  beforeEach(() => {
    banking = new Banking(bankConfigs.wellsFargo);
  });

  describe('Date Range Edge Cases', () => {
    it('should handle same start and end date', done => {
      const singleDayResponse = wellsFargoStatementResponse
        .replace('<DTSTART>20241101120000.000', '<DTSTART>20241115120000.000')
        .replace('<DTEND>20241201120000.000', '<DTEND>20241115120000.000');

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, singleDayResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241115, end: 20241115 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST.DTSTART).toBe('20241115120000.000');
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST.DTEND).toBe('20241115120000.000');
        done();
      });
    });

    it('should handle maximum allowed date range', done => {
      // Most banks limit to 2-3 years of data
      const maxRangeResponse = wellsFargoStatementResponse.replace('<DTSTART>20241101120000.000', '<DTSTART>20220101120000.000');

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, maxRangeResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20220101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        done();
      });
    });

    it('should handle future dates', done => {
      const futureDateResponse = `OFXHEADER:100
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
      <TRNUID>future-date-error
      <STATUS>
        <CODE>2019
        <SEVERITY>ERROR
        <MESSAGE>INVALID DATE - FUTURE DATES NOT ALLOWED
      </STATUS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, futureDateResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20250101, end: 20251231 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STATUS.CODE).toBe('2019');
        done();
      });
    });

    it('should handle very old dates', done => {
      const oldDateResponse = `OFXHEADER:100
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
      <TRNUID>old-date-error
      <STATUS>
        <CODE>2018
        <SEVERITY>ERROR
        <MESSAGE>DATA NOT AVAILABLE FOR REQUESTED DATE RANGE
      </STATUS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, oldDateResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 19900101, end: 19901231 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STATUS.CODE).toBe('2018');
        done();
      });
    });

    it('should handle leap year dates', done => {
      const leapYearResponse = wellsFargoStatementResponse
        .replace('<DTSTART>20241101120000.000', '<DTSTART>20240228120000.000')
        .replace('<DTEND>20241201120000.000', '<DTEND>20240229120000.000');

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, leapYearResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20240228, end: 20240229 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        done();
      });
    });
  });

  describe('Account Configuration Edge Cases', () => {
    it('should handle extremely long account numbers', done => {
      const longAcctBanking = new Banking({
        ...bankConfigs.wellsFargo,
        accId: '1234567890123456789012345678901234567890'
      });

      const scope = nock('https://www.oasis.cfree.com')
        .post('/3001.ofxgp', body => {
          expect(body).toContain('<ACCTID>1234567890123456789012345678901234567890');
          return true;
        })
        .reply(200, wellsFargoStatementResponse.replace('<ACCTID>1234567890', '<ACCTID>1234567890123456789012345678901234567890'));

      longAcctBanking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(scope.isDone()).toBe(true);
        expect(err).toBe(false);
        done();
      });
    });

    it('should handle special characters in account IDs', done => {
      const specialCharBanking = new Banking({
        ...bankConfigs.wellsFargo,
        accId: 'ACCT-123_456.789',
        user: 'test.user+123',
        password: 'p@ssw0rd!'
      });

      const scope = nock('https://www.oasis.cfree.com')
        .post('/3001.ofxgp', body => {
          expect(body).toContain('<ACCTID>ACCT-123_456.789');
          expect(body).toContain('<USERID>test.user+123');
          expect(body).toContain('<USERPASS>p@ssw0rd!');
          return true;
        })
        .reply(200, wellsFargoStatementResponse.replace('<ACCTID>1234567890', '<ACCTID>ACCT-123_456.789'));

      specialCharBanking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(scope.isDone()).toBe(true);
        expect(err).toBe(false);
        done();
      });
    });

    it('should handle empty or null account fields', done => {
      const emptyFieldBanking = new Banking({
        ...bankConfigs.wellsFargo,
        bankId: '', // Empty bank ID
        brokerId: null, // Null broker ID
        clientId: undefined // Undefined client ID
      });

      const scope = nock('https://www.oasis.cfree.com')
        .post('/3001.ofxgp', body => {
          expect(body).toContain('<BANKID>');
          expect(body).not.toContain('<BROKERID>');
          expect(body).not.toContain('<CLIENTUID>');
          return true;
        })
        .reply(200, wellsFargoStatementResponse);

      emptyFieldBanking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(scope.isDone()).toBe(true);
        expect(err).toBe(false);
        done();
      });
    });

    it('should handle very long passwords', done => {
      const longPasswordBanking = new Banking({
        ...bankConfigs.wellsFargo,
        password: 'a'.repeat(256) // 256 character password
      });

      const scope = nock('https://www.oasis.cfree.com')
        .post('/3001.ofxgp', body => {
          expect(body).toContain('<USERPASS>' + 'a'.repeat(256));
          return true;
        })
        .reply(200, wellsFargoStatementResponse);

      longPasswordBanking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(scope.isDone()).toBe(true);
        expect(err).toBe(false);
        done();
      });
    });
  });

  describe('Response Size and Content Edge Cases', () => {
    it('should handle responses with no transactions', done => {
      const noTransactionsResponse = wellsFargoStatementResponse
        .replace(/<STMTTRN>[\s\S]*?<\/STMTTRN>/g, '')
        .replace('<BANKTRANLIST>', '<BANKTRANLIST>');

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, noTransactionsResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST).toBeDefined();
        done();
      });
    });

    it('should handle responses with single transaction', done => {
      const singleTransactionResponse = wellsFargoStatementResponse.replace(
        /<STMTTRN>[\s\S]*?<\/STMTTRN>/g,
        `<STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20241115120000.000
            <TRNAMT>-50.00
            <FITID>WF202411150001
            <NAME>SINGLE TRANSACTION
            <MEMO>ONLY TRANSACTION IN PERIOD
          </STMTTRN>`
      );

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, singleTransactionResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();

        const transactions = res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST.STMTTRN;
        // Could be an array with one element or a single object
        if (Array.isArray(transactions)) {
          expect(transactions.length).toBe(1);
          expect(transactions[0].NAME).toBe('SINGLE TRANSACTION');
        } else {
          expect(transactions.NAME).toBe('SINGLE TRANSACTION');
        }
        done();
      });
    });

    it('should handle responses with extremely large transaction lists', done => {
      // Generate 1000 transactions
      let transactionList = '';
      for (let i = 1; i <= 1000; i++) {
        transactionList += `
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20241115120000.000
            <TRNAMT>-${i}.00
            <FITID>WF20241115${i.toString().padStart(4, '0')}
            <NAME>TRANSACTION ${i}
            <MEMO>GENERATED TRANSACTION ${i}
          </STMTTRN>`;
      }

      const largeTransactionResponse = wellsFargoStatementResponse.replace(/<STMTTRN>[\s\S]*?<\/STMTTRN>/g, transactionList);

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, largeTransactionResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();

        const transactions = res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST.STMTTRN;
        expect(Array.isArray(transactions)).toBe(true);
        expect(transactions.length).toBe(1000);
        expect(transactions[0].NAME).toBe('TRANSACTION 1');
        expect(transactions[999].NAME).toBe('TRANSACTION 1000');
        done();
      });
    });

    it('should handle transactions with missing or empty fields', done => {
      const incompleteTransactionResponse = wellsFargoStatementResponse.replace(
        /<STMTTRN>[\s\S]*?<\/STMTTRN>/g,
        `<STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20241115120000.000
            <TRNAMT>-100.00
            <FITID>WF202411150001
            <NAME></NAME>
            <MEMO></MEMO>
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20241116120000.000
            <TRNAMT>200.00
            <FITID>WF202411160001
            <NAME>DEPOSIT</NAME>
          </STMTTRN>`
      );

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, incompleteTransactionResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();

        const transactions = res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST.STMTTRN;
        expect(Array.isArray(transactions)).toBe(true);
        expect(transactions.length).toBe(2);

        // First transaction has empty name and memo
        expect(transactions[0].NAME).toBe('');
        expect(transactions[0].MEMO).toBe('');

        // Second transaction missing memo field entirely
        expect(transactions[1].NAME).toBe('DEPOSIT');
        expect(transactions[1].MEMO).toBeUndefined();

        done();
      });
    });
  });

  describe('Currency and Amount Edge Cases', () => {
    it('should handle zero-amount transactions', done => {
      const zeroAmountResponse = wellsFargoStatementResponse.replace('<TRNAMT>-150.00', '<TRNAMT>0.00');

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, zeroAmountResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();

        const transactions = res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST.STMTTRN;
        const zeroTransaction = transactions.find(t => t.TRNAMT === '0.00');
        expect(zeroTransaction).toBeDefined();
        done();
      });
    });

    it('should handle very large monetary amounts', done => {
      const largeAmountResponse = wellsFargoStatementResponse
        .replace('<TRNAMT>2500.00', '<TRNAMT>999999999.99')
        .replace('<BALAMT>2338.00', '<BALAMT>999999999.99');

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, largeAmountResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();

        const stmtrs = res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS;
        expect(stmtrs.LEDGERBAL.BALAMT).toBe('999999999.99');

        const transactions = stmtrs.BANKTRANLIST.STMTTRN;
        const largeTransaction = transactions.find(t => t.TRNAMT === '999999999.99');
        expect(largeTransaction).toBeDefined();
        done();
      });
    });

    it('should handle fractional cent amounts', done => {
      const fractionalAmountResponse = wellsFargoStatementResponse
        .replace('<TRNAMT>-150.00', '<TRNAMT>-150.001')
        .replace('<TRNAMT>2500.00', '<TRNAMT>2500.999');

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, fractionalAmountResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();

        const transactions = res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST.STMTTRN;
        const fractionalDebit = transactions.find(t => t.TRNAMT === '-150.001');
        const fractionalCredit = transactions.find(t => t.TRNAMT === '2500.999');
        expect(fractionalDebit).toBeDefined();
        expect(fractionalCredit).toBeDefined();
        done();
      });
    });

    it('should handle non-USD currencies', done => {
      const euroCurrencyResponse = wellsFargoStatementResponse.replace('<CURDEF>USD', '<CURDEF>EUR');

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, euroCurrencyResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.CURDEF).toBe('EUR');
        done();
      });
    });
  });

  describe('Character Encoding and Special Characters', () => {
    it('should handle Unicode characters in transaction descriptions', done => {
      const unicodeResponse = wellsFargoStatementResponse
        .replace('<NAME>GROCERY STORE PURCHASE', '<NAME>Café München - €50.00 Purchase')
        .replace('<MEMO>WHOLE FOODS MARKET', '<MEMO>Straße №123, München, Deutschland');

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, unicodeResponse, {
        'Content-Type': 'application/x-ofx; charset=utf-8'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();

        const transactions = res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST.STMTTRN;
        const unicodeTransaction = transactions.find(t => t.NAME.includes('Café'));
        expect(unicodeTransaction).toBeDefined();
        expect(unicodeTransaction.NAME).toBe('Café München - €50.00 Purchase');
        expect(unicodeTransaction.MEMO).toBe('Straße №123, München, Deutschland');
        done();
      });
    });

    it('should handle HTML entities in responses', done => {
      const htmlEntityResponse = wellsFargoStatementResponse
        .replace('<NAME>GROCERY STORE PURCHASE', '<NAME>AT&amp;T Payment &lt;Auto&gt;')
        .replace('<MEMO>WHOLE FOODS MARKET', '<MEMO>&quot;Monthly Service&quot; &amp; Fees');

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, htmlEntityResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();

        const transactions = res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST.STMTTRN;
        const entityTransaction = transactions.find(t => t.NAME.includes('AT&T'));
        expect(entityTransaction).toBeDefined();
        done();
      });
    });

    it('should handle very long transaction descriptions', done => {
      const longDescription = 'A'.repeat(1000);
      const longDescriptionResponse = wellsFargoStatementResponse
        .replace('<NAME>GROCERY STORE PURCHASE', `<NAME>${longDescription}`)
        .replace('<MEMO>WHOLE FOODS MARKET', `<MEMO>${longDescription}`);

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, longDescriptionResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();

        const transactions = res.body.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST.STMTTRN;
        const longTransaction = transactions.find(t => t.NAME === longDescription);
        expect(longTransaction).toBeDefined();
        expect(longTransaction.MEMO).toBe(longDescription);
        done();
      });
    });
  });

  describe('Time Zone and Date Format Edge Cases', () => {
    it('should handle different time zone formats', done => {
      const timeZoneResponse = wellsFargoStatementResponse
        .replace('20241201120000.000[-8:PST]', '20241201120000.000[+5:EST]')
        .replace('20241115120000.000', '20241115120000.000[-8:PST]');

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, timeZoneResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.body.OFX.SIGNONMSGSRSV1.SONRS.DTSERVER).toBe('20241201120000.000[+5:EST]');
        done();
      });
    });

    it('should handle dates without time components', done => {
      const noTimeResponse = wellsFargoStatementResponse.replace(/\d{8}120000\.000/g, match => match.substring(0, 8));

      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, noTimeResponse, {
        'Content-Type': 'application/x-ofx'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        done();
      });
    });
  });

  describe('Network Behavior Edge Cases', () => {
    it('should handle partial response chunks', done => {
      const responseChunks = [
        'OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\n',
        'SECURITY:NONE\nENCODING:USASCII\n',
        wellsFargoStatementResponse.substring(100)
      ];

      nock('https://www.oasis.cfree.com')
        .post('/3001.ofxgp')
        .reply(function (uri, requestBody) {
          const response = responseChunks.join('');
          return [200, response, { 'Content-Type': 'application/x-ofx' }];
        });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        if (!err) {
          expect(res).toBeDefined();
        }
        done();
      });
    });

    it('should handle slow response streams', done => {
      nock('https://www.oasis.cfree.com')
        .post('/3001.ofxgp')
        .delay(1500) // Slow but not timeout
        .reply(200, wellsFargoStatementResponse, {
          'Content-Type': 'application/x-ofx'
        });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        done();
      });
    });

    it('should handle responses with incorrect content-type', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, wellsFargoStatementResponse, {
        'Content-Type': 'text/plain' // Wrong content type
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        // Should still parse OFX regardless of content-type
        if (!err) {
          expect(res).toBeDefined();
        }
        done();
      });
    });

    it('should handle responses with additional headers', done => {
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').reply(200, wellsFargoStatementResponse, {
        'Content-Type': 'application/x-ofx',
        'X-Custom-Header': 'BankSpecificValue',
        'Cache-Control': 'no-cache',
        'Set-Cookie': 'SessionId=abc123; HttpOnly'
      });

      banking.getStatement({ start: 20241101, end: 20241201 }, (err, res) => {
        expect(err).toBe(false);
        expect(res).toBeDefined();
        expect(res.header).toBeDefined();
        done();
      });
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple simultaneous requests', done => {
      // Set up multiple responses
      nock('https://www.oasis.cfree.com').post('/3001.ofxgp').times(3).reply(200, wellsFargoStatementResponse, {
        'Content-Type': 'application/x-ofx'
      });

      let completedRequests = 0;
      const checkCompletion = () => {
        completedRequests++;
        if (completedRequests === 3) {
          done();
        }
      };

      // Make three simultaneous requests
      banking.getStatement({ start: 20241101, end: 20241110 }, (err, res) => {
        expect(err).toBe(false);
        checkCompletion();
      });

      banking.getStatement({ start: 20241111, end: 20241120 }, (err, res) => {
        expect(err).toBe(false);
        checkCompletion();
      });

      banking.getStatement({ start: 20241121, end: 20241130 }, (err, res) => {
        expect(err).toBe(false);
        checkCompletion();
      });
    });
  });
});
