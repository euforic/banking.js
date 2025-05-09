/*!
 * banking.js
 */

/**
 * @module banking
 */

const fs = require('fs');
const util_node = require('util');
const readFileAsync = util_node.promisify(fs.readFile);
const pkg = require('../package.json');
const ofx = require('./ofx');
const util = require('./utils');
const debug = require('debug')('banking:main');

/**
 * Represents a connection to a financial institution.
 */
class Banking {
  /**
   * Creates an instance of Banking.
   * @constructor
   * @param {object} args - Configuration arguments for the banking instance.
   * @param {number} args.fid - Financial Institution ID.
   * @param {string} [args.fidOrg=''] - Financial Institution Organization.
   * @param {string} args.url - URL of the OFX server.
   * @param {string} [args.bankId=''] - Bank ID (Routing number for bank accounts).
   * @param {string} args.user - Username for authentication.
   * @param {string} args.password - Password for authentication.
   * @param {string} args.accId - Account Number.
   * @param {string} [args.brokerId] - Broker ID (for investment accounts).
   * @param {string} args.accType - Account Type (e.g., CHECKING, SAVINGS, CREDITCARD, INVEST).
   * @param {string} [args.clientId] - Client ID if required by the FI.
   * @param {string} [args.appVer='1700'] - Application Version.
   * @param {string} [args.ofxVer='102'] - OFX Version.
   * @param {string} [args.app='QWIN'] - Application Name.
   * @param {string} [args.User-Agent='banking-js'] - User-Agent header.
   * @param {string} [args.Content-Type='application/x-ofx'] - Content-Type header.
   * @param {string} [args.Accept='application/ofx'] - Accept header.
   * @param {string} [args.Connection='Close'] - Connection header.
   * @param {string[]} [args.headers=['Host', 'Accept', 'User-Agent', 'Content-Type', 'Content-Length', 'Connection']] - Headers to include in the request.
   */
  constructor(args) {
    this.opts = {
      fid: args.fid,
      fidOrg: args.fidOrg || '',
      url: args.url,
      bankId: args.bankId || '',
      user: args.user,
      password: args.password,
      accId: args.accId,
      brokerId: args.brokerId,
      accType: args.accType,
      clientId: args.clientId,
      appVer: args.appVer || '1700',
      ofxVer: args.ofxVer || '102',
      app: args.app || 'QWIN',
      'User-Agent': args['User-Agent'] || 'banking-js',
      'Content-Type': args['Content-Type'] || 'application/x-ofx',
      Accept: args.Accept || 'application/ofx',
      Connection: args.Connection || 'Close',
      headers: args.headers || ['Host', 'Accept', 'User-Agent', 'Content-Type', 'Content-Length', 'Connection']
    };
  }

  /**
   * The current version of the banking.js library.
   * @type {string}
   * @static
   */
  static version = pkg.version;

  /**
   * Parses an OFX file.
   * @param {string} file - Path to the OFX file.
   * @returns {Promise<object>} A promise that resolves with the parsed OFX data.
   * @static
   * @deprecated Consider using a Promise-based version in the future. (This is now that version)
   */
  static async parseFile(file) {
    try {
      const data = await readFileAsync(file, 'utf8');
      const ofxData = await ofx.parse(data);
      return ofxData;
    } catch (err) {
      debug('Error in parseFile:', err);
      throw err;
    }
  }

  /**
   * Parses an OFX string.
   * @param {string} str - The OFX string.
   * @returns {Promise<object>} A promise that resolves with the parsed OFX data.
   * @static
   * @deprecated Consider using a Promise-based version in the future. (This is now that version)
   */
  static async parse(str){
    try {
      const ofxData = await ofx.parse(str);
      return ofxData;
    } catch (err) {
      debug('Error in parse:', err);
      throw err;
    }
  }

  /**
   * Gets a list of transactions from the OFX server.
   * @param {object} args - Arguments for the statement request.
   * @param {string|number} args.start - Start date for transactions (e.g., YYYYMMDD).
   * @param {string|number} args.end - End date for transactions (e.g., YYYYMMDD).
   * @returns {Promise<object>} A promise that resolves with the parsed OFX statement object.
   */
  async getStatement(args) {
    const opts = Object.assign({}, this.opts, args);
    const ofxReq = ofx.buildStatementRequest(opts);

    try {
      const response = await util.request(this.opts, ofxReq);
      debug('Raw-Response:', response);
      const ofxObj = await ofx.parse(response);
      return ofxObj;
    } catch (err) {
      debug('Error in getStatement:', err);
      throw err;
    }
  }

  /**
   * Gets a list of accounts from the OFX server.
   * @returns {Promise<object>} A promise that resolves with the parsed OFX account list object.
   */
  async getAccounts() {
    const ofxReq = ofx.buildAccountListRequest(this.opts);

    try {
      const response = await util.request(this.opts, ofxReq);
      debug('Raw-Response:', response);
      const ofxObj = await ofx.parse(response);
      return ofxObj;
    } catch (err) {
      debug('Error in getAccounts:', err);
      throw err;
    }
  }
}

module.exports = Banking;
