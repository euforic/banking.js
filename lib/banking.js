var parser = require('xml2json')
  , request = require('request');


/**
 * Unique Id Generator
 *
 * @param {number} length
 * @return {string} radix
 * @return {string} uuid 
 * @api private
 */
function uuid(len,radix) {
    var CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split(''); 
    var chars = CHARS, uuid = [];
    radix = radix || chars.length;

    if (len) {
      for (var i = 0; i < len; i++) uuid[i] = chars[0 | Math.random()*radix];
    } else {
      var r;
      uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
      uuid[14] = '4';

      for (var i = 0; i < 36; i++) {
        if (!uuid[i]) {
          r = 0 | Math.random()*16;
          uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
        }
      }
    }

    return uuid.join('');
};


/**
 * Clean OFX Data
 *
 * @param {string} ofxBody
 * @return {object} response head
 * @return {xmlstring} callback 
 * @api private
 */
function cleanOFX(resBody, format, cb) {
  if(typeof format !== 'string') cb = format, format = 'json';

  var ofx = resBody.split('<OFX>',2);
  var headerString = ofx[0].split(/\r|\n/);
  var bodyXML = ('<OFX>'+ofx[1]).replace(/>\s+</g, '><').replace(/\s+</g, '<').replace(/>\s+/g, '>').replace(/<([A-Z0-9_]*)+\.+([A-Z0-9_]*)>([^<]+)/g, '<\$1\$2>\$3' ).replace(/<(\w+?)>([^<]+)/g, '<\$1>\$2</\$1>');
  var header = {}
    
  for(attrs in headerString){
    var headAttributes = headerString[attrs].split(/:/,2);
    header[headAttributes[0]] = headAttributes[1];
  }

  var body = (format === 'json') ? JSON.parse(parser.toJson(bodyXML)) : bodyXML;
  console.log(header);
  cb(body, null);
};


/**
 * 
 */

exports.getStatement = function(o, type, cb) {

  //TODO join ofxReq and ofxReqCC not sure why I seperated in the first place
  //Request for Bank statement
  var ofxReq = 'OFXHEADER:100\n'+
               'DATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:USASCII\nCHARSET:1252\nCOMPRESSION:NONE\nOLDFILEUID:NONE\nNEWFILEUID:'+uuid(32)+'\n\n'+
               '<OFX>'+
               '<SIGNONMSGSRQV1>'+
               '<SONRQ>'+
               '<DTCLIENT>'+o.date_end+
               '<USERID>'+o.user+
               '<USERPASS>'+o.pass+
               '<LANGUAGE>ENG'+
               '<FI>'+
               '<ORG>'+o.fidorg+
               '<FID>'+o.fid+
               '</FI>'+
               '<APPID>QWIN'+
               '<APPVER>1700'+
               '</SONRQ></SIGNONMSGSRQV1>'+
               '<BANKMSGSRQV1>'+
               '<STMTTRNRQ>'+
               '<TRNUID>'+uuid(32)+
               '<CLTCOOKIE>'+uuid(5)+
               '<STMTRQ>'+
               '<BANKACCTFROM>'+
               '<BANKID>'+o.bankid+
               '<ACCTID>'+o.accid+
               '<ACCTTYPE>'+o.acctype+
               '</BANKACCTFROM>'+
               '<INCTRAN>'+
               '<DTSTART>'+o.date_start+
               '<INCLUDE>Y</INCTRAN>'+
               '</STMTRQ>'+
               '</STMTTRNRQ>'+
               '</BANKMSGSRQV1>'+
               '</OFX>';
               
  //Request for CreditCard Statement
  var ofxReqCC = 'OFXHEADER:100\n'+
              'DATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:USASCII\nCHARSET:1252\nCOMPRESSION:NONE\nOLDFILEUID:NONE\nNEWFILEUID:'+uuid(32)+'\n\n'+
              '<OFX>'+
              '<SIGNONMSGSRQV1>'+
              '<SONRQ>'+
              '<DTCLIENT>'+o.date_end+
              '<USERID>'+o.user+
              '<USERPASS>'+o.pass+
              '<LANGUAGE>ENG'+
              '<FI>'+
              '<ORG>'+o.fidorg+
              '<FID>'+o.fid+
              '</FI>'+
              '<APPID>QWIN'+
              '<APPVER>1700'+
              '</SONRQ></SIGNONMSGSRQV1>'+
              '<CREDITCARDMSGSRQV1>'+
              '<CCSTMTTRNRQ>'+
              '<TRNUID>'+uuid(32)+
              '<CLTCOOKIE>'+uuid(5)+
              '<CCSTMTRQ>'+
              '<CCACCTFROM>'+
              '<ACCTID>'+o.accid+
              '</CCACCTFROM>'+
              '<INCTRAN>'+
              '<DTSTART>'+o.date_start+
              '<INCLUDE>Y</INCTRAN>'+
              '</CCSTMTRQ>'+
              '</CCSTMTTRNRQ>'+
              '</CREDITCARDMSGSRQV1>'+
              '</OFX>';
 
    request({ 
          method: 'POST'
        , url: o.url
        , headers: { 'Content-Type' : 'application/x-ofx' }
        , body: (o.acctype == 'CREDITCARD') ? ofxReqCC : ofxReq
        , encoding: 'UTF8'
      }, function(err,res,body){
        if(res.headers['content-type'] !== 'application/x-ofx') return cb(body,'Invalid Response');
        cleanOFX(body, type, cb);
    });
};