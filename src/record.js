/**
 * record.js
 *
 * @module record
 */

const FIELD_KEY = Buffer.from(Uint8Array.from([0x00]));
const FIELD_UID = Buffer.from(Uint8Array.from([0x01]));
const FIELD_USER = Buffer.from(Uint8Array.from([0x02]));
const FIELD_DISPLAY = Buffer.from(Uint8Array.from([0x03]));
const FIELD_EXPIRE = Buffer.from(Uint8Array.from([0x04]));
const FIELD_REDIRECT = Buffer.from(Uint8Array.from([0x05]));
const FIELD_SRC = Buffer.from(Uint8Array.from([0x06])); // never sent in server response
const FIELD_DST = Buffer.from(Uint8Array.from([0x07])); // never sent in server response
const FIELD_TAG = Buffer.from(Uint8Array.from([0x08]));
const FIELD_LIFETIME = Buffer.from(Uint8Array.from([0x09]));

const FIELD_END = Buffer.from(Uint8Array.from([0xff]));
const END_OF_STR = Buffer.from(Uint8Array.from([0x00]));

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
     * @return {Buffer}
     */
    toProtocol() {
        let buf;
        const intbuf = Buffer.alloc(8);

        buf = FIELD_UID;
        intbuf.writeInt32LE(this.uid);
        buf = Buffer.concat([buf,intbuf.subarray(0,4)]);

        buf = Buffer.concat([buf,FIELD_USER]);
        buf = Buffer.concat([buf,Buffer.from(this.user)]);
        buf = Buffer.concat([buf,END_OF_STR]);

        buf = Buffer.concat([buf,FIELD_DISPLAY]);
        buf = Buffer.concat([buf,Buffer.from(this.display)]);
        buf = Buffer.concat([buf,END_OF_STR]);

        buf = Buffer.concat([buf,FIELD_EXPIRE]);
        intbuf.writeBigInt64LE(this.expire);
        buf = Buffer.concat([buf,intbuf.subarray(0,8)]);

        buf = Buffer.concat([buf,FIELD_LIFETIME]);
        intbuf.writeInt32LE(this.lifetime);
        buf = Buffer.concat([buf,intbuf.subarray(0,4)]);

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
     * @return {Buffer}
     */
    toProtocol() {
        let buf;

        buf = FIELD_KEY;
        buf = Buffer.concat([buf,Buffer.from(this.key)]);
        buf = Buffer.concat([buf,END_OF_STR]);

        if (this.isActive()) {
            buf = Buffer.concat([buf,this.record.toProtocol()]);
        }

        if (this.redirect) {
            buf = Buffer.concat([buf,FIELD_REDIRECT]);
            buf = Buffer.concat([buf,Buffer.from(this.redirect)]);
            buf = Buffer.concat([buf,END_OF_STR]);
        }

        if (this.tag) {
            buf = Buffer.concat([buf,FIELD_TAG]);
            buf = Buffer.concat([buf,Buffer.from(this.tag)]);
            buf = Buffer.concat([buf,END_OF_STR]);
        }

        buf = Buffer.concat([buf,FIELD_END]);

        return buf;
    }
}

module.exports = {
    Record,
    Session
};
