
/*!
 * [OFX description]
 * @type {[type]}
 */

var xml2json = require('xml2json')
  , util = require('./utils')
  , debug = require('debug')('banking:ofx');

// expose OFX

var OFX = module.exports = {};

function getSignOnMsg(opts) {
  return '<SIGNONMSGSRQV1>' +
        '<SONRQ>' +
        '<DTCLIENT>' + opts.end +
        '<USERID>' + opts.user +
        '<USERPASS>' + opts.password +
        '<LANGUAGE>ENG' +
        '<FI>' +
        '<ORG>' + opts.fidOrg +
        '<FID>' + opts.fid +
        '</FI>' +
        '<APPID>' + opts.app +
        '<APPVER>' + opts.appVer +
        '</SONRQ>' +
        '</SIGNONMSGSRQV1>';
}

function getOfxHeaders(opts) {
  return 'OFXHEADER:100\n' +
         'DATA:OFXSGML\n' +
         'VERSION:'+opts.ofxVer+'\n' +
         'SECURITY:NONE\n' +
         'ENCODING:USASCII\n' +
         'CHARSET:1252\n' +
         'COMPRESSION:NONE\n' +
         'OLDFILEUID:NONE\n' +
         'NEWFILEUID:' + util.uuid(32) + '\n' +
         '\n';
}


/**
 * [createRequest description]
 * @param  {[type]} opts [description]
 * @return {[type]}      [description]
 */

OFX.createRequest = function(opts) {
  var type = (opts.accType || '').toUpperCase();
  //TODO join ofxReq and ofxReqCC not sure why I seperated in the first place
  //Request for Bank statement
  if (type != 'CREDITCARD') {
    var reqStr = getOfxHeaders(opts) +
      '<OFX>' +
      getSignOnMsg(opts) +
      '<BANKMSGSRQV1>' +
      '<STMTTRNRQ>' +
      '<TRNUID>' + util.uuid(32) +
      '<CLTCOOKIE>' + util.uuid(5) +
      '<STMTRQ>' +
      '<BANKACCTFROM>' +
      '<BANKID>' + opts.bankId +
      '<ACCTID>' + opts.accId +
      '<ACCTTYPE>' + type +
      '</BANKACCTFROM>' +
      '<INCTRAN>' +
      '<DTSTART>' + opts.start +
      '<INCLUDE>Y</INCTRAN>' +
      '</STMTRQ>' +
      '</STMTTRNRQ>' +
      '</BANKMSGSRQV1>' +
      '</OFX>';
  } else {
    //Request for CreditCard Statement
    var reqStr = getOfxHeaders(opts) +
      '<OFX>' +
      getSignOnMsg(opts) +
      '<CREDITCARDMSGSRQV1>' +
      '<CCSTMTTRNRQ>' +
      '<TRNUID>' + util.uuid(32) +
      '<CLTCOOKIE>' + util.uuid(5) +
      '<CCSTMTRQ>' +
      '<CCACCTFROM>' +
      '<ACCTID>' + opts.accId +
      '</CCACCTFROM>' +
      '<INCTRAN>' +
      '<DTSTART>' + opts.start +
      '<INCLUDE>Y</INCTRAN>' +
      '</CCSTMTRQ>' +
      '</CCSTMTTRNRQ>' +
      '</CREDITCARDMSGSRQV1>' +
      '</OFX>';
  }
  debug('OFX-RequestString:', reqStr);
  return reqStr;
};

/**
 * [parse description]
 * @param  {[type]}   ofxData [description]
 * @param  {Function} fn      [description]
 * @return {[type]}           [description]
 */

OFX.parse = function (ofxStr, fn) {
  var data = {};
  var callback = fn;
  var ofxRes = ofxStr.split('<OFX>',2);
  var ofx = '<OFX>' + ofxRes[1];
  var headerString = ofxRes[0].split(/\r|\n/);

  data.xml = ofx
              .replace(/>\s+</g, '><')
              .replace(/\s+</g, '<')
              .replace(/>\s+/g, '>')
              .replace(/<([A-Z0-9_]*)+\.+([A-Z0-9_]*)>([^<]+)/g, '<\$1\$2>\$3' )
              .replace(/<(\w+?)>([^<]+)/g, '<\$1>\$2</\$1>');

  try {
    data.body = JSON.parse(xml2json.toJson(ofx));
  } catch(e) {
    data.body = JSON.parse(xml2json.toJson(data.xml));
  }

  data.header = {};

  for(var key in headerString){
    var headAttributes = headerString[key].split(/:/,2);
    if (headAttributes[0]) data.header[headAttributes[0]] = headAttributes[1];
  }
  fn(data);
};
