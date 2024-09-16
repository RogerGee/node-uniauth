
// globals.js

const { format } = require('util');

// Define extended Error subclass that formats messages.
class ErrorF extends Error {
    constructor(messagef,...args) {
        super(format(messagef,...args));
    }
}
global.ErrorF = ErrorF;
