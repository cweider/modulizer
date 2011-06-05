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
var asyncRequire = require('./async_require');

/* Convert a given system path to a path suitable for the module system. */
function systemToModulePath(rootPath, libraryPath, path) {
  path = pathutil.resolve(path);

  // Is this path in a library?
  var libraryPaths = libraryPath ? [libraryPath] : [];
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

/* Inverts `systemToModulePath`. */
function moduleToSystemPath(rootPath, libraryPath, path) {
  if (path.charAt(0) == '/') {
    return pathutil.normalize(pathutil.join(rootPath, path));
  } else {
    return pathutil.normalize(pathutil.join(libraryPath, path));
  }
}

/* This is basically `find(1)`. */
function find(paths, filter, callback) {
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
}

/* Read each of the paths in serial. */
function readEach(paths, onFile, complete) {
  var ii = paths.length
  var _readEach = function (i) {
    if (i < ii) {
      var path = paths[i];
      fs.readFile(path, function (error, text) {
        onFile(path, error ? null : text);
        _readEach(i+1);
      });
    } else {
      complete();
    }
  };
  _readEach(0);
}

/* The all paths that will be searched for when looking up `path`. */
function relatedPaths(path) {
  var paths = [];
  var suffixes = ['', '.js', '/index.js'];
  for (var i = 0, ii = suffixes.length; i < ii; i++) {
    var suffix = suffixes[i];
    if (path.slice(path.length-suffix.length) == suffix) {
      var path_ = path.slice(0, path.length-suffix.length);
      paths.push(path_);
    }
  }
  return paths;
}

/* Take system paths for modules and compile as `require.define()` code. */
function compile(rootPath, libraryPath, paths,
    globalKeyPath, writeStream, callback) {
  if (paths.length == 0) {
    callback(undefined, modulePaths);
  }

  var modulePaths = paths.sort();
  var sysPaths = modulePaths.map(function (path) {
    return moduleToSystemPath(rootPath, libraryPath, path);
  });

  // Read the files in order and write them to the stream.
  writeStream.write((globalKeyPath || 'require') + '.define({');
  var initial = true;
  readEach(sysPaths,
    function (path, text) {
      if (text === null) {
        text = 'null';
      } else {
        text = ('\n' + text).replace(/\n([^\n])/g, "\n    $1")
        text = 'function (require, exports, module) {' + text + '  }';
      }

      modulePath = systemToModulePath(rootPath, libraryPath, path);
      writeStream.write((initial ? !(initial = false) && "\n  " : "\n, ")
        + JSON.stringify(modulePath) + ": " + text
        );
    }
  , function () {
      writeStream.write('\n});\n');
      callback(undefined, modulePaths);
    }
  );
}

/* Retrieve the depencies of the specified files. */
function dependencies(rootPath, libraryPath, paths, callback) {
  var mockRequire = asyncRequire.requireForPaths(rootPath, libraryPath);

  mockRequire.emitter.addListener('idle', function () {
    var modules = mockRequire._modules;
    var paths = [];
    for (var path in modules) {
      if (Object.prototype.hasOwnProperty.call(modules, path)) {
        paths.push(path);
      }
    }
    callback(paths);
  });

  paths.forEach(function (path) {
    mockRequire(path, function () {});
  });
}

/* All items in operand1 which are not in operand2. */
function subtractSets(operand1, operand2) {
  var pathSet = {};
  operand1.forEach(function (path) {
    pathSet[path] = true;
  });
  operand2.forEach(function (path) {
    if (Object.prototype.hasOwnProperty.call(pathSet, path)) {
      delete pathSet[path];
    }
  });
  paths = [];
  for (var path in pathSet) {
    if (Object.prototype.hasOwnProperty.call(pathSet, path)) {
      paths.push(path);
    }
  }
  return paths;
}

function Modulizer(configuration) {
  this._configuration = {
    'rootPath': null
  , 'libraryPath': null
  , 'importLibrary': false
  , 'importRoot': false
  , 'importDependencies': false
  , 'import': []
  , 'exclude': []
  , 'globalKeyPath': undefined
  };
  for (var key in this._configuration) {
    if (configuration.hasOwnProperty(key)) {
      this._configuration[key] = configuration[key];
    }
  }
  configuration = this._configuration;

  // Normalize paths
  var pathify = function (path) {
    return path && pathutil.normalize(pathutil.resolve(path) + '/');
  }
  configuration.libraryPath = pathify(configuration.libraryPath);
  configuration.rootPath = pathify(configuration.rootPath);
  configuration.import = configuration.import || [];
}
Modulizer.prototype = new function () {
  this.compile = function (writeStream, complete) {
    var configuration = this._configuration;

    // Build list of files/directories to process
    var paths = [];
    if (configuration.importRoot && configuration.rootPath) {
      paths.push(configuration.rootPath);
    }
    if (configuration.importRoot && configuration.libraryPath) {
      paths.push(configuration.libraryPath);
    }
    paths = paths.concat(configuration.import);

    find(paths,
      function (path) {
        if (pathutil.extname(path) == '.js') {
          return true;
        } else {
          return false;
        }
      }
    , function (error, paths) {
        if (error) {
          // no-op
        } else {
          // Convert to module paths.
          paths = paths.map(function (path ) {
            return systemToModulePath(
                configuration.rootPath
              , configuration.libraryPath
              , path);
          });

          var compileEverything = function (paths) {
            paths = subtractSets(paths, configuration.exclude);

            compile(
              configuration.rootPath
            , configuration.libraryPath
            , paths
            , configuration.globalKeyPath
            , writeStream
            , function (error, paths) {
                complete && complete(error, paths);
              }
            );
          };

          if (configuration.importDependencies) {
            dependencies(configuration.rootPath, configuration.libraryPath,
              paths, compileEverything)
          } else {
            compileEverything(paths);
          }
        }
      }
    );
  }
}

exports.Modulizer = Modulizer;
