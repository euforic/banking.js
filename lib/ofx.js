
/*!
 * [OFX description]
 * @type {[type]}
 */

var xml2js = require('xml2js')
  , parser = new xml2js.Parser({explicitArray: false})
  , util = require('./utils')
  , debug = require('debug')('banking:ofx');

// expose OFX

var OFX = module.exports = {};

function getSignOnMsg(opts) {
  var dtClient = (new Date()).toISOString().substring(0, 20).replace(/[^0-9]/g, '');

  return '<SIGNONMSGSRQV1>' +
    '<SONRQ>' +
    '<DTCLIENT>' + dtClient +
    '<USERID>' + opts.user +
    '<USERPASS>' + opts.password +
    '<LANGUAGE>ENG' +
    '<FI>' +
    '<ORG>' + opts.fidOrg +
    '<FID>' + opts.fid +
    '</FI>' +
    '<APPID>' + opts.app +
    '<APPVER>' + opts.appVer +
    (typeof opts.clientId !== 'undefined' ? '<CLIENTUID>' + opts.clientId : '') +
    '</SONRQ>' +
    '</SIGNONMSGSRQV1>';
}

function getOfxHeaders(opts) {
  return 'OFXHEADER:100\r\n' +
    'DATA:OFXSGML\r\n' +
    'VERSION:' + opts.ofxVer + '\r\n' +
    'SECURITY:NONE\r\n' +
    'ENCODING:USASCII\r\n' +
    'CHARSET:1252\r\n' +
    'COMPRESSION:NONE\r\n' +
    'OLDFILEUID:NONE\r\n' +
    'NEWFILEUID:' + util.uuid(32) + '\r\n' +
    '\r\n';
}

/**
 * Builds an OFX account list request
 * @param opts
 * @returns {string}
 */
OFX.buildAccountListRequest = function (opts) {
  var reqStr = getOfxHeaders(opts) + '<OFX>' + getSignOnMsg(opts);
  reqStr += '<SIGNUPMSGSRQV1>' +
    '<ACCTINFOTRNRQ>' +
    '<TRNUID>' + util.uuid(32) +
    '<ACCTINFORQ>' +
    '<DTACCTUP>19900101' +
    '</ACCTINFORQ>' +
    '</ACCTINFOTRNRQ>' +
    '</SIGNUPMSGSRQV1>' +
    '</OFX>';

  return reqStr;
};

/**
 * Builds an OFX statement request
 * @param opts
 * @returns {string}
 */
OFX.buildStatementRequest = function (opts) {
  var type = (opts.accType || '').toUpperCase();
  var reqStr = getOfxHeaders(opts) + '<OFX>' + getSignOnMsg(opts);

  switch (type) {
    case 'INVESTMENT':
      reqStr += '<INVSTMTMSGSRQV1>' +
        '<INVSTMTTRNRQ>' +
        '<TRNUID>' + util.uuid(32) +
        '<CLTCOOKIE>' + util.uuid(5) +
        '<INVSTMTRQ>' +
        '<INVACCTFROM>' +
        '<BROKERID>' + opts.brokerId +
        '<ACCTID>' + opts.accId +
        '</INVACCTFROM>' +
        '<INCTRAN>' +
        '<DTSTART>' + opts.start +
        (typeof opts.end !== 'undefined' ? '<DTEND>' + opts.end : '') +
        '<INCLUDE>Y</INCTRAN>' +
        '<INCOO>Y' +
        '<INCPOS>' +
        '<INCLUDE>Y' +
        '</INCPOS>' +
        '<INCBAL>Y' +
        '</INVSTMTRQ>' +
        '</INVSTMTTRNRQ>' +
        '</INVSTMTMSGSRQV1>';
      break;

    case 'CREDITCARD':
      reqStr += '<CREDITCARDMSGSRQV1>' +
        '<CCSTMTTRNRQ>' +
        '<TRNUID>' + util.uuid(32) +
        '<CLTCOOKIE>' + util.uuid(5) +
        '<CCSTMTRQ>' +
        '<CCACCTFROM>' +
        '<ACCTID>' + opts.accId +
        '</CCACCTFROM>' +
        '<INCTRAN>' +
        '<DTSTART>' + opts.start +
        (typeof opts.end !== 'undefined' ? '<DTEND>' + opts.end : '') +
        '<INCLUDE>Y</INCTRAN>' +
        '</CCSTMTRQ>' +
        '</CCSTMTTRNRQ>' +
        '</CREDITCARDMSGSRQV1>';
      break;

    default:
      reqStr += '<BANKMSGSRQV1>' +
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
        (typeof opts.end !== 'undefined' ? '<DTEND>' + opts.end : '') +
        '<INCLUDE>Y</INCTRAN>' +
        '</STMTRQ>' +
        '</STMTTRNRQ>' +
        '</BANKMSGSRQV1>';
  }

  reqStr += '</OFX>';

  debug('OFX-RequestString:', reqStr);
  return reqStr;
};

/**
 * Parse an OFX response string
 * @param ofxStr
 * @param fn
 */
OFX.parse = function (ofxStr, fn) {
  var data = {};
  var callback = fn;
  var ofxRes = ofxStr.split('<OFX>', 2);
  var ofx = '<OFX>' + ofxRes[1];
  var headerString = ofxRes[0].split(/\r|\n/);

  data.xml = ofx
    // Remove empty spaces and line breaks between tags
    .replace(/>\s+</g, '><')
    // Remove empty spaces and line breaks before tags content
    .replace(/\s+</g, '<')
    // Remove empty spaces and line breaks after tags content
    .replace(/>\s+/g, '>')
    // Remove dots in start-tags names and remove end-tags with dots
    .replace(/<([A-Z0-9_]*)+\.+([A-Z0-9_]*)>([^<]+)(<\/\1\.\2>)?/g, '<\$1\$2>\$3')
    // Add a new end-tags for the ofx elements
    .replace(/<(\w+?)>([^<]+)/g, '<\$1>\$2</<added>\$1>')
    // Remove duplicate end-tags
    .replace(/<\/<added>(\w+?)>(<\/\1>)?/g, '</\$1>');

  parser.parseString(data.xml, function (err, result) {
    data.body = result;
  });

  data.header = {};

  for (var key in headerString) {
    if (typeof headerString[key] === "string") {
      var headAttributes = headerString[key].split(/:/, 2);
    }
    if (headAttributes[0]) data.header[headAttributes[0]] = headAttributes[1];
  }
  fn(data);
};
