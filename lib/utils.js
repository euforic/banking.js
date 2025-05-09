const tls = require('tls');
const url = require('url');

/**
 * Unique Id Generator
 *
 * @param {number} [len] - The length of the ID to generate.
 * @param {number} [radix] - The radix for the ID characters.
 * @return {string} uuid - The generated unique ID.
 * @api private
 */

const Util = {};
module.exports = Util;

Util.uuid = (len, radix) => {
    const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
    let chars = CHARS;
    let uuid = [];
    radix = radix || chars.length;

    if (len) {
      for (let i = 0; i < len; i++) uuid[i] = chars[0 | Math.random() * radix];
      return uuid.join('');
    }

    let r;
    uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
    uuid[14] = '4';

    for (let i = 0; i < 36; i++) {
      if (!uuid[i]) {
        r = 0 | Math.random() * 16;
        uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
      }
    }
    return uuid.join('');
};

/**
 * Makes a secure request to an OFX server and posts an OFX payload.
 * @param {object} options - Request options.
 * @param {string} options.url - The URL for the request.
 * @param {string[]} options.headers - Array of header names to include.
 * @param {string} ofxPayload - The OFX payload string.
 * @returns {Promise<string>} A promise that resolves with the response data or rejects with an error.
 */
Util.request = async (options, ofxPayload) => {
  return new Promise((resolve, reject) => {
    const { port, hostname } = url.parse(options.url);
    const tlsOpts = {
      port: port || (options.url.startsWith('https') ? 443 : 80),
      host: hostname
    };

    let requestBuffer = `POST ${url.parse(options.url).path} HTTP/1.1\r\n`;
    options.headers.forEach(headerName => {
      let headerValue;
      if (options[headerName]) {
        headerValue = options[headerName];
      } else if (headerName === 'Content-Length') {
        headerValue = ofxPayload.length;
      } else if (headerName === 'Host') {
        headerValue = hostname;
      }
      if (headerValue !== undefined) {
        requestBuffer += `${headerName}: ${headerValue}\r\n`;
      }
    });
    requestBuffer += '\r\n';
    requestBuffer += ofxPayload;

    const socket = tls.connect(tlsOpts, () => {
      socket.write(requestBuffer);
    });

    let responseData = '';
    socket.on('data', chunk => {
      responseData += chunk;
    });

    socket.on('end', () => {
      const endOfHeaders = responseData.indexOf('\r\n\r\n');
      if (endOfHeaders === -1) {
        return reject(new Error('Invalid HTTP response: No headers found.'));
      }
      
      const headerText = responseData.substring(0, endOfHeaders);
      const bodyText = responseData.substring(endOfHeaders + 4);

      const statusLineMatch = headerText.match(/^HTTP\/\d\.\d (\d{3}) (.*)/);

      if (statusLineMatch && statusLineMatch.length > 2) {
        const statusCode = parseInt(statusLineMatch[1], 10);
        if (statusCode === 200) {
          resolve(bodyText); 
        } else {
          reject(new Error(`${statusLineMatch[1]} ${statusLineMatch[2]}`)); 
        }
      } else {
        reject(new Error('Invalid HTTP response: Status line not found or malformed.'));
      }
    });

    socket.on('error', err => {
      reject(err);
    });

    socket.on('close', hadError => {
      if (hadError && !socket.destroyed) { 
        // handled by 'error' event
      }
    });
  });
};
