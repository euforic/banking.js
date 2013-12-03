

/**
 * Unique Id Generator
 *
 * @param {number} length
 * @return {string} radix
 * @return {string} uuid
 * @api private
 */

var Util = module.exports = {};

Util.uuid = function(len,radix) {
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
 * [mixin description]
 * @param  {[type]} base [description]
 * @param  {[type]} obj  [description]
 * @return {[type]}      [description]
 */

Util.mixin = function (base, obj) {
  for (var key in base) {
    obj[key] = (obj[key]) ? obj[key] : base[key];
  }
  return obj;
}
