/**
 * session-handler.js
 *
 * @module session-handler
 */

const EventEmitter = require("events");
const { v4: uuid } = require("uuid");

const { MessageParser } = require("./message-parser");

class SessionHandler extends EventEmitter {
    constructor(kernel,sock) {
        super();
        this.id = uuid();
        this.kernel = kernel;
        this.sock = sock;
        this.parser = new MessageParser(sock);
    }

    getId() {
        return this.id;
    }

    start() {
        const handlefn = this.handle.bind(this);
        this.parser.on("message",handlefn);
        this.parser.on("error",(message,partial) => {
            this.sock.destroy();
            this.emit("done",this.id);
        });
    }

    stop() {
        this.sock.on("close",() => {
            this.emit("done",this.id);
        });
        this.sock.end();
    }

    handle(message) {

    }
}

module.exports = {
    SessionHandler
};
