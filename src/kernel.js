/**
 * kernel.js
 *
 * @module kernel
 */

const fs = require("fs");
const YAML = require("yaml");
const merge = require("deepmerge");

const OPTION_DEFAULTS = {
    debug: false,
    configFile: "/etc/node-uniauth/config.yaml",
};

const OPTION_DEFAULTS_DEBUG = {
    debug: true,
    configFile: "./local/config.yaml"
};

const CONFIG_DEFAULTS = {
    listenSock: "/var/run/node-uniauth.sock",
    recordStore: "/var/lib/node-uniauth/records.db"
};

const CONFIG_DEFAULTS_DEBUG = {
    listenSock: "./local/listen.sock",
    recordStore: "./local/records.db"
};

class Kernel {
    constructor(options) {
        if (options.debug) {
            this.options = merge(OPTION_DEFAULTS_DEBUG,options);
        }
        else {
            this.options = merge(OPTION_DEFAULTS,options);
        }

        this.config = {};
        this.listener = null;
    }

    start() {
        let yaml = "";
        const stream = fs.createReadStream(this.options.configFile);

        stream.on("data",(chunk) => {
            yaml += chunk;
        });

        stream.on("end",() => {
            const parsed = YAML.parse(yaml);
            if (parsed !== null && typeof parsed === "object") {
                if (this.options.debug) {
                    this.config = merge(CONFIG_DEFAULTS_DEBUG,parsed);
                }
                else {
                    this.config = merge(CONFIG_DEFAULTS,parsed);
                }
            }

            this._serve();
        });
    }

    stop(signal) {

    }

    _serve() {

    }
}

module.exports = {
    Kernel
};
