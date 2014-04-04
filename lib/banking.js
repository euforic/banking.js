
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
    appVer: args.appVer || '1700',
    ofxVer: args.ofxVer || '102',
    app: args.app || 'QWIN'
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
 * Fetches Ofx String from Bank Server and parse to json or returns valid XML
 *
 * @param {JSON} o Request Config Settings
 * @param {String} format (Options are 'xml' || 'json' if omitted defaults to 'json')
 * @param {Function} cb
 * @return {XML|JSON}
 * @api public
 */

Banking.prototype.getStatement = function(args, fn) {
  var opts = util.mixin(this.opts, args);
  var ofxReq = ofx.createRequest(opts);

  var req = request
    .post(this.opts.url)
    .type('application/x-ofx')
    .set({'User-Agent' : 'banking-js'})
    .set({'Accept' : 'application/ofx'})
    .send(ofxReq)
    .buffer()

  if (!fn) return req;

  req
    .end(function (res){
      debug('Raw-Response:', res.text);
      if (!res.ok) return fn(true, res.text);
      ofx.parse(res.text, function(ofxObj){
        fn(false, ofxObj);
      });
    });
};
