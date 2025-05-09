/*!
 * [OFX description]
 * @type {[type]}
 */

import xml2js from 'xml2js';
import util from './utils.js';
import debugLib from 'debug';
const parser = new xml2js.Parser({ explicitArray: false });
const debug = debugLib('banking:ofx');

export const getSignOnMsg = (opts) => {
  const dtClient = (new Date()).toISOString().substring(0, 20).replace(/[^0-9]/g, '');
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
    (opts.clientId ? '<CLIENTUID>' + opts.clientId : '') +
    '</SONRQ>' +
    '</SIGNONMSGSRQV1>';
};

export const getOfxHeaders = (opts) => {
  return `OFXHEADER:100\r\n
    DATA:OFXSGML\r\n
    VERSION:${opts.ofxVer}\r\n
    SECURITY:NONE\r\n
    ENCODING:USASCII\r\n
    CHARSET:1252\r\n
    COMPRESSION:NONE\r\n
    OLDFILEUID:NONE\r\n
    NEWFILEUID:${util.uuid(32)}\r\n
    \r\n`;
};

export const buildAccountListRequest = (opts) => {
  let reqStr = getOfxHeaders(opts) + '<OFX>' + getSignOnMsg(opts);
  reqStr += `<SIGNUPMSGSRQV1>
    <ACCTINFOTRNRQ>
      <TRNUID>${util.uuid(32)}
      <ACCTINFORQ>
        <DTACCTUP>19900101
      </ACCTINFORQ>
    </ACCTINFOTRNRQ>
  </SIGNUPMSGSRQV1>
</OFX>`;
  return reqStr;
};

export const buildStatementRequest = (opts) => {
  const type = (opts.accType || '').toUpperCase();
  let reqStr = getOfxHeaders(opts) + '<OFX>' + getSignOnMsg(opts);
  switch (type) {
    case 'INVESTMENT':
      reqStr += `<INVSTMTMSGSRQV1>
        <INVSTMTTRNRQ>
          <TRNUID>${util.uuid(32)}
          <CLTCOOKIE>${util.uuid(5)}
          <INVSTMTRQ>
            <INVACCTFROM>
              <BROKERID>${opts.brokerId}
              <ACCTID>${opts.accId}
            </INVACCTFROM>
            <INCTRAN>
              <DTSTART>${opts.start}
              ${opts.end ? `<DTEND>${opts.end}` : ''}
              <INCLUDE>Y
            </INCTRAN>
            <INCOO>Y
            <INCPOS>
              <DTASOF>${new Date().toISOString().substring(0, 10).replace(/-/g, '')}
              <INCLUDE>Y
            </INCPOS>
            <INCBAL>Y
          </INVSTMTRQ>
        </INVSTMTTRNRQ>
      </INVSTMTMSGSRQV1>`;
      break;
    case 'CREDITCARD':
      reqStr += `<CREDITCARDMSGSRQV1>
        <CCSTMTTRNRQ>
          <TRNUID>${util.uuid(32)}
          <CLTCOOKIE>${util.uuid(5)}
          <CCSTMTRQ>
            <CCACCTFROM>
              <ACCTID>${opts.accId}
            </CCACCTFROM>
            <INCTRAN>
              <DTSTART>${opts.start}
              ${opts.end ? `<DTEND>${opts.end}` : ''}
              <INCLUDE>Y
            </INCTRAN>
          </CCSTMTRQ>
        </CCSTMTTRNRQ>
      </CREDITCARDMSGSRQV1>`;
      break;
    default:
      reqStr += `<BANKMSGSRQV1>
        <STMTTRNRQ>
          <TRNUID>${util.uuid(32)}
          <CLTCOOKIE>${util.uuid(5)}
          <STMTRQ>
            <BANKACCTFROM>
              <BANKID>${opts.bankId}
              <ACCTID>${opts.accId}
              <ACCTTYPE>${type}
            </BANKACCTFROM>
            <INCTRAN>
              <DTSTART>${opts.start}
              ${opts.end ? `<DTEND>${opts.end}` : ''}
              <INCLUDE>Y
            </INCTRAN>
          </STMTRQ>
        </STMTTRNRQ>
      </BANKMSGSRQV1>`;
  }
  reqStr += '</OFX>';
  debug(`OFX-RequestString: ${reqStr}`);
  return reqStr;
};

export const parse = async (ofxStr) => {
  const data = {};
  debug('--- OFX parse: start ---');
  // Split at first <OFX> (case-insensitive), only parse the body
  const match = ofxStr.match(/<OFX[\s>]/i);
  if (!match) {
    debug('No <OFX> root tag found in input. First 200 chars:', ofxStr.slice(0, 200));
    throw new Error('No <OFX> root tag found in input');
  }
  const ofxStart = match.index;
  let ofx = ofxStr.slice(ofxStart);
  debug('Original OFX body (first 200 chars):', ofx.slice(0, 200));
  // Step 1: Flatten
  ofx = ofx.replace(/>[\s\r\n]+</g, '><');
  debug('After flatten (first 200 chars):', ofx.slice(0, 200));

  // Reverting to original regex normalization (from checkpoint memory)
  // The flatten step (ofx = ofx.replace(/>[\s\r\n]+</g, '><');) is kept from above this block.
  ofx = ofx
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

  debug('After original regex normalization (first 200 chars):', ofx.slice(0, 200));
  // The existing 'data.xml = ofx;' line below will use this modified 'ofx'

  data.xml = ofx;
  try {
    data.body = await new Promise((resolve, reject) => {
      parser.parseString(data.xml, (err, result) => {
        if (err) {
          debug('OFX parse failed:', err.message);
          debug('Problematic XML snippet (first 500 chars):', data.xml.slice(0, 500));
          return reject(err);
        }
        resolve(result);
      });
    });
    debug('--- OFX parse: success ---');
    return data;
  } catch (err) {
    debug('OFX parse failed:', err);
    throw err;
  }
};

export const parseHeader = (headerString) => {
  const data = {};
  data.header = {};
  for (const line of headerString) {
    if (typeof line !== 'string' || !line.trim()) {
      continue;
    }
    const headAttributes = line.split(/:/, 2);
    if (headAttributes[0] && headAttributes.length === 2) {
      data.header[headAttributes[0].trim()] = (headAttributes[1] || '').trim();
    }
  }
  return data;
};
