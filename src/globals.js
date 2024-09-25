// globals.js

const { format } = require('util');

// Allow BigInt to serialize for logging.
BigInt.prototype.toJSON = function () {
    return this.toString();
};

// Define extended Error subclass that formats messages.
class ErrorF extends Error {
    constructor(messagef,...args) {
        super(format(messagef,...args));
    }
}
global.ErrorF = ErrorF;
