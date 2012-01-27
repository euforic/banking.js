# Banking.js 
 
## The Missing API for your bank.  
  * Bank statement results in JSON or Valid XML
  * Supports all financial institutions (File an issue if yours does not work)

## Installation  

```bash
$ npm install banking
```

## Usage

```json
var banking = require('banking');

var bankInfo = {
    fid: 10898
  , fidorg: 'B1'
  , url: 'https://yourBanksOfxApiURL.com'
  , bankid: 0123456 /* If bank account use your bank routing number otherwise set to null */
  , user: 'username'
  , pass: 'password'
  , accid: 0123456789 /* Account Number */
  , acctype: 'CHECKING' /* CHECKING || SAVINGS || MONEYMRKT || CREDITCARD */
  , date_start: 20010125 /* Statement start date YYYYMMDDHHMMSS */
  , date_end: 20110125 /* Statement end date YYYYMMDDHHMMSS */  
};

//If second param is omitted JSON will be returned by default

banking.getStatement(bankInfo, 'xml', function(res, err){
    if(err) console.log(err)
    console.log(res);        
});
```
## Sample Response

```javascript
{
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
}
```

## TODO  
  * Retrieve users available accounts with out account numbers
  * Add directory of common banks

## More Information
  * [Banking Connection Parameters](http://www.ofxhome.com/index.php/home/directory)
  * [Offical OFX Home Page](http://www.ofx.net/)

## License 

(The MIT License)

Copyright (c) 2010-2012 Christian Sullivan &lt;cs@euforic.co&gt;

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