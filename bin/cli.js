#!/usr/bin/env node

const DEFAULT_PORT = 9080;
const DEFAULT_INDEX = 'index.html';
const DEFAULT_FOLLOW_SYMLINKS = false;
const DEFAULT_DEBUG = false;
const DEFAULT_ERROR_404 = undefined;
const DEFAULT_CORS = undefined;


var path    = require("path");
var program = require('commander');
var chalk   = require('chalk');

var pkg     = require(path.join(__dirname, '..', 'package.json'));

var SlaxServer = require('../server.js');
var server;

var templates = {};

initTerminateHandlers();

program
  .version(pkg.name + '@' + pkg.version)
  .usage('[options]')
  .option('-r, --root <n>', 'the root dicrectory to run')
  .option('-a, --slax <n>', 'the skylark slax application file name to run')
  .option('-p, --port <n>', 'the port to listen to for incoming HTTP connections', DEFAULT_PORT)
  .option('-d, --debug', 'enable to show error messages', DEFAULT_DEBUG)
  .option('-c, --cors <pattern>', 'Cross Origin Pattern. Use "*" to allow all origins', DEFAULT_CORS)
  .parse(process.argv);
;

// overrides
program.rootPath = program.args[0] || process.cwd();
program.name = pkg.name;

server = new SlaxServer(program);

server.start(function () {
  console.log(chalk.blue('*'), 'slax server successfully started.');
  console.log(chalk.blue('*'), 'Serving files at:', chalk.cyan('http://localhost:' + program.port));
  console.log(chalk.blue('*'), 'Press', chalk.yellow.bold('Ctrl+C'), 'to shutdown.');

  return server;
});




/**
Prepare the 'exit' handler for the program termination
*/
function initTerminateHandlers() {
  var readLine;

  if (process.platform === "win32"){
    readLine = require("readline");

    readLine.createInterface ({
      input: process.stdin,
      output: process.stdout
    }).on("SIGINT", function () {
      process.emit("SIGINT");
    });
  }

  // handle INTERRUPT (CTRL+C) and TERM/KILL signals
  process.on('exit', function () {
    if (server) {
      console.log(chalk.blue('*'), 'Shutting down server');
      server.stop();
    }
    console.log();  // extra blank line
  });
  process.on('SIGINT', function () {
    console.log(chalk.blue.bold('!'), chalk.yellow.bold('SIGINT'), 'detected');
    process.exit();
  });
  process.on('SIGTERM', function () {
    console.log(chalk.blue.bold('!'), chalk.yellow.bold('SIGTERM'), 'detected');
    process.exit(0);
  });
}

