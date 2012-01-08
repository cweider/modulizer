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

var args = process.argv.slice(2);

// Get configuration
var configuration = {};
for (var i = 0, ii = args.length; i < ii; i++) {
  var arg = args[i]
  if (arg.slice(0,2) != '--') {
    break;
  } else if (arg == '--') {
    i++
    break;
  } else {
    if ((args[i+1] || '--').slice(0,2) != '--') {
      configuration[arg.slice(2)] = args[i+1];
      i++
    } else {
      configuration[arg.slice(2)] = undefined;
    }
  }
}


// Setup MockRequire to snoop on dependencies.
var rootPath = configuration.root;
var libraryPath = configuration.library;
var outputPath = configuration.output;

var outputStream = fs.createWriteStream(outputPath, {flags: 'w', encoding: 'utf8'});
function onDependencyAdded(path, definition) {
  outputStream.write(path + '\n');
}

var addedDependencies = {};
function updateDependencies() {
  var modules = mockRequire._definitions;
  for (var path in modules) {
    if (Object.prototype.hasOwnProperty.call(modules, path)) {
      if (!Object.prototype.hasOwnProperty.call(addedDependencies, path)) {
        addedDependencies[path] = modules[path];
        onDependencyAdded(path, modules[path])
      }
    }
  }
}

function finishDependencies() {
  if (outputStream) {
    outputStream.end();
    outputStream.destroySoon();
    outputStream = undefined;
  }
}

var requireForPaths = require('./mock_require').requireForPaths;
var mockRequire = requireForPaths(rootPath, libraryPath);
mockRequire.emitter.addListener('responded', function () {
  updateDependencies();
});
mockRequire.emitter.addListener('idle', function () {
  updateDependencies();
  // This, apparently, doesn't block process exit so skip.
  //finishDependencies();
});

// All remaining arguments are module paths, import all of these.
if (i < ii) {
  for (; i < ii; i++) {
    var arg = args[i];
    var path = arg;
    mockRequire(path, function () {});
  }
} else if (args[i-1] == '--') {
  buffer = '';
  process.stdin.setEncoding('utf8');
  var checkForImports = function () {
    var split = buffer.indexOf('\n');
    if (split > -1) {
      path = buffer.slice(0, split);
      buffer = buffer.slice(split + 1);
      if (path.length > 0) {
        mockRequire(path, function () {});
      }
    }
  };
  process.stdin.on('data', function (data) {
    buffer += data;
    checkForImports();
  });
  process.stdin.on('end', function () {
    buffer += '\n';
    checkForImports();
  });
  process.stdin.resume();
}
