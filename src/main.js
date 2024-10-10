// main.js

const { Command } = require("commander");

require("./globals");

const VERSION = require("../package.json").version;
const { Kernel } = require("./kernel");

function execute(programName,argv) {
    const program = new Command();

    program.version(VERSION);
    program.option("-d, --debug","run in debug mode");
    program.option("-f, --config-file <config-file>","path to config file");
    program.parse(argv);

    const options = program.opts();
    const kernel = new Kernel(options);

    const stopfn = kernel.stop.bind(kernel);
    process.on("SIGINT",stopfn);
    process.on("SIGTERM",stopfn);

    process.on("uncaughtException",(err,origin) => {
        stopfn();

        if (err instanceof ErrorF) {
            console.error("%s: %s",programName,err.message);
        }
        else {
            console.error(err);
        }

        process.exitCode = 1;
    });

    kernel.start();
}

module.exports = {
    execute,
    Kernel
};
