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
    configFile: "/etc/node-uniauth/config.yaml",
};

const OPTION_DEFAULTS_DEBUG = {
    debug: true,
    configFile: "./local/config.yaml"
};

const CONFIG_DEFAULTS = {
    listenSocket: "/var/run/node-uniauth.sock",
    recordStore: "/var/lib/node-uniauth/records.db"
};

const CONFIG_DEFAULTS_DEBUG = {
    listenSocket: "./local/listen.sock",
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

    _serve() {
        this.sessionServer = new net.Server();
        this.sessionServer.listen(this.config.listenSocket);

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
                const sock = new net.Socket();
                sock.on("error",(innerError) => {
                    if (innerError.code == "ECONNREFUSED") {
                        fs.unlink(this.config.listenSocket, (err) => {
                            if (err) {
                                console.error(
                                    "Cannot listen on '"
                                        + this.config.listenSocket
                                        + "': cannot recreate socket"
                                );
                                process.exitCode = 1;
                                return;
                            }

                            this.sessionServer.listen(this.config.listenSocket);
                        });
                    }
                });

                sock.connect({ path: this.config.listenSocket }, () => {
                    console.error(
                        "Cannot listen on '"
                            + this.config.listenSocket
                            + "': socket in use"
                    );
                    process.exitCode = 1;

                    sock.destroy();
                });
            }
        });
    }
}

module.exports = {
    Kernel
};
