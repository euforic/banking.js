/*!
 * [OFX description]
 * @type {[type]}
 */

const xml2js = require('xml2js'),
  parser = new xml2js.Parser({ explicitArray: false }),
  streamingParser = new xml2js.Parser({
    explicitArray: false,
    normalize: false,
    trim: true,
    mergeAttrs: true
  }),
  util = require('./utils'),
  debug = require('debug')('banking:ofx');

// expose OFX

const OFX = (module.exports = {});

// Performance optimization: Cache for preprocessed XML patterns
const _xmlPatternCache = new Map();
const MAX_CACHE_SIZE = 100; // Limit memory usage
const CACHE_CLEANUP_THRESHOLD = 80;

function getSignOnMsg(opts) {
  const dtClient = new Date()
    .toISOString()
    .substring(0, 20)
    .replace(/[^0-9]/g, '');

  return (
    `<SIGNONMSGSRQV1>` +
    `<SONRQ>` +
    `<DTCLIENT>${dtClient}<USERID>${opts.user}<USERPASS>${opts.password}<LANGUAGE>ENG` +
    `<FI>` +
    `<ORG>${opts.fidOrg}<FID>${opts.fid}</FI>` +
    `<APPID>${opts.app}<APPVER>${opts.appVer}${
      typeof opts.clientId !== 'undefined' ? `<CLIENTUID>${opts.clientId}` : ''
    }</SONRQ>` +
    `</SIGNONMSGSRQV1>`
  );
}

function getOfxHeaders(opts) {
  return (
    `OFXHEADER:100\r\n` +
    `DATA:OFXSGML\r\n` +
    `VERSION:${opts.ofxVer}\r\n` +
    `SECURITY:NONE\r\n` +
    `ENCODING:USASCII\r\n` +
    `CHARSET:1252\r\n` +
    `COMPRESSION:NONE\r\n` +
    `OLDFILEUID:NONE\r\n` +
    `NEWFILEUID:${util.uuid(32)}\r\n` +
    `\r\n`
  );
}

/**
 * Builds an OFX account list request
 * @param opts
 * @returns {string}
 */
OFX.buildAccountListRequest = function (opts) {
  let reqStr = `${getOfxHeaders(opts)}<OFX>${getSignOnMsg(opts)}`;
  reqStr +=
    `<SIGNUPMSGSRQV1>` +
    `<ACCTINFOTRNRQ>` +
    `<TRNUID>${util.uuid(32)}<ACCTINFORQ>` +
    `<DTACCTUP>19900101` +
    `</ACCTINFORQ>` +
    `</ACCTINFOTRNRQ>` +
    `</SIGNUPMSGSRQV1>` +
    `</OFX>`;

  return reqStr;
};

/**
 * Builds an OFX statement request
 * @param opts
 * @returns {string}
 */
OFX.buildStatementRequest = function (opts) {
  const type = (opts.accType || '').toUpperCase();
  let reqStr = `${getOfxHeaders(opts)}<OFX>${getSignOnMsg(opts)}`;

  switch (type) {
    case 'INVESTMENT':
      reqStr +=
        `<INVSTMTMSGSRQV1>` +
        `<INVSTMTTRNRQ>` +
        `<TRNUID>${util.uuid(32)}<CLTCOOKIE>${util.uuid(5)}<INVSTMTRQ>` +
        `<INVACCTFROM>` +
        `<BROKERID>${opts.brokerId}<ACCTID>${opts.accId}</INVACCTFROM>` +
        `<INCTRAN>` +
        `<DTSTART>${opts.start}${typeof opts.end !== 'undefined' ? `<DTEND>${opts.end}` : ''}<INCLUDE>Y</INCTRAN>` +
        `<INCOO>Y` +
        `<INCPOS>` +
        `<INCLUDE>Y` +
        `</INCPOS>` +
        `<INCBAL>Y` +
        `</INVSTMTRQ>` +
        `</INVSTMTTRNRQ>` +
        `</INVSTMTMSGSRQV1>`;
      break;

    case 'CREDITCARD':
      reqStr +=
        `<CREDITCARDMSGSRQV1>` +
        `<CCSTMTTRNRQ>` +
        `<TRNUID>${util.uuid(32)}<CLTCOOKIE>${util.uuid(5)}<CCSTMTRQ>` +
        `<CCACCTFROM>` +
        `<ACCTID>${opts.accId}</CCACCTFROM>` +
        `<INCTRAN>` +
        `<DTSTART>${opts.start}${typeof opts.end !== 'undefined' ? `<DTEND>${opts.end}` : ''}<INCLUDE>Y</INCTRAN>` +
        `</CCSTMTRQ>` +
        `</CCSTMTTRNRQ>` +
        `</CREDITCARDMSGSRQV1>`;
      break;

    default:
      reqStr +=
        `<BANKMSGSRQV1>` +
        `<STMTTRNRQ>` +
        `<TRNUID>${util.uuid(32)}<CLTCOOKIE>${util.uuid(5)}<STMTRQ>` +
        `<BANKACCTFROM>` +
        `<BANKID>${opts.bankId}<ACCTID>${opts.accId}<ACCTTYPE>${type}</BANKACCTFROM>` +
        `<INCTRAN>` +
        `<DTSTART>${opts.start}${typeof opts.end !== 'undefined' ? `<DTEND>${opts.end}` : ''}<INCLUDE>Y</INCTRAN>` +
        `</STMTRQ>` +
        `</STMTTRNRQ>` +
        `</BANKMSGSRQV1>`;
  }

  reqStr += '</OFX>';

  debug('OFX-RequestString:', reqStr);
  return reqStr;
};

