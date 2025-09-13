const Banking = require('./lib/banking');
const Errors = require('./lib/errors');

// Attach error classes to the main Banking export for easy access
Object.assign(Banking, Errors);

module.exports = Banking;
