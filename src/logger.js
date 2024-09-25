/**
 * logger.js
 *
 * @module logger
 */

const util = require("util");

class Logger {
    constructor(level) {
        this.level = level;
    }

    message(message,...formatArgs) {
        if (this.level < 1) {
            return;
        }

        const line = util.format(message,...formatArgs);
        console.log(line);
    }

    client(message,...formatArgs) {
        if (this.level < 2) {
            return;
        }

        const line = util.format(message,...formatArgs);
        console.log("[CLIENT] "+line);
    }

    debug(message,...formatArgs) {
        if (this.level < 3) {
            return;
        }

        const line = util.format(message,...formatArgs);
        console.log("[DEBUG] "+line);
    }
}

module.exports = {
    Logger
};