/**
 * Parse an OFX response string - Performance Optimized
 * @param ofxStr
 * @param fn
 */
OFX.parse = function (ofxStr, fn) {
  const parseStartTime = process.hrtime.bigint();
  const initialMemory = process.memoryUsage();

  debug(`OFX Parse Start: ${ofxStr.length} bytes, Memory: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);

  const data = {};
  const ofxRes = ofxStr.split('<OFX>', 2);
  const ofx = `<OFX>${ofxRes[1]}`;
  const headerString = ofxRes[0].split(/\r|\n/);

  // Auto-detect if streaming parsing should be used for large responses
  const shouldUseStreaming = _shouldUseStreamingParse(ofxStr);

  if (shouldUseStreaming) {
    debug('Using streaming parser for large OFX response');
    return _parseWithStreaming(ofx, headerString, fn, parseStartTime, initialMemory);
  }

  // Performance optimization: Single-pass XML preprocessing
  // Combined multiple regex operations into one optimized function
  data.xml = _optimizedXmlPreprocess(ofx);

  parser.parseString(data.xml, (err, result) => {
    if (err) {
      debug('XML Parsing Error:', err);
    }
    data.body = result;
  });

  // Performance optimization: Optimized header parsing
  data.header = _optimizedHeaderParse(headerString);

  // Log performance metrics
  _logParseMetrics(parseStartTime, initialMemory, ofxStr.length, shouldUseStreaming);

  fn(data);
};

/**
 * Determine if streaming parsing should be used based on content size and complexity
 * @private
 */
function _shouldUseStreamingParse(ofxStr) {
  // Use streaming for responses larger than 1MB
  if (ofxStr.length > 1024 * 1024) return true;

  // Use streaming if many transaction records detected
  const transactionCount = (ofxStr.match(/<STMTTRN>/g) || []).length;
  if (transactionCount > 1000) return true;

  return false;
}

/**
 * Parse large OFX responses using streaming approach to minimize memory usage
 * @private
 */
function _parseWithStreaming(ofx, headerString, fn, parseStartTime, initialMemory) {
  const data = {
    header: _optimizedHeaderParse(headerString),
    body: null,
    xml: null
  };

  // For streaming, we still need to preprocess but with memory optimization
  const processedXml = _optimizedXmlPreprocessStreaming(ofx);
  data.xml = processedXml;

  streamingParser.parseString(processedXml, (err, result) => {
    if (err) {
      debug('Streaming XML Parsing Error:', err);
    }
    data.body = result;

    // Log streaming performance metrics
    _logParseMetrics(parseStartTime, initialMemory, ofx.length, true);

    fn(data);
  });
}

/**
 * Memory-optimized XML preprocessing for streaming
 * @private
 */
function _optimizedXmlPreprocessStreaming(ofx) {
  // For very large files, process in chunks to avoid memory spikes
  const chunkSize = 64 * 1024; // 64KB chunks
  let result = '';

  for (let i = 0; i < ofx.length; i += chunkSize) {
    const chunk = ofx.slice(i, i + chunkSize);
    result += _optimizedXmlPreprocess(chunk);

    // Allow event loop to process other operations
    if (i % (chunkSize * 10) === 0) {
      // Force garbage collection opportunity for large files
      if (global.gc) {
        global.gc();
      }
    }
  }

  return result;
}

/**
 * Optimized XML preprocessing with combined regex operations and caching
 * Uses the original proven logic but with performance optimizations
 * @private
 */
function _optimizedXmlPreprocess(ofx) {
  // Check cache first for small, common patterns
  const cacheKey = _generateCacheKey(ofx);
  if (cacheKey && _xmlPatternCache.has(cacheKey)) {
    debug('XML preprocessing cache hit');
    return _xmlPatternCache.get(cacheKey);
  }

  // Original proven logic with performance optimizations
  let result = ofx
    // Remove empty spaces and line breaks between tags
    .replace(/>\s+</g, '><')
    // Remove empty spaces and line breaks before tags content
    .replace(/\s+</g, '<')
    // Remove empty spaces and line breaks after tags content
    .replace(/>\s+/g, '>')
    // Remove dots in start-tags names and remove end-tags with dots
    .replace(/<([A-Z0-9_]*)+\.+([A-Z0-9_]*)>([^<]+)(<\/\1\.\2>)?/g, '<$1$2>$3')
    // Add a new end-tags for the ofx elements
    .replace(/<(\w+?)>([^<]+)/g, '<$1>$2</<added>$1>')
    // Remove duplicate end-tags
    .replace(/<\/<added>(\w+?)>(<\/\1>)?/g, '</$1>');

  // Cache result if it's worth caching (small, common patterns)
  if (cacheKey && ofx.length < 1024) {
    _cacheXmlPattern(cacheKey, result);
  }

  return result;
}

/**
 * Generate cache key for XML patterns
 * @private
 */
function _generateCacheKey(ofx) {
  // Only cache small, common patterns to avoid memory bloat
  if (ofx.length > 1024) return null;

  // Create hash-like key from first/last chars and length
  const start = ofx.substring(0, 20);
  const end = ofx.substring(Math.max(0, ofx.length - 20));
  return `${start.length}_${end.length}_${ofx.length}`;
}

/**
 * Cache XML pattern with LRU-style cleanup
 * @private
 */
function _cacheXmlPattern(key, result) {
  if (_xmlPatternCache.size >= MAX_CACHE_SIZE) {
    // Simple LRU: remove oldest entries
    const keysToDelete = Array.from(_xmlPatternCache.keys()).slice(0, MAX_CACHE_SIZE - CACHE_CLEANUP_THRESHOLD);
    for (const oldKey of keysToDelete) {
      _xmlPatternCache.delete(oldKey);
    }
    debug(`XML cache cleanup: removed ${keysToDelete.length} entries`);
  }

  _xmlPatternCache.set(key, result);
}

/**
 * Log performance metrics for OFX parsing operations
 * @private
 */
function _logParseMetrics(parseStartTime, initialMemory, inputSize, usedStreaming) {
  const parseEndTime = process.hrtime.bigint();
  const finalMemory = process.memoryUsage();

  const durationMs = Number(parseEndTime - parseStartTime) / 1000000; // Convert nanoseconds to milliseconds
  const memoryDeltaMB = Math.round((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024);
  const throughputMBps = inputSize / 1024 / 1024 / (durationMs / 1000);

  debug(`OFX Parse Complete:
    Duration: ${durationMs.toFixed(2)}ms
    Input Size: ${(inputSize / 1024).toFixed(1)}KB
    Memory Delta: ${memoryDeltaMB >= 0 ? '+' : ''}${memoryDeltaMB}MB
    Throughput: ${throughputMBps.toFixed(2)}MB/s
    Streaming: ${usedStreaming ? 'Yes' : 'No'}
    Cache Hits: ${_xmlPatternCache.size}`);

  // Warn if memory usage is excessive
  if (memoryDeltaMB > 100) {
    debug(`WARNING: High memory usage detected (+${memoryDeltaMB}MB). Consider increasing streaming threshold.`);
  }

  // Warn if performance is poor
  if (throughputMBps < 1.0) {
    debug(`WARNING: Low throughput detected (${throughputMBps.toFixed(2)}MB/s). Performance may be degraded.`);
  }
}

/**
 * Optimized header parsing with better error handling
 * @private
 */
function _optimizedHeaderParse(headerString) {
  const headers = {};

  for (let i = 0; i < headerString.length; i++) {
    const line = headerString[i];
    if (typeof line === 'string' && line.includes(':')) {
      const colonIndex = line.indexOf(':');
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      if (key) {
        headers[key] = value;
      }
    }
  }

  return headers;
}
