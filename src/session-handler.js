/**
 * session-handler.js
 *
 * @module session-handler
 */

const EventEmitter = require("events");
const { v4: uuid } = require("uuid");

const { Session } = require("./record");
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
        this.sock.on("close",() => {
            this.emit("done",this.id);
            this.parser = null;
        });

        this.parser.on("message",handlefn);
        this.parser.on("error",(message,partial) => {
            this.sock.destroy();
        });
    }

    stop() {
        // We have to destroy the socket as opposed to close it. This is because
        // the uniauth protocol does not officially negotiate end of
        // transmission, and a client is not expected to respond to shutdown
        // anytime soon.
        this.sock.destroy();
    }

    handle(message) {
        if (message.op == "lookup") {
            this.handleLookup(message);
        }
        else if (message.op == "commit") {
            this.handleCommit(message);
        }
        else if (message.op == "create") {
            this.handleCreate(message);
        }
        else if (message.op == "transfer") {
            this.handleTransfer(message);
        }
    }

    async handleLookup(message) {
        if (!message.fields.key) {
            this.sendError("protocol error");
            return;
        }

        const sess = await this.kernel.getSession(message.fields.key);
        if (!sess) {
            this.sendError("no such record");
            return;
        }

        sess.check();
        this.sendRecord(sess);
    }

    async handleCommit(message) {
        if (!message.fields.key) {
            this.sendError("protocol error");
            return;
        }

        const sess = await this.kernel.getSession(message.fields.key);
        if (!sess) {
            this.sendError("no such record");
            return;
        }

        sess.commit(message.fields);
        this.sendMessage("changes committed");
    }

    async handleCreate(message) {
        if (!message.fields.key) {
            this.sendError("protocol error");
            return;
        }

        let sess = await this.kernel.getSession(message.fields.key);
        if (sess && sess.isActive()) {
            this.sendError("record already exists");
            return;
        }

        if (sess) {
            sess.purge();
        }
        else {
            sess = new Session(message.fields.key);
        }

        sess.commit(message.fields);
        await this.kernel.putSession(sess);
        this.sendMessage("record created");
    }

    async handleTransfer(message) {
        if (!message.fields.src) {
            this.sendError("protocol error: missing 'src'");
            return;
        }
        if (!message.fields.dst) {
            this.sendError("protocol error: missing 'dst");
            return;
        }

        const src = await this.kernel.getSession(message.fields.src);
        if (!src) {
            this.sendError("no such source record to transfer");
            return;
        }

        const dst = await this.kernel.getSession(message.fields.dst);
        if (!dst) {
            this.sendError("no such destination record for transfer");
            return;
        }

        // If the sessions are not the same, make sure the destination session
        // refers to the same record as the source.
        if (src.key != dst.key) {
            dst.record = src.record;
            await this.kernel.putSession(dst);
        }

        this.sendMessage("transfer completed");
    }

    sendMessage(message) {
        let buf = "";

        buf += RESPONSE_MESSAGE;
        buf += message;
        buf += "\u0000";

        this.writeOut(buf);
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
        buf += session.toProtocol();

        this.writeOut(buf);
    }

    writeOut(buf) {
        const test = Buffer.alloc(buf.length);
        test.write(buf,0,test.length,"binary");

        if (typeof this.unsent === "string") {
            this.unsent += buf;
            return;
        }

        const result = this.sock.write(buf,"binary");

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
