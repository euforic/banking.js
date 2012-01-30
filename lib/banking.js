var parser = require('xml2json')
  , request = require('request')
  , fs = require('fs')
  , utils = require('./utils');


/**
 * Framework version.
 */

exports.version = '0.2.1'

/**
 * Turn Ofx string into valid XML then parse to json if requested
 * 
 * @param {String} ofxData
 * @param {String} format (Options are 'xml' || 'json' if omitted defaults to 'json')
 * @param {Function} cb
 * @return {XML|JSON}
 * @api public
 */

exports.parseOfxString = parseOfxString = function (ofxData, format, cb) {
  if(typeof format !== 'string') cb = format, format = 'json';

  var ofx = ofxData.split('<OFX>',2);
  var headerString = ofx[0].split(/\r|\n/);
  var bodyXML = ('<OFX>'+ofx[1]).replace(/>\s+</g, '><').replace(/\s+</g, '<').replace(/>\s+/g, '>').replace(/<([A-Z0-9_]*)+\.+([A-Z0-9_]*)>([^<]+)/g, '<\$1\$2>\$3' ).replace(/<(\w+?)>([^<]+)/g, '<\$1>\$2</\$1>');
  var header = {}
    
  for(var attrs in headerString){
    var headAttributes = headerString[attrs].split(/:/,2);
    header[headAttributes[0]] = headAttributes[1];
  }

  var body = (format === 'json') ? JSON.parse(parser.toJson(bodyXML)) : bodyXML;
  cb(body, null);
};


exports.parseOfxFile = function parseOfxFile(file, format, cb) {
  fs.readFile(file, 'UTF8', function (err, data) {
    if (err) throw err;
    parseOfxString(data,format,cb);
  });
}

/**
 * Fetches Ofx String from Bank Server and parse to json or returns valid XML
 * 
 * @param {JSON} o Request Config Settings
 * @param {String} format (Options are 'xml' || 'json' if omitted defaults to 'json')
 * @param {Function} cb
 * @return {XML|JSON}
 * @api public
 */

exports.getStatement = function(o, format, cb) {
  if(typeof format !== 'string') cb = format, format = 'json';

  //TODO join ofxReq and ofxReqCC not sure why I seperated in the first place
  //Request for Bank statement
  var ofxReq = 'OFXHEADER:100\n'+
               'DATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:USASCII\nCHARSET:1252\nCOMPRESSION:NONE\nOLDFILEUID:NONE\nNEWFILEUID:'+utils.uuid(32)+'\n\n'+
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
               '<TRNUID>'+utils.uuid(32)+
               '<CLTCOOKIE>'+utils.uuid(5)+
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
              'DATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:USASCII\nCHARSET:1252\nCOMPRESSION:NONE\nOLDFILEUID:NONE\nNEWFILEUID:'+utils.uuid(32)+'\n\n'+
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
              '<TRNUID>'+utils.uuid(32)+
              '<CLTCOOKIE>'+utils.uuid(5)+
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
        if( res.headers['content-type'] === 'text/html' ) return cb(body,'Expected: application/ofx or plain/text, Received: '+res.headers['content-type'] );
        parseOfxString(body, format, cb);
    });
};