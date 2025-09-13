// Mock OFX responses for different banks
// These responses are based on actual OFX format but with dummy data

export const wellsFargoStatementResponse = `OFXHEADER:100
DATA:OFXSGML
VERSION:103
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:test-uid-wells-fargo

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
        <ORG>Wells Fargo
        <FID>3001
      </FI>
    </SONRS>
  </SIGNONMSGSRSV1>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <TRNUID>test-transaction-uid-123
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
        <MESSAGE>SUCCESS
      </STATUS>
      <STMTRS>
        <CURDEF>USD
        <BANKACCTFROM>
          <BANKID>123006800
          <ACCTID>1234567890
          <ACCTTYPE>CHECKING
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>20241101120000.000
          <DTEND>20241201120000.000
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20241115120000.000
            <TRNAMT>-150.00
            <FITID>WF202411150001
            <NAME>GROCERY STORE PURCHASE
            <MEMO>WHOLE FOODS MARKET
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20241116120000.000
            <TRNAMT>2500.00
            <FITID>WF202411160001
            <NAME>DIRECT DEPOSIT
            <MEMO>PAYROLL DEPOSIT
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>FEE
            <DTPOSTED>20241120120000.000
            <TRNAMT>-12.00
            <FITID>WF202411200001
            <NAME>MONTHLY SERVICE FEE
            <MEMO>ACCOUNT MAINTENANCE FEE
          </STMTTRN>
        </BANKTRANLIST>
        <LEDGERBAL>
          <BALAMT>2338.00
          <DTASOF>20241201120000.000[-8:PST]
        </LEDGERBAL>
        <AVAILBAL>
          <BALAMT>2338.00
          <DTASOF>20241201120000.000[-8:PST]
        </AVAILBAL>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

export const wellsFargoAccountListResponse = `OFXHEADER:100
DATA:OFXSGML
VERSION:103
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:test-uid-wells-fargo-accounts

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
        <ORG>Wells Fargo
        <FID>3001
      </FI>
    </SONRS>
  </SIGNONMSGSRSV1>
  <SIGNUPMSGSRSV1>
    <ACCTINFOTRNRS>
      <TRNUID>account-list-uid-123
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
              <BANKID>123006800
              <ACCTID>1234567890
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
              <BANKID>123006800
              <ACCTID>9876543210
              <ACCTTYPE>SAVINGS
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

export const discoverCardStatementResponse = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:test-uid-discover-card

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
  <CREDITCARDMSGSRSV1>
    <CCSTMTTRNRS>
      <TRNUID>discover-transaction-uid-456
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
      </STATUS>
      <CCSTMTRS>
        <CURDEF>USD
        <CCACCTFROM>
          <ACCTID>6011123456789012
        </CCACCTFROM>
        <BANKTRANLIST>
          <DTSTART>20241101120000.000
          <DTEND>20241201120000.000
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20241115120000.000
            <TRNAMT>-89.99
            <FITID>DISC202411150001
            <NAME>AMAZON.COM
            <MEMO>ONLINE PURCHASE
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20241118120000.000
            <TRNAMT>-45.67
            <FITID>DISC202411180001
            <NAME>SHELL GAS STATION
            <MEMO>FUEL PURCHASE
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20241125120000.000
            <TRNAMT>100.00
            <FITID>DISC202411250001
            <NAME>PAYMENT THANK YOU
            <MEMO>ONLINE PAYMENT
          </STMTTRN>
        </BANKTRANLIST>
        <LEDGERBAL>
          <BALAMT>-35.66
          <DTASOF>20241201120000.000[-5:EST]
        </LEDGERBAL>
      </CCSTMTRS>
    </CCSTMTTRNRS>
  </CREDITCARDMSGSRSV1>
</OFX>`;

export const chaseStatementResponse = `OFXHEADER:100
DATA:OFXSGML
VERSION:103
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:test-uid-chase-bank

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
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <TRNUID>chase-transaction-uid-789
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
        <MESSAGE>SUCCESS
      </STATUS>
      <STMTRS>
        <CURDEF>USD
        <BANKACCTFROM>
          <BANKID>322271627
          <ACCTID>5555666677
          <ACCTTYPE>CHECKING
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>20241101120000.000
          <DTEND>20241201120000.000
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20241110120000.000
            <TRNAMT>-75.00
            <FITID>CHASE202411100001
            <NAME>ATM WITHDRAWAL
            <MEMO>CHASE ATM #1234
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20241115120000.000
            <TRNAMT>3000.00
            <FITID>CHASE202411150001
            <NAME>DIRECT DEPOSIT
            <MEMO>EMPLOYER PAYROLL
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20241120120000.000
            <TRNAMT>-1200.00
            <FITID>CHASE202411200001
            <NAME>RENT PAYMENT
            <MEMO>AUTO PAY RENT
          </STMTTRN>
        </BANKTRANLIST>
        <LEDGERBAL>
          <BALAMT>1725.00
          <DTASOF>20241201120000.000[-5:EST]
        </LEDGERBAL>
        <AVAILBAL>
          <BALAMT>1725.00
          <DTASOF>20241201120000.000[-5:EST]
        </AVAILBAL>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

