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
    } else if (libraryPath.slice(0, -1) == path ) {
      return "";
    }
  }

  // Is this path in the root?
  if (path == rootPath || path.slice(0, rootPath.length) == rootPath) {
    return '/' + path.slice(rootPath.length);
  } else if (rootPath.slice(0, -1) == path ) {
    return "/";
  }

  // Build path relative to root.
  var pathSplit = path.split('/');
  var rootSplit = rootPath.split('/');
  var pathPart;
  var rootPart;
  while ((pathPart = pathSplit.shift()) == (rootPart = rootSplit.shift())) {;}

  return '/' + pathutil.join(
    (new Array(rootSplit.length+1)).join('../')
  , pathPart
  , pathSplit.join('/')
  );
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
      if (arguments.length == 0) {
        breakForError("Path must be provided for --library-path");
      }
      options.libraryPaths.unshift(arguments.shift());
      break;
    case '--root-path':
      if (arguments.length == 0) {
        breakForError("Path must be provided for --root-path");
      }
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
  options.libraryPaths.forEach(
      function (p) {importQueue.unshift(p)}, importQueue)
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

var find = function (paths, filter, callback) {
  var queue = paths.concat([]);
  var paths = [];

  var _find = function () {
    var path = queue.shift();
    if (path === undefined) {
      callback(undefined, paths);
    } else {
      fs.stat(path, function (error, stats) {
        if (error) {
          callback(new Error("Error importing " + path));
        } else {
          if (stats.isDirectory()) {
            fs.readdir(path, function (error, files) {
              if (error) {
                callback(new Error("Could not read " + path));
              } else {
                var args = files.map(function (file) {
                  return pathutil.join(path, file);
                });
                args.unshift(queue.length, 0);
                queue.splice.apply(queue, args);
                _find();
              }
            });
          } else if (stats.isFile()) {
            if (!filter || filter(path)) {
              paths.push(path);
            }
            _find();
          } else {
            callback(new Error("Path is not a file or directory " + path));
          }
        }
      });
    }
  }
  _find();
};

var readAll = function (paths, onFile, onComplete) {
  paths = paths.concat();
  var _readAll = function () {
    var path = paths.shift();
    if (!path) {
      onComplete();
    } else {
      fs.readFile(path, 'utf8', function (error, text) {
        onFile(path, error ? null : text);
        _readAll();
      });
    }
  };
  _readAll();
};

var writeFiles = function (paths) {
  var pathMap = {};
  paths.forEach(function (path) {
    var suffixes = ['', '.js', '/index.js'];
    for (var i = 0, ii = suffixes.length; i < ii; i++) {
      var suffix = suffixes[i];
      if (path.slice(path.length-suffix.length) == suffix) {
        var path_ = path.slice(0, path.length-suffix.length);
        pathMap[path_] =
          canonicalPath(options.rootPath, options.libraryPaths, path_);
      }
    }
  });

  var path_paths = [];
  for (var path in pathMap) {
    if (Object.prototype.hasOwnProperty.call(pathMap, path)) {
      path_paths.push([path, pathMap[path]]);
    }
  }
  path_paths = path_paths.sort(function (a, b) {
    if (a[1] > b[1]) {
      return 1;
    } else if (a[1] < b[1]) {
      return -1;
    } else {
      return 0;
    }
  });

  var paths = [];
  path_paths.forEach(function (path_path) {
    paths.push(path_path[0]);
  });

  writeStream.write('require.install({');
  var initial = true;
  readAll(paths, function (path, text) {
    if (text === null) {
      text = 'null';
    } else {
      text = 'function (require, exports, module) {\n' + text + '}';
    }

    writeStream.write((initial ? !(initial = false) && "\n  " : ",\n  ")
      + JSON.stringify(pathMap[path]) + ": "
      + text.replace(/\n([^\n])/g, "\n    $1")
      );
  }, function () {
    writeStream.write('\n});\n');
  }, breakForError);
};

find(importQueue,
  function (path) {
    if (pathutil.extname(path) == '.js') {
      return true;
    } else {
      return false;
    }
  }
, function (error, paths) {
    if (error) {
      breakForError(error.messsage);
    } else {
      writeFiles(paths);
    }
  }
);
