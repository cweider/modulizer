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

var Analyzer = require("./analyzer").Analyzer

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


function Modulizer(configuration) {
  this._configuration = {
    'rootPath': null
  , 'libraryPath': null
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
  this.systemToModulePaths = function (paths) {
    var configuration = this._configuration;
    return paths.map(function (path) {
      return systemToModulePath(
          configuration.rootPath
        , configuration.libraryPath
        , path);
    });
  };
  this.moduleToSystemPaths = function (paths) {
    var configuration = this._configuration;
    return paths.map(function (path) {
      return moduleToSystemPath(
          configuration.rootPath
        , configuration.libraryPath
        , path);
    });
  };
  this.dependencies = function (paths, callback) {
    var configuration = this._configuration;
    var analyzer = new Analyzer({
        rootPath: configuration.rootPath
      , libraryPath: configuration.libraryPath
      }
    );
    analyzer.getDependenciesOfPaths(paths, callback);
  }
  this.package = function (paths, writeStream, complete) {
    var configuration = this._configuration;

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
}

exports.Modulizer = Modulizer;
