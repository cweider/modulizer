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
var pathutil = require('path');
var Server = require('../../server').Server;

function VirtualFS (virtualPath) {
  var fs = require('fs');
  var pathutil = require('path');
  this.readFile = function (path) {
    var realPath = pathutil.join(virtualPath, path);
    arguments[0] = realPath;
    return fs.readFile.apply(fs, arguments);
  };
  this.stat = function (path) {
    var realPath = pathutil.join(virtualPath, path);
    arguments[0] = realPath;
    return fs.stat.apply(fs, arguments);
  };
};

var rootPath = pathutil.join(__dirname, 'root')
var libraryPath = pathutil.join(__dirname, 'lib')
var port = 1

var args = process.argv.slice(2);
if (args.length != 3) {
  console.error("Arguments: root, lib, test");
  process.exit(1);
}

var virtualPaths = {
  '/root': new Server(new VirtualFS(args[0]), false)
, '/library': new Server(new VirtualFS(args[1]), true)
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
        break;
      } else {
        virtualPath = undefined;
      }
    }
  }
  if (virtualPath) {
    var moduleServer = virtualPaths[virtualPath];
    requestPath = requestPath.slice(virtualPath.length);
    request.url = request.url.slice(virtualPath.length);
    var originalSetHeader = response.writeHead;
    response.setHeader = function (name, value) {
      if (name == 'Location') {
        return originalSetHeader.call(this, "Location", virtualPath + value);
      } else {
        return originalSetHeader.call(this, name, value);
      }
    };
    var originalWriteHead = response.writeHead;
    response.writeHead = function () {
      var logText = arguments[0] + ": " + virtualPath + " " + requestPath;
      var headers = arguments[arguments.length-1];
      if (typeof headers == 'object') {
        if (headers['Location']) {
          headers["Location"] = virtualPath + headers['Location'];
          logText += " -> " + headers['Location'];
        }
      }
      console.log(logText);
      return originalWriteHead.apply(this, arguments);
    };

    moduleServer.handle(request, response);
  } else {
    var fs = require('fs');
    var path;
    var prefix = '';
    if (requestPath == '/index.html') {
      path = pathutil.join(__dirname, './index.html');
    } else if (requestPath == '/kernel.js') {
      prefix = 'var require = ';
      path = pathutil.join(__dirname, './../../kernel.js');
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