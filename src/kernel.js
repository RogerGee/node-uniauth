/**
 * kernel.js
 *
 * @module kernel
 */

const fs = require("fs");
const net = require("net");

const merge = require("deepmerge");

const { Configuration } = require("./config");
const { SessionHandler } = require("./session-handler");
const { StorageInMemory } = require("./storage/storage-in-memory");
const { StorageSqlite } = require("./storage/storage-sqlite");
const { Logger } = require("./logger");

const OPTION_DEFAULTS = {
    debug: false,
    configFile: "/etc/node-uniauth/config.yml",
};

const OPTION_DEFAULTS_DEBUG = {
    debug: true,
    configFile: "./local/config.yml"
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
        this.logger = new Logger(0);

        this.sessionServer = null;
        this.sessionStorage = null;
        this.sessionHandlers = new Map();

        this.timerCleanup = null;
    }

    start() {
        let yaml = "";
        const stream = fs.createReadStream(this.options.configFile);

        stream.on("data",(chunk) => {
            yaml += chunk;
        });

        stream.on("end",() => {
            this.config = new Configuration(yaml,this.options.debug);

            this.logger = new Logger(this.config.logging.level);
            this.logger.message("node-uniauth server started");
            this.logger.message("loaded configuration from file '%s'",this.options.configFile);

            this._setUp();

            this.timerCleanup = setInterval(
                this.cleanup.bind(this),
                Math.max(this.config.cleanup.interval * 1000,1000)
            );
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
        this.logger.message("stopping server: received %s",signal);

        this.sessionHandlers.forEach((handler) => {
            handler.stop();
        });

        if (this.sessionServer != null) {
            this.sessionServer.close(callback);
        }

        if (this.timerCleanup != null) {
            clearInterval(this.timerCleanup);
            this.timerCleanup = null;
        }
    }

    async getSession(key) {
        this.logger.debug("read session: key=%s",key);
        return this.sessionStorage.get(key);
    }

    async putSession(sess) {
        this.sessionStorage.set(sess.key,sess);
        this.logger.debug("write session: key=%s",sess.key);
    }

    async purgeSession(sess) {
        await this.sessionStorage.delete(sess);
        sess.purge();
        this.logger.debug("purge session: key=%s",sess.key);
    }

    async cleanup() {
        this.logger.debug("running cleanup task");

        const set = [];
        const del = [];

        await this.sessionStorage.each((sess,key) => {
            if (!sess.isActive()) {
                if (sess.record.expire <= 0) {
                    // Let a record with expire value of 0 last at least one
                    // cleanup cycle. Such records may be used by applicants
                    // waiting to register.
                    sess.record.expire = 1;
                    set.push(sess);
                }
                else {
                    del.push(sess);
                }
            }
        });

        for (const sess of set) {
            await this.putSession(sess);
        }

        for (const sess of del) {
            await this.purgeSession(sess);
            this.logger.debug("cleanup: session=%s",sess.key);
        }

        await this.sessionStorage.cleanup();
    }

    _setUp() {
        if (this.config.record_store.inmemory) {
            this.sessionStorage = new StorageInMemory();
        }
        else if (this.config.record_store.sqlite) {
            this.sessionStorage = new StorageSqlite(this.config.record_store.sqlite);
        }
        else {
            throw new ErrorF("Property 'record_store' does not resolve to valid configuration");
        }

        this.logger.debug("using storage backend '%s'",this.sessionStorage.constructor.name);

        this.sessionStorage.ready().then(() => {
            this._serve();
        });
    }

    _listen() {
        if (this.config.listen.path) {
            if (typeof this.config.listen.path !== "string") {
                throw new ErrorF("Config property 'listen.path' must be a string");
            }
            this.sessionServer.listen(this.config.listen.path);
            this.logger.message("listening on socket %s",this.config.listen.path);
        }
        else if (this.config.listen.port) {
            if (typeof this.config.listen.port !== "number") {
                throw new ErrorF("Config property 'listen.port' must be a number");
            }
            if (this.config.listen.host) {
                this.sessionServer.listen(this.config.listen.port,this.config.listen.host);
                this.logger.message("listening on %s:%d",this.config.listen.host,this.config.listen.port);
            }
            else {
                this.sessionServer.listen(this.config.listen.port);
                this.logger.message("listening on *:%d",this.config.listen.port);
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
            const addr = sock.address();
            const handler = new SessionHandler(this,sock);

            this.logger.client("connect: from=%s",addr.address);

            this.sessionHandlers.set(handler.getId(),handler);
            handler.start();

            handler.on("done",(id) => {
                this.logger.client("shutdown: from=%s",addr.address);
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
