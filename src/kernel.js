/**
 * kernel.js
 *
 * @module kernel
 */

const fs = require("fs");
const net = require("net");

const YAML = require("yaml");
const merge = require("deepmerge");

const { SessionHandler } = require("./session-handler");

const OPTION_DEFAULTS = {
    debug: false,
    configFile: "/etc/node-uniauth/config.yml",
};

const OPTION_DEFAULTS_DEBUG = {
    debug: true,
    configFile: "./local/config.yml"
};

const CONFIG_DEFAULTS = {
    listen: {
        host: null,
        port: 8000,
        path: null
    },
    record_store: "/var/lib/node-uniauth/records.db"
};

const CONFIG_DEFAULTS_DEBUG = {
    listen: {
        host: "127.0.0.1",
        port: 8002,
        path: null
    },
    record_store: "./local/records.db"
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

        this.sessionServer = null;
        this.sessionHandlers = new Map();
        this.sessionStorage = new Map();
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
            else {
                this.config = this.options.debug
                    ? CONFIG_DEFAULTS_DEBUG
                    : CONFIG_DEFAULTS;
            }

            this._serve();
        });

        stream.on("error",(err) => {
            throw new ErrorF(
                "Cannot read specified config file '%s': %s",
                this.options.configFile,
                err.message
            );
        });
    }

    stop(signal,callback) {
        this.sessionHandlers.forEach((handler) => {
            handler.stop();
        });
        if (this.sessionServer != null) {
            this.sessionServer.close(callback);
        }
    }

    getSession(key) {
        return this.sessionStorage.get(key);
    }

    putSession(sess) {
        this.sessionStorage.set(sess.key,sess);
    }

    purgeSession(key) {
        const sess = this.sessionStorage.get(key);
        if (!sess) {
            return;
        }

        this.sessionStorage.delete(key);
        sess.purge();
    }

    _listen() {
        if (this.config.listen.path) {
            if (typeof this.config.listen.path !== "string") {
                throw new ErrorF("Config property 'listen.path' must be a string");
            }
            this.sessionServer.listen(this.config.listen.path);
        }
        else if (this.config.listen.port) {
            if (typeof this.config.listen.port !== "number") {
                throw new ErrorF("Config property 'listen.port' must be a number");
            }
            if (this.config.listen.host) {
                this.sessionServer.listen(this.config.listen.port,this.config.listen.host);
            }
            else {
                this.sessionServer.listen(this.config.listen.port);
            }
        }
        else {
            throw new ErrorF("Cannot listen: no such configuration");
        }
    }

    _serve() {
        this.sessionServer = new net.Server();
        this._listen();

        this.sessionServer.on("connection",(sock) => {
            const handler = new SessionHandler(this,sock);

            this.sessionHandlers.set(handler.getId(),handler);
            handler.start();

            handler.on("done",(id) => {
                this.sessionHandlers.delete(id);
            });
        });

        this.sessionServer.on("error",(error) => {
            if (error.code == "EADDRINUSE") {
                if (!this.config.listen.path) {
                    throw new ErrorF("Cannot listen: address is already in use");
                }

                const sock = new net.Socket();
                sock.on("error",(innerError) => {
                    if (innerError.code == "ECONNREFUSED") {
                        fs.unlink(this.config.listen.path, (err) => {
                            if (err) {
                                throw new ErrorF(
                                    "Cannot listen on '%s': cannot recreate socket",
                                    this.config.listen.path
                                );
                            }

                            this._listen();
                        });
                    }
                });

                sock.connect({ path: this.config.listen.path }, () => {
                    sock.destroy();
                    throw new ErrorF("Cannot listen on '%s': socket in use");
                });
            }
            else {
                throw error;
            }
        });
    }
}

module.exports = {
    Kernel
};
