/**
 * storage-in-memory.js
 *
 * @module storage/storage-in-memory
 */

class StorageInMemory {
    constructor() {
        this.store = new Map();
    }

    ready() {
        return Promise.resolve();
    }

    async get(key) {
        return this.store.get(key);
    }

    async set(key,value) {
        this.store.set(key,value);
    }

    async delete(key) {
        this.store.delete(key);
    }

    each(callback) {
        this.store.forEach(callback);
    }
}

module.exports = {
    StorageInMemory
};
