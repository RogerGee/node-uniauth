/**
 * record.js
 *
 * @module record
 */

const FIELD_KEY = "\u0000";
const FIELD_UID = "\u0001";
const FIELD_USER = "\u0002";
const FIELD_DISPLAY = "\u0003";
const FIELD_EXPIRE = "\u0004";
const FIELD_REDIRECT = "\u0005";
const FIELD_SRC = "\u0006";
const FIELD_DST = "\u0007";
const FIELD_TAG = "\u0008";
const FIELD_LIFETIME = "\u0009";

const FIELD_END = "\u00ff";
const END_OF_STR = "\u0000";

/**
 * Represents a uniauth user record.
 */
class Record {
    constructor(uid,user,display,lifetime) {
        this.uid = uid;
        this.user = user;
        this.display = display;
        this.expire = Math.floor((lifetime * 1000 + Date.now()) / 1000);
        this.lifetime = lifetime;
    }

    toBuf() {
        let buf = "";
        const intbuf = Buffer.alloc(8);

        buf += FIELD_UID;
        intbuf.writeInt32LE(this.uid);
        buf += intbuf.asciiSlice(0,4);

        buf += FIELD_USER;
        buf += this.user;
        buf += END_OF_STR;

        buf += FIELD_DISPLAY;
        buf += this.display;
        buf += END_OF_STR;

        buf += FIELD_EXPIRE;
        intbuf.writeInt64LE(this.expire);
        buf += intbuf.asciiSlice(0,8);

        buf += FIELD_LIFETIME;
        intbuf.writeInt32LE(this.lifetime);
        buf += intbuf.asciiSlice(0,4);

        return buf;
    }
}

/**
 * Represents a uniauth session record.
 */
class Session {
    constructor(key) {
        this.key = key;
        this.record = null;
        this.redirect = null;
        this.tag = null;
    }

    assign(record) {

    }

    toBuf() {
        let buf = "";

        buf += FIELD_KEY;
        buf += this.key;
        buf += END_OF_STR;

        if (this.record) {
            buf += this.record.toBuf();
        }

        if (this.redirect) {
            buf += FIELD_REDIRECT;
            buf += this.redirect;
            buf += END_OF_STR;
        }

        if (this.tag) {
            buf += FIELD_TAG;
            buf += this.tag;
            buf += END_OF_STR;
        }

        buf += FIELD_END;
    }
}

module.exports = {
    Record,
    Session
};
