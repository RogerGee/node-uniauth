#!/usr/bin/env node
/**
 * main.js
 *
 * node-uniauth
 */

const path = require("path");

const { execute } = require("./src/main");

execute(path.basename(process.argv[1]),process.argv);
