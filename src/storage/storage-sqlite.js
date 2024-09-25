/**
 * storage-sqlite.js
 *
 * @module storage/storage-sqlite
 */

const sqlite3 = require("sqlite3");

const { Session } = require("../record");

class StorageSqlite {
    constructor(dbFileName) {
        this.store = new Map();
        this.db = new sqlite3.Database(dbFileName);
        this.dbFileName = dbFileName;
        this.stmt = {};
    }

    async ready() {
        const promises = [];

        promises.push(new Promise((resolve,reject) => {
            const query =
                `SELECT
                   key,
                   uid,
                   user,
                   display,
                   expire,
                   redirect,
                   tag,
                   lifetime,
                   record.id AS recordId
                 FROM
                   session
                   LEFT JOIN record
                     ON record.id = session.record_id
                 WHERE
                   key = $key`;

            this.stmt.get = this.db.prepare(query,(err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        }));

        promises.push(new Promise((resolve,reject) => {
            const query =
                `SELECT
                   key,
                   uid,
                   user,
                   display,
                   expire,
                   redirect,
                   tag,
                   lifetime,
                   record.id AS recordId
                 FROM
                   session
                   LEFT JOIN record
                     ON record.id = session.record_id`;

            this.stmt.getAll = this.db.prepare(query,(err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        }));

        promises.push(new Promise((resolve,reject) => {
            const query =
                `INSERT INTO
                   session (
                     key,
                     redirect,
                     tag,
                     record_id
                   )
                 VALUES (
                   $key,
                   $redirect,
                   $tag,
                   $recordId
                 )
                 ON CONFLICT (key) DO UPDATE SET
                   redirect = $redirect,
                   tag = $tag,
                   record_id = $recordId`;

            this.stmt.setSession = this.db.prepare(query,(err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        }));

        promises.push(new Promise((resolve,reject) => {
            const query =
                `INSERT INTO
                   record (
                     uid,
                     user,
                     display,
                     expire,
                     lifetime
                   )
                 VALUES (
                   $uid,
                   $user,
                   $display,
                   $expire,
                   $lifetime
                 )
                 RETURNING
                   id`;

            this.stmt.createRecord = this.db.prepare(query,(err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        }));

        promises.push(new Promise((resolve,reject) => {
            const query =
                `INSERT INTO
                   record (
                     id,
                     uid,
                     user,
                     display,
                     expire,
                     lifetime
                   )
                 VALUES (
                   $id,
                   $uid,
                   $user,
                   $display,
                   $expire,
                   $lifetime
                 )
                 ON CONFLICT (id) DO UPDATE SET
                   uid = $uid,
                   user = $user,
                   display = $display,
                   expire = $expire,
                   lifetime = $lifetime
                 RETURNING
                   id`;

            this.stmt.setRecord = this.db.prepare(query,(err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        }));

        promises.push(new Promise((resolve,reject) => {
            const query = `DELETE FROM session WHERE key = $key`;

            this.stmt.delete = this.db.prepare(query,(err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        }));

        promises.push(new Promise((resolve,reject) => {
            const query =
                `DELETE FROM record
                 WHERE id IN (
                   SELECT
                     record.id
                   FROM
                     record
                     LEFT JOIN session
                       ON session.record_id = record.id
                   GROUP BY
                     record.id
                   HAVING
                     COUNT(session.key) = 0
                 )`;

            this.stmt.deleteOrphans = this.db.prepare(query,(err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        }));

        return Promise.all(promises);
    }

    async get(key) {
        const params = {
            $key: key
        };

        return new Promise((resolve,reject) => {
            this.stmt.get.get(params,(err,row) => {
                if (err) {
                    reject(err);
                }
                else if (row) {
                    const sess = this._sessionFromRow(row);
                    resolve(sess);
                }
                else {
                    resolve(undefined);
                }
            });
        });
    }

    async set(key,session) {
        return new Promise((resolve,reject) => {
            const nextfn = (err,recordInfo) => {
                if (err) {
                    reject(err);
                    return;
                }

                const sessionParams = {
                    $key: key,
                    $redirect: session.redirect,
                    $tag: session.tag,
                    $recordId: null
                };

                // Assign record reference and create link between session and
                // record.
                if (recordInfo) {
                    session.record.ref = recordInfo.id;
                    sessionParams.$recordId = recordInfo.id;
                }

                // Update/create session record.
                this.stmt.setSession.run(sessionParams,(err) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve();
                    }
                });
            };

            // Update 'record' record. Create a new one if the record has no
            // existing reference.
            if (session.record.ref) {
                const recordParams = {
                    $id: session.record.ref,
                    $uid: session.record.uid,
                    $user: session.record.user,
                    $display: session.record.display,
                    $expire: session.record.expire.toString(), // convert bigint
                    $lifetime: session.record.lifetime
                };

                this.stmt.setRecord.get(recordParams,nextfn);
            }
            else {
                const recordParams = {
                    $uid: session.record.uid,
                    $user: session.record.user,
                    $display: session.record.display,
                    $expire: session.record.expire.toString(), // convert bigint
                    $lifetime: session.record.lifetime
                };

                this.stmt.createRecord.get(recordParams,nextfn);
            }
        });
    }

    async delete(sess) {
        const params = {
            $key: sess.key
        };

        return new Promise((resolve,reject) => {
            this.stmt.delete.run(params,(err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }

    async each(callback) {
        return new Promise((resolve,reject) => {
            this.stmt.getAll.each((err,row) => {
                if (!err && row) {
                    const sess = this._sessionFromRow(row);
                    callback(sess,sess.key);
                }
            },(err,count) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(count);
                }
            });
        });
    }

    async cleanup() {
        // Delete any records orphaned by delete operations.
        return new Promise((resolve,reject) => {
            this.stmt.deleteOrphans.run((err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }

    _sessionFromRow(row) {
        const sess = new Session(row.key);
        sess.redirect = row.redirect;
        sess.tag = row.tag;
        sess.record.uid = row.uid;
        sess.record.user = row.user;
        sess.record.display = row.display;
        if (row.expire) {
            sess.record.expire = BigInt(row.expire);
        }
        else {
            sess.record.expire = 0;
        }
        sess.record.lifetime = row.lifetime;

        // Assign reference so we can identify the record in storage.
        if (row.recordId) {
            sess.record.ref = row.recordId;
        }

        return sess;
    }
}

module.exports = {
    StorageSqlite
};
