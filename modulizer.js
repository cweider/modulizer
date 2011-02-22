#!/usr/bin/node
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

var canonicalPath = function (rootPath, libraryPaths, path) {
  path = pathutil.resolve(path);

  // Is this path in a library?
  for (var i = 0, ii = libraryPaths.length; i < ii; i++) {
    var libraryPath = libraryPaths[i];
    if (path.slice(0, libraryPath.length) == libraryPath) {
      return path.slice(libraryPath.length);
    }
  }

  // Is this path in the root?
  if (path.slice(0, rootPath.length) == rootPath) {
    return '/' + path.slice(rootPath.length);
  }

  // Build path relative to root.
  var pathSplit = path.split('/');
  var rootSplit = rootPath.split('/');
  var pathPart;
  var rootPart;
  while ((pathPart = pathSplit.shift()) == (rootPart = rootSplit.shift())) {;}

  return '/' + pathutil.join((new Array(rootSplit.length+1)).join('../'), pathPart, pathSplit.join('/'));
}

var breakForError = function (message) {
  process.stderr.write(message + '\n');
  process.exit(1);
}

var arguments = process.argv.slice(2);
var argument;

var options = {};
options.rootPath = process.cwd();
options.libraryPaths = [];

while (argument = arguments.shift()) {
  if (argument.slice(0,2) != '--') {
    arguments.unshift(argument);
    break;
  } else if (argument == '--') {
    break;
  }

  switch (argument) {
    case '--library-path':
      arguments.length || breakForError("Path must be provided for --library-path");
      options.libraryPaths.unshift(arguments.shift());
      break;
    case '--root-path':
      arguments.length || breakForError("Path must be provided for --root-path");
      options.rootPath = arguments.shift();
      break;
    case '--import-libraries':
      options.importLibrary = true;
      break;
    case '--import-root':
      options.importRoot = true;
      break;
    case '--include-kernel':
      options.kernel = true;
      break;
    default:
      breakForError("Unknown option: " + argument);
  }
}

// Normalize paths
var pathify = function (path) {
  return pathutil.normalize(pathutil.resolve(path) + '/');
}
options.libraryPaths = options.libraryPaths.map(pathify);
options.rootPath = pathify(options.rootPath);

// Build list of files/directories to process
var importQueue = arguments.concat([]);
if (options.importLibrary) {
  options.libraryPaths.forEach(function (p) {importQueue.unshift(p)}, importQueue)
}
if (options.importRoot) {
  importQueue.unshift(options.rootPath);
}

// Process all files
var writeStream = process.stdout;
writeStream.on('error', function () {
  console.log("Could not write to output.");
  process.exit(1);
});

if (options.kernel) {
  writeStream.write(fs.readFileSync(pathutil.join(__dirname, 'kernel.js')));
}

var readAll = function (paths, onFile, onComplete, onError) {
  var _readAll = function () {
    var path = importQueue.shift();
    if (!path) {
      onComplete();
    } else {
      fs.stat(path, function (error, stats) {
        if (error) {
          onError("Error importing " + path);
        } else {
          if (stats.isDirectory()) {
            fs.readdir(path, function (error, files) {
              if (error) {
                onError("Could not read " + path);
              } else {
                files.forEach(function (file) {
                  importQueue.unshift(pathutil.join(path, file));
                });
                return _readAll();
              }
            });
          } else if (stats.isFile()) {
            if (pathutil.extname(path) == '.js') {
              fs.readFile(path, 'utf8', function (error, text) {
                if (error) {
                  onError("Could not read " + path);
                } else {
                  onFile(canonicalPath(options.rootPath, options.libraryPaths, path), text);
                  return _readAll()
                }
              });
            } else {
              // Skip non-js file.
              return _readAll()
            }
          } else {
            onError("Path is not a file or directory " + path);
          }
        }
      });
    }
  };
  _readAll();
};

writeStream.write('require.install({');
var initial = true;
readAll(importQueue, function (path, text) {
  var modularizedCode = 'function (require, exports, module) {\n' + text + '}';
  writeStream.write((initial ? !(initial = false) && "\n  " : ",\n  ") + JSON.stringify(path) + ": " +
    modularizedCode.replace(/\n([^\n])/g, "\n    $1")
    );
}, function () {
  writeStream.write('\n});\n');
}, breakForError);
