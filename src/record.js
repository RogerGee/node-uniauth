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
    constructor() {
        // Create property for record reference, which is handled by the
        // storage handler.
        this.ref = null;

        // Initialize uniauth fields.
        this.purge();
    }

    /**
     * Determines if the record is active (i.e. has a user assignment and is not
     * passed its expiration).
     *
     * @return {boolean}
     */
    isActive() {
        if (this.uid >= 1) {
            const ts = Date.now() / 1000;

            if (ts < this.expire) {
                return true;
            }
        }

        return false;
    }

    purge() {
        this.uid = -1;
        this.user = null;
        this.display = null;
        this.expire = 0;
        this.lifetime = 0;
    }

    /**
     * Gets the protocol representation of the record.
     *
     * @return {string}
     */
    toProtocol() {
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
        intbuf.writeBigInt64LE(this.expire);
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
        this.record = new Record();
        this.redirect = null;
        this.tag = null;
    }

    /**
     * Determines if the session is active.
     *
     * @return {true}
     */
    isActive() {
        return this.record.isActive();
    }

    /**
     * Executes manager-side logic on the session and its associated record.
     */
    check() {
        // Purge the record if is inactive but still has a user ID.
        if (!this.record.isActive() && this.record.uid >= 1) {
            this.record.purge();
        }
    }

    purge() {
        this.redirect = null;
        this.tag = null;
        this.record.purge();
    }

    transfer(sess) {
        this.record = sess.record;
    }

    commit(fields) {
        for (const key in fields) {
            if (key == "redirect") {
                this.redirect = fields.redirect;
            }
            else if (key == "tag") {
                this.tag = fields.tag;
            }
            else {
                this.record[key] = fields[key];
            }
        }
    }

    /**
     * Gets the protocol representation of the session.
     *
     * @return {string}
     */
    toProtocol() {
        let buf = "";

        buf += FIELD_KEY;
        buf += this.key;
        buf += END_OF_STR;

        if (this.isActive()) {
            buf += this.record.toProtocol();
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

        return buf;
    }
}

module.exports = {
    Record,
    Session
};