export const bankOfAmericaStatementResponse = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:test-uid-boa

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
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <TRNUID>boa-transaction-uid-101
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
        <MESSAGE>SUCCESS
      </STATUS>
      <STMTRS>
        <CURDEF>USD
        <BANKACCTFROM>
          <BANKID>026009593
          <ACCTID>3333444455
          <ACCTTYPE>CHECKING
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>20241101120000.000
          <DTEND>20241201120000.000
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20241112120000.000
            <TRNAMT>-125.50
            <FITID>BOA202411120001
            <NAME>COSTCO WHOLESALE
            <MEMO>DEBIT CARD PURCHASE
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20241115120000.000
            <TRNAMT>2800.00
            <FITID>BOA202411150001
            <NAME>DIRECT DEPOSIT
            <MEMO>SALARY DEPOSIT
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>FEE
            <DTPOSTED>20241130120000.000
            <TRNAMT>-25.00
            <FITID>BOA202411300001
            <NAME>OVERDRAFT FEE
            <MEMO>INSUFFICIENT FUNDS FEE
          </STMTTRN>
        </BANKTRANLIST>
        <LEDGERBAL>
          <BALAMT>2649.50
          <DTASOF>20241201120000.000[-8:PST]
        </LEDGERBAL>
        <AVAILBAL>
          <BALAMT>2649.50
          <DTASOF>20241201120000.000[-8:PST]
        </AVAILBAL>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

export const usBankStatementResponse = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:test-uid-usbank

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
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <TRNUID>usbank-transaction-uid-202
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
        <MESSAGE>SUCCESS
      </STATUS>
      <STMTRS>
        <CURDEF>USD
        <BANKACCTFROM>
          <BANKID>091000022
          <ACCTID>7777888899
          <ACCTTYPE>SAVINGS
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>20241101120000.000
          <DTEND>20241201120000.000
          <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20241105120000.000
            <TRNAMT>5000.00
            <FITID>USB202411050001
            <NAME>TRANSFER FROM CHECKING
            <MEMO>INTERNAL TRANSFER
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20241115120000.000
            <TRNAMT>15.25
            <FITID>USB202411150001
            <NAME>INTEREST PAYMENT
            <MEMO>MONTHLY INTEREST
          </STMTTRN>
        </BANKTRANLIST>
        <LEDGERBAL>
          <BALAMT>15015.25
          <DTASOF>20241201120000.000[-6:CST]
        </LEDGERBAL>
        <AVAILBAL>
          <BALAMT>15015.25
          <DTASOF>20241201120000.000[-6:CST]
        </AVAILBAL>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

// Error responses for testing error handling
export const invalidCredentialsResponse = `OFXHEADER:100
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

export const accountNotFoundResponse = `OFXHEADER:100
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
      <TRNUID>error-transaction-uid
      <STATUS>
        <CODE>10500
        <SEVERITY>ERROR
        <MESSAGE>INVALID ACCOUNT NUMBER
      </STATUS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

export const malformedOFXResponse = `INVALID OFX DATA
THIS IS NOT PROPER OFX FORMAT
<BROKEN>
  <XML>WITHOUT HEADER
    <AND>MISSING CLOSING TAGS
</XML>`;

// Bank configuration data for tests
export const bankConfigs = {
  wellsFargo: {
    fid: 3001,
    fidOrg: 'Wells Fargo',
    url: 'https://www.oasis.cfree.com/3001.ofxgp',
    bankId: '123006800',
    accType: 'CHECKING',
    accId: '1234567890',
    user: 'testuser',
    password: 'testpass'
  },
  discover: {
    fid: 7101,
    fidOrg: 'Discover Financial Services',
    url: 'https://ofx.discovercard.com',
    bankId: '',
    accType: 'CREDITCARD',
    accId: '6011123456789012',
    user: 'testuser',
    password: 'testpass'
  },
  chase: {
    fid: 636,
    fidOrg: 'JPMorgan Chase Bank, N.A.',
    url: 'https://ofx.chase.com',
    bankId: '322271627',
    accType: 'CHECKING',
    accId: '5555666677',
    user: 'testuser',
    password: 'testpass',
    clientId: 'test-client-id-123'
  },
  bankOfAmerica: {
    fid: 5959,
    fidOrg: 'Bank of America',
    url: 'https://eftx.bankofamerica.com/eftxweb/access.ofx',
    bankId: '026009593',
    accType: 'CHECKING',
    accId: '3333444455',
    user: 'testuser',
    password: 'testpass'
  },
  usBank: {
    fid: 1001,
    fidOrg: 'U.S. Bank',
    url: 'https://www.usbank.com/ofxroot',
    bankId: '091000022',
    accType: 'SAVINGS',
    accId: '7777888899',
    user: 'testuser',
    password: 'testpass'
  }
};
