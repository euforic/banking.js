
/*!
 * banking.js
 */

/**
 * [request description]
 * @type {[type]}
 */

var request = require('superagent')
  , fs = require('fs')
  , ofx = require('./ofx')
  , pkg = require('../package')
  , util = require('./utils')
  , debug = require('debug')('banking:main');


/**
 * expose Banking
 */

module.exports = Banking;

/**
 * [Banking description]
 * @param {[type]} args [description]
 */

function Banking(args){
  if (!(this instanceof Banking)) return new Banking(args);
  this.opts = {
    fid: args.fid,
    fidOrg: args.fidOrg || '',
    url: args.url,
    bankId: args.bankId || '', /* If bank account use your bank routing number otherwise set to null */
    user: args.user,
    password: args.password,
    accId: args.accId,  /* Account Number */
    brokerId: args.brokerId, /* For investment accounts */
    accType: args.accType,
    clientId: args.clientId,
    appVer: args.appVer || '1700',
    ofxVer: args.ofxVer || '102',
    app: args.app || 'QWIN',
    'User-Agent': args['User-Agent'] || 'banking-js',
    'Content-Type': args['Content-Type'] || 'application/x-ofx' ,
    Accept: args.Accept || 'application/ofx',
    Connection: args.Connection || 'Close',
    headers: args.headers || ['Host', 'Accept', 'User-Agent', 'Content-Type', 'Content-Length', 'Connection']
  };
}

/**
 * [version description]
 */

Banking.version = pkg.version;

/**
 * [parseFile description]
 * @param  {[type]}   file [description]
 * @param  {Function} fn   [description]
 * @return {[type]}        [description]
 */

Banking.parseFile = function(file, fn) {
  fs.readFile(file, 'utf8', function (err, data) {
    if (err) throw new Error(err);
    ofx.parse(data, function (res){
      fn(res);
    });
  });
};

/**
 * [parse description]
 * @param  {[type]}   str [description]
 * @param  {Function} fn  [description]
 * @return {[type]}       [description]
 */

Banking.parse = function(str, fn){
  ofx.parse(str, function (res){
    fn(res);
  });
};

/**
 * Get a list of transactions from the ofx server
 * @param args set start and end date for transaction range
 * @param fn callback(error, transactions)
 */
Banking.prototype.getStatement = function(args, fn) {
  var opts = util.mixin(this.opts, args);
  var ofxReq = ofx.createRequest(opts);

  util.request(this.opts, ofxReq, function(err, response) {
    debug('Raw-Response:', response);
    if (err) return fn(err, err);
    ofx.parse(response, function(ofxObj) {
      fn(false, ofxObj);
    });
  });
};
