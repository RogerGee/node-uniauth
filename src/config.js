/**
 * config.js
 *
 * @module config
 */

const YAML = require("yaml")
const merge = require("deepmerge");

const CONFIG_TYPES = {
    logging: {
        level: Number
    },
    listen: {
        host: String,
        port: Number,
        path: String
    },
    record_store: {
        inmemory: Boolean,
        sqlite: String
    },
    cleanup: {
        interval: Number
    }
}

const CONFIG_DEFAULTS = {
    logging: {
        level: 1
    },
    listen: {
        host: null,
        port: 8000,
        path: null
    },
    record_store: {
        inmemory: false,
        sqlite: "/var/lib/node-uniauth/records.db"
    },
    cleanup: {
        interval: 3600
    }
};

const CONFIG_DEFAULTS_DEBUG = {
    logging: {
        level: 3
    },
    listen: {
        host: "127.0.0.1",
        port: 8002,
        path: null
    },
    record_store: {
        inmemory: true,
        sqlite: null
    },
    cleanup: {
        interval: 60
    }
};

function replaceEnvVars(value,type) {
    const regex = /([^\\]|^)\${(.*?)}/g;
    let result = value.replaceAll(regex,(match,leading,name) => {
        if (name in process.env) {
            return leading + process.env[name];
        }
        return leading;
    });

    if (type === Boolean) {
        result = (result == "yes" || result == "on" || !!parseInt(result));
    }
    else if (type == Number) {
        const asInt = parseInt(result);
        if (!isNaN(asInt)) {
            result = asInt;
        }
    }

    return result;
}

function evalProps(props,_typeInfo) {
    const result = {};
    let typeInfo;

    if (typeof _typeInfo === "undefined") {
        typeInfo = CONFIG_TYPES;
    }
    else {
        typeInfo = _typeInfo
    }

    for (const name in props) {
        const propType = typeInfo[name] || String;

        let value = props[name];
        if (value && typeof value === "object") {
            result[name] = evalProps(value,propType);
        }
        else if (typeof value === "string") {
            result[name] = replaceEnvVars(value,propType);
        }
        else {
            result[name] = value;
        }
    }

    return result;
}

class Configuration {
    constructor(yaml,debug) {
        let props;
        const parsed = YAML.parse(yaml);
        if (parsed !== null && typeof parsed === "object") {
            if (debug) {
                props = merge(CONFIG_DEFAULTS_DEBUG,parsed);
            }
            else {
                props = merge(CONFIG_DEFAULTS,parsed);
            }
        }
        else {
            props = debug ? CONFIG_DEFAULTS_DEBUG : CONFIG_DEFAULTS;
        }

        props = evalProps(props);
        Object.assign(this,props);
    }
}

module.exports = {
    Configuration
};
