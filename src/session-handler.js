/**
 * session-handler.js
 *
 * @module session-handler
 */

const EventEmitter = require("events");
const { v4: uuid } = require("uuid");

const { MessageParser } = require("./message-parser");

const RESPONSE_MESSAGE = "\u0000";
const RESPONSE_ERROR = "\u0001";
const RESPONSE_RECORD = "\u0002";

class SessionHandler extends EventEmitter {
    constructor(kernel,sock) {
        super();
        this.id = uuid();
        this.kernel = kernel;
        this.sock = sock;
        this.parser = new MessageParser(sock);
        this.unsent = null;
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
        if (message.op == "lookup") {
            this.handleLookup(message);
        }
        else if (message.op == "commit") {
            this.handleCommit(message)
        }
        else if (message.op == "create") {
            this.handleCreate(message);
        }
        else if (message.op == "transfer") {
            this.handleTransfer(message);
        }
    }

    handleLookup(message) {
        const sess = this.kernel.sessionStorage.get(message.fields.key);
        if (!sess) {
            this.sendError("no such record");
            return;
        }

        // TODO: Check record lifetime

        this.sendRecord(session);
    }

    sendError(message) {
        let buf = "";

        buf += RESPONSE_ERROR;
        buf += message;
        buf += "\u0000";

        this.writeOut(buf);
    }

    sendRecord(session) {
        let buf = "";

        buf += RESPONSE_RECORD;
        buf += session.toBuf();

        this.writeOut(buf);
    }

    writeOut(buf) {
        if (typeof this.unsent === "string") {
            this.unsent += buf;
            return;
        }

        const result = this.sock.write(buf);

        if (!result) {
            this.unsent = "";
            this.sock.once("drain", () => {
                this.writeOut(this.unsent);
                this.unsent = null;
            });
        }
    }
}

module.exports = {
    SessionHandler
};
