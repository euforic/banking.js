# [Banking.js](http://euforic.co/banking.js)
Version 1.1.0

[![Build Status](https://secure.travis-ci.org/euforic/banking.js.png)](http://travis-ci.org/euforic/banking.js)
[![NPM version](https://badge.fury.io/js/banking.png)](https://npmjs.org/package/banking)
[![Gittip](http://img.shields.io/gittip/euforic.png)](https://www.gittip.com/euforic/)
## Breaking changes!
see docs below

## The Missing API for your bank.
  * Retrieve all of your bank transactions similiar to how quickbooks does it.
  * No need to depend on or pay for third party services
  * Bank statement results in JSON or Valid XML
  * Supports all financial institutions (File an issue if yours does not work)

## What is OFX?

### The Short Version

The banks crappy malformed version of XML that many financial apps such as quickbooks and quicken use to import your bank transactions from your bank account, credit card, money market, etc..

### The Long Version

Open Financial Exchange

  * The file extension .ofx is associated with an Open Financial Exchange file as a standard format for the exchange of financial data between institutions.
  * This file is universally accepted by financial software, including Intuit Quicken, Microsoft Money and GnuCash.

Background

  * The Open Financial Exchange file format was created in 1997 via a joint venture by CheckFree, Intuit and Microsoft.
  * The purpose was to allow for a universally accepted financial format used to broker transactions on the Internet.
  * The .ofx file format is seen when dealing with financial transactions involving consumers, businesses, stocks and mutual funds.
  * [OFX on Wikipedia](http://en.wikipedia.org/wiki/Open_Financial_Exchange)

## Installation

```bash
$ npm install banking
```

## Usage

[Find your banks connection details Here](http://www.ofxhome.com/index.php/home/directory)

### Banking
Create a new instance of banking

```javascript
var Banking = require('banking');

var bank = Banking({
    fid: 10898
  , fidOrg: 'B1'
  , url: 'https://yourBanksOfxApiURL.com'
  , bankId: '0123456' /* If bank account use your bank routing number otherwise set to null */
  , user: 'username'
  , password: 'password'
  , accId: '0123456789' /* Account Number */
  , accType: 'CHECKING' /* CHECKING || SAVINGS || MONEYMRKT || CREDITCARD */
  , ofxVer: 103 /* default 102 */
  , app: 'QBKS' /* default  'QWIN' */
  , appVer: '1900' /* default 1700 */
  
  // headers are only required if your ofx server is very picky, defaults below
  // add only the headers you want sent
  // the order in this array is also the order they are sent
  , headers: ['Host', 'Accept', 'User-Agent', 'Content-Type', 'Content-Length', 'Connection']
});
```

### bank.getStatement(Obj, fn)
Fetch and parse transactions for the selected date rang

```js
// date format YYYYMMDDHHMMSS
bank.getStatement({start:20130101, end:20131101}, function(err, res){
  if(err) console.log(err)
  console.log(res);
});
```

### Banking.parseFile(Str, fn)
Parse an OFX file into JSON

```javascript
Banking.parseFile('/myfile.ofx', function (res) {
  console.log(res);
});
```

### Banking.parse(Str, fn)
Parse an OFX string into JSON

```javascript
Banking.parse('SomeSuperLongOfxString', function (res) {
  console.log(res);
});
```

## Response

Object structure 
```js
{
  header: {...},
  body: {...},
  xml: '...'
}
```

Example
```javascript
{
  header: { 
    OFXHEADER: '100',
    DATA: 'OFXSGML',
    VERSION: '102',
    SECURITY: 'NONE',
    ENCODING: 'USASCII',
    CHARSET: '1252',
    COMPRESSION: 'NONE',
    OLDFILEUID: 'NONE',
    NEWFILEUID: 'boiS5QeFGTVMFtvJvqLtAqCEap3cvo69' 
  },
  body: {
    "OFX": {
      "SIGNONMSGSRSV1": {
        "SONRS": {
          "STATUS": {
            "CODE": "0",
            "SEVERITY": "INFO",
            "MESSAGE": "SUCCESS"
          },
          "DTSERVER": "20120126212302.454[-8:PST]",
          "LANGUAGE": "ENG",
          "FI": {
            "ORG": "DI",
            "FID": "321081669"
          }
        }
      },
      "BANKMSGSRSV1": {
        "STMTTRNRS": {
          "TRNUID": "BiJNgqjvbw5vg18Z5T8kZASgUKmsFnNY",
          "STATUS": {
            "CODE": "0",
            "SEVERITY": "INFO",
            "MESSAGE": "SUCCESS"
          },
          "CLTCOOKIE": "iXus7",
          "STMTRS": {
            "CURDEF": "USD",
            "BANKACCTFROM": {
              "BANKID": "321081669",
              "ACCTID": "3576960405",
              "ACCTTYPE": "CHECKING"
            },
            "BANKTRANLIST": {
              "DTSTART": "20010125120000.000",
              "DTEND": "20120126212302.638[-8:PST]",
              "STMTTRN": [{
                "TRNTYPE": "DEP",
                "DTPOSTED": "20110407070000.000",
                "DTAVAIL": "20110407070000.000",
                "TRNAMT": "1934.65",
                "FITID": "156599402",
                "NAME": "CLIENT DEPOSIT",
                "MEMO": "CLIENT DEPOSIT"
              }, {
                "TRNTYPE": "DEBIT",
                "DTPOSTED": "20110412070000.000",
                "DTAVAIL": "20110412070000.000",
                "TRNAMT": "-700.00",
                "FITID": "156950780",
                "NAME": "DOMESTIC WIRE FUNDS-DEBIT CHRIST",
                "MEMO": "DOMESTIC WIRE FUNDS-DEBIT CHRISTIAN SULLIVAN"
              }, {
                "TRNTYPE": "CHECK",
                "DTPOSTED": "20110414070000.000",
                "DTAVAIL": "20110414070000.000",
                "TRNAMT": "-38.20",
                "FITID": "157222076",
                "CHECKNUM": "10004",
                "NAME": "CHECK WITHDRAWAL",
                "MEMO": "CHECK WITHDRAWAL"
              }, {
                "TRNTYPE": "CHECK",
                "DTPOSTED": "20110414070000.000",
                "DTAVAIL": "20110414070000.000",
                "TRNAMT": "-349.79",
                "FITID": "157222077",
                "CHECKNUM": "10006",
                "NAME": "CHECK WITHDRAWAL",
                "MEMO": "CHECK WITHDRAWAL"
              }]
            },
            "LEDGERBAL": {
              "BALAMT": "1661.41",
              "DTASOF": "20120126212302.751[-8:PST]"
            },
            "AVAILBAL": {
              "BALAMT": "2761.41",
              "DTASOF": "20120126212302.751[-8:PST]"
            }
          }
        }
      }
    }
  },
  xml: '<OFX><SIGNONMSGSRSV1><SONRS>...'
}
```

## TODO
  * Retrieve users available accounts with out account numbers

## More Information
  * [Banking Connection Parameters](http://www.ofxhome.com/index.php/home/directory)
  * [Offical OFX Home Page](http://www.ofx.net/)

## License

(The MIT License)

Copyright (c) 2015 Christian Sullivan &lt;cs@bodhi5.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
