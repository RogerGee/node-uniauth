// main.js

const { Command } = require("commander");

require("./globals");

const VERSION = require("../package.json").version;
const { Kernel } = require("./kernel");

function execute(argv) {
    const program = new Command();

    program.version(VERSION);
    program.option("-d, --debug","run in debug mode");
    program.option("-f, --config-file","path to config file");
    program.parse(argv);

    const options = program.opts();
    const kernel = new Kernel(options);

    const stopfn = kernel.stop.bind(kernel);
    process.on('SIGINT',stopfn);
    process.on('SIGTERM',stopfn);

    kernel.start();
}

module.exports = {
    execute,
    Kernel
};
