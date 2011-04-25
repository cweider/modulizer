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

var http = require('http');
var fs = require('fs');
var pathutil = require('path');

var rootPath = pathutil.join(__dirname, 'root')
var libraryPath = pathutil.join(__dirname, 'lib')
var port = 1

var args = process.argv.slice(2);
if (args.length != 3) {
  console.error("Arguments: root, lib, test");
  process.exit(1);
}

var virtualPaths = {
  '/root': args[0]
, '/library': args[1]
};
var testFile = args[2];

http.createServer(function (request, response) {
  var URL = require('url').parse(request.url, true);
  var requestPath = pathutil.normalize(URL.pathname);
  var path;
  var basePath;
  var realPath;
  var virtualPath;
  for (virtualPath in virtualPaths) {
    if (Object.prototype.hasOwnProperty.call(virtualPaths, virtualPath)) {
      var testPath = requestPath.slice(0, virtualPath.length);
      if (testPath == virtualPath) {
        path = requestPath.slice(virtualPath.length, requestPath.length);
        basePath = virtualPaths[virtualPath];
        realPath = pathutil.join(basePath, path);
        break;
      } else {
        virtualPath = undefined;
      }
    }
  }
  if (virtualPath) {
    var findFile = function (path, suffixes, continuation) {
      suffixes = suffixes ? suffixes.slice() : [''];
      var ii = suffixes.length;
      var _findFile = function (i) {
        if (i < ii) {
          var suffix = suffixes[i];
          fs.stat(realPath + suffix, function (error, stats) {
            if (!error && stats.isFile()) {
              continuation(path + suffix);
            } else {
              _findFile(i+1);
            }
          });
        } else {
          continuation(null);
        }
      };
      _findFile(0);
    };

    var callback;
    if (URL.query['callback']) {
      if (URL.query['callback'].length == 0) {
          console.log("404: " + requestPath);
          response.writeHead(400, {
            'Content-Type': 'text/plain; charset=utf-8'
          });
          response.end("400: The parameter `callback` must be non-empty.");
      }
      callback = URL.query['callback'];
    }

    var suffixes;
    if (URL.query['redirect']) {
      if (!URL.query['redirect'].match(/^(true|false)$/i)) {
          console.log("400: " + requestPath);
          response.writeHead(400, {
            'Content-Type': 'text/plain; charset=utf-8'
          });
          response.end("400: The parameter `redirect` must be (true|false).");
      }
      if (URL.query['redirect'].toLowerCase() == 'true') {
        suffixes = ['', '.js', '/index.js'];
      }
    }

//    var expiresDate = new Date("2020");
//    var cacheControl = 'max-age=3456000';
    var expiresDate = new Date("2000");
    var cacheControl = 'max-age=-1';

    findFile(path, suffixes, function (found) {
      if (found) {
        if (path == found) {
          console.log("200: " + requestPath);
          response.writeHead(200, {
            'Content-Type': 'text/javascript; charset=utf-8'
          , 'Cache-Control': cacheControl
          , 'Expires': expiresDate
          });
          if (!callback) {
            fs.readFile(pathutil.join(basePath, found)
            , function (error, text) {
                response.end(text, 'utf8');
              }
            );
          } else {
            response.write(callback + '({' + JSON.stringify(path) + ': ')
            response.write('function (require, exports, module) {\n');
            fs.readFile(realPath
            , function (error, text) {
                response.write(text, 'utf8');
                response.write("}})\n");
                response.end();
              }
            );
          }
        } else {
          console.log("301: " + requestPath);
          response.writeHead(301, {
            'Content-Type': 'text/plain; charset=utf-8'
          , 'Cache-Control': cacheControl
          , 'Expires': expiresDate
          , 'Location': virtualPath + found
          });
          response.end();
        }
      } else {
        console.log("404: " + requestPath);
        if (!callback) {
          response.writeHead(404, {
            'Content-Type': 'text/plain; charset=utf-8'
          , 'Cache-Control': cacheControl
          , 'Expires': expiresDate
          });
          response.end("404: File not found.");
        } else {
          response.writeHead(200, {
            'Content-Type': 'text/javascript; charset=utf-8'
          , 'Cache-Control': cacheControl
          , 'Expires': expiresDate
          });
          response.end(callback + '({'
            + JSON.stringify(path) + ': null})\n');
        }
      }
    });
  } else {
    var path;
    var prefix = '';
    if (requestPath == '/index.html') {
      path = pathutil.join(__dirname, './index.html');
    } else if (requestPath == '/kernel.js') {
      prefix = 'var require = ';
      path = pathutil.join(__dirname, './../kernel.js');
    } else if (requestPath == '/test.js') {
      path = testFile;
    }

    var fail = function () {
      response.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8'
      });
      response.end("404: File not found.");
    };

    if (!path) {
      return fail();
    }

    fs.readFile(path, 'utf8', function (error, text) {
      if (error) {
        return fail();
      }

      types = {
        '.html': 'text/html'
      , '.js': 'text/javascript'
      };
      response.writeHead(200, {
        'Content-Type':
          (types[pathutil.extname(path)] || 'text/plain') + ';'
        + ' charset=utf-8'
      });
      prefix && response.write(prefix, 'utf8');
      response.end(text);
    });
  }

}).listen(8124);

console.log('Server running at http://127.0.0.1:8124/');