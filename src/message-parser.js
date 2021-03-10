/**
 * message-parser.js
 *
 * @module message-parser
 */

const EventEmitter = require("events");

const OP_MAP = {
    "0": "lookup",
    "1": "commit",
    "2": "create",
    "3": "transfer"
};

const FIELD_MAP = {
    "0": ["key",read_string],
    "1": ["uid",read_integer],
    "2": ["user",read_string],
    "3": ["display",read_string],
    "4": ["expire",read_time],
    "5": ["redirect",read_string],
    "6": ["src",read_string],
    "7": ["dst",read_string],
    "8": ["tag",read_string],
    "9": ["lifetime",read_integer]
};

const FIELD_END = 0xff;

const STATE_INITIAL = 0;
const STATE_FIELD = 1;

function read_string(buffer,start) {
    let end = buffer.indexOf(0,start);
    if (end < 0) {
        return false;
    }

    return {
        value: buffer.utf8Slice(start,end),
        offset: end + 1
    };
}

function read_integer(buffer,start) {
    try {
        return {
            value: buffer.readInt32LE(start),
            offset: start+4
        };
    } catch (err) {
        return false;
    }
}

function read_time(buffer,start) {
    try {
        return {
            value: buffer.readBigInt64LE(start),
            offset: start+8
        };
    } catch (err) {
        return false;
    }
}

class MessageParser extends EventEmitter {
    constructor(sock) {
        super();

        const datafn = this.ondata.bind(this);
        sock.on("data",datafn);

        const errfn = this.onerror.bind(this);
        sock.on("error",errfn);

        this.reset();
        this.messages = [];
    }

    ondata(chunk) {
        const buf = Buffer.alloc(this.buffer.length + chunk.length);

        this.buffer.copy(buf);
        chunk.copy(buf,this.buffer.length);

        this.buffer = buf;

        while (true) {
            if (!this.processBuffer()) {
                break;
            }
        }

        while (this.messages.length > 0) {
            this.emit("message",this.messages.pop());
        }
    }

    onerror(err) {
        this.emit("error","Communication error",this.current);
        this.reset();
    }

    processBuffer() {
        if (this.state == STATE_INITIAL) {
            if (this.iterator >= this.buffer.length) {
                return false;
            }

            const op = this.buffer[this.iterator].toString();

            if (!(op in OP_MAP)) {
                this.emit("error","Bad message operator",this.current);
                this.reset();
                return false;
            }

            this.current.op = OP_MAP[op];
            this.state = STATE_FIELD;
            this.iterator += 1;
        }

        while (this.state == STATE_FIELD) {
            if (this.iterator >= this.buffer.length) {
                break;
            }

            const fld = this.buffer[this.iterator];

            if (fld == FIELD_END) {
                this.iterator += 1;
                this.messages.unshift(this.current);
                this.reset(true);
                return true;
            }

            const sfld = fld.toString();
            if (!(sfld in FIELD_MAP)) {
                this.emit("error","Bad field",this.current);
                this.reset();
                break;
            }

            const [ fldKey, fn ] = FIELD_MAP[sfld];
            const result = fn(this.buffer,this.iterator+1);

            if (!result) {
                break;
            }

            this.current.fields[fldKey] = result.value;
            this.iterator = result.offset;
        }

        return false;
    }

    reset(advance) {
        this.state = STATE_INITIAL;

        if (advance) {
            this.buffer = this.buffer.slice(this.iterator);
        }
        else {
            this.buffer = Buffer.alloc(0);
        }
        this.iterator = 0;

        this.current = {
            op: null,
            fields: {}
        };
    }
}

module.exports = {
    MessageParser
};
