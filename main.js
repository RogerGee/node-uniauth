/**
 * main.js
 *
 * node-uniauth
 */

const { Command } = require("commander");

const { Kernel } = require("./src/kernel");

const program = new Command();

program.version("1.0.0-dev");
program.option("-d, --debug","run in debug mode");
program.option("-f, --config-file","path to config file");
program.parse(process.argv);

const options = program.opts();
const kernel = new Kernel(options);

const stopfn = kernel.stop.bind(kernel);
process.on('SIGINT',stopfn);
process.on('SIGTERM',stopfn);

kernel.start();
