/**
 *
 */

class StorageSqlite extends Map {
    constructor(db_file) {
        super();
        this.db_file = db_file;
    }
}

module.exports = {
    StorageSqlite
};
