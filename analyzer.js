/*

  Copyright (C) 2011 Chad Weider

  This software is provided 'as-is', without any express or implied
  warranty.  In no event will the authors be held liable for any damages
  arising from the use of this software.

  Permission is granted to anyone to use this software for any purpose,
  including commercial applications, and to alter it and redistribute it
  freely, subject to the following restrictions:

  1. The origin of this software must not be misrepresented; you must not
     claim that you wrote the original software. If you use this software
     in a product, an acknowledgment in the product documentation would be
     appreciated but is not required.
  2. Altered source versions must be plainly marked as such, and must not be
     misrepresented as being the original software.
  3. This notice may not be removed or altered from any source distribution.

*/

var fs = require('fs');
var pathutil = require('path');
var EventEmitter = require("events").EventEmitter;

var requireForPaths = require('./mock_require').requireForPaths;

var DEPENDENCY_SCRIPT_PATH = pathutil.join(__dirname, 'dependencies.js');
var child_counter = 0;

function Analyzer(configuration) {
  this._rootPath = configuration.rootPath;
  this._libraryPath = configuration.libraryPath;
}
function AnalyzerPrototype () {
  this._console = console;
  this.getDependenciesOfPaths = function (paths, callback) {
    var outputPath =
        '/tmp/modulizer_dependencies_' + process.pid + '_' + (child_counter++);

    var command = process.execPath; 
    var args = [DEPENDENCY_SCRIPT_PATH];
    if (this._rootPath) {
      args.push('--root');
      args.push(this._rootPath);
    }
    if (this._libraryPath) {
      args.push('--library');
      args.push(this._libraryPath);
    }
    args.push('--output');
    args.push(outputPath);

    args.push.apply(args, paths);

    child = require('child_process').spawn(command, args, {cwd: process.cwd});
    var console = this._console;
    child.stderr.on('data', function (data) {console && console.error(data)});
    child.on('exit', function (code, signal) {
      fs.readFile(outputPath, 'utf8', function (error, data) {
        callback((data || path).split('\n'));
      });
    });
  };
  
}
AnalyzerPrototype.prototype = new EventEmitter();
Analyzer.prototype = new AnalyzerPrototype();

exports.Analyzer = Analyzer;
