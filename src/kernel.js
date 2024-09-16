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
    }

    stop(signal,callback) {
        this.sessionHandlers.forEach((handler) => {
            handler.stop();
        });
        this.sessionServer.close(callback);
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
                throw new Error("listen.path must be a string");
            }
            this.sessionServer.listen(this.config.listen.path);
        }
        else if (this.config.listen.port) {
            if (typeof this.config.listen.port !== "number") {
                throw new Error("listen.port must be a number");
            }
            if (this.config.listen.host) {
                this.sessionServer.listen(this.config.listen.port,this.config.listen.host);
            }
            else {
                this.sessionServer.listen(this.config.listen.port);
            }
        }
        else {
            throw new Error("cannot listen: no such configuration");
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
                    throw new Error("cannot listen: address is already in use");
                }

                const sock = new net.Socket();
                sock.on("error",(innerError) => {
                    if (innerError.code == "ECONNREFUSED") {
                        fs.unlink(this.config.listen.path, (err) => {
                            if (err) {
                                console.error(
                                    "Cannot listen on '"
                                        + this.config.listen.path
                                        + "': cannot recreate socket"
                                );
                                process.exitCode = 1;
                                return;
                            }

                            this._listen();
                        });
                    }
                });

                sock.connect({ path: this.config.listen.path }, () => {
                    console.error(
                        "Cannot listen on '"
                            + this.config.listen.path
                            + "': socket in use"
                    );
                    process.exitCode = 1;

                    sock.destroy();
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
