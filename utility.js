/*!

  Copyright (c) 2011 Chad Weider

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.

*/

var fs = require('fs');
var pathutil = require('path');

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
          if (error.code == 'ENOENT') {
            paths.push(path); // Allow not existant files to pass through.
            _find();
          } else {
            callback(new Error("Error importing " + path));
          }
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

exports.find = find;
exports.subtractSets = subtractSets;
