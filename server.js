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

var pathutil = require('path');

var expiresDate = new Date("2000");
var cacheControl = 'max-age=-1';

function Server(fs) {
  this.fs = fs;
}
Server.prototype = new function () {
  function findFile(fs, path, suffixes, continuation) {
    suffixes = suffixes ? suffixes.slice() : [''];
    var ii = suffixes.length;
    var _findFile = function (i) {
      if (i < ii) {
        var suffix = suffixes[i];
        fs.stat(path + suffix, function (error, stats) {
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
  }

  function handle(request, response) {
    var URL = require('url').parse(request.url, true);
    var requestPath = pathutil.normalize(URL.pathname);
    var fs = this.fs;

    var callback;
    if (URL.query['callback']) {
      if (URL.query['callback'].length == 0) {
        response.writeHead(400, {
          'Content-Type': 'text/plain; charset=utf-8'
        });
        response.end("400: The parameter `callback` must be non-empty.");
        return;
      }
      callback = URL.query['callback'];
    }

    findFile(fs, requestPath, [''], function (actualPath) {
      if (actualPath) {
        if (requestPath == actualPath) {
          response.writeHead(200, {
            'Content-Type': 'text/javascript; charset=utf-8'
          , 'Cache-Control': cacheControl
          , 'Expires': expiresDate
          });
          if (!callback) {
            fs.readFile(actualPath
            , function (error, text) {
                response.end(text, 'utf8');
              }
            );
          } else {
            response.write(callback + '({' +JSON.stringify(requestPath)+ ': ')
            response.write('function (require, exports, module) {\n');
            fs.readFile(actualPath
            , function (error, text) {
                response.write(text, 'utf8');
                response.write("}})\n");
                response.end();
              }
            );
          }
        } else {
          response.writeHead(301, {
            'Content-Type': 'text/plain; charset=utf-8'
          , 'Cache-Control': cacheControl
          , 'Expires': expiresDate
          , 'Location': actualPath
          });
          response.end();
        }
      } else {
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
            + JSON.stringify(requestPath) + ': null})\n');
        }
      }
    });
  }

  this.handle = handle;
}();

exports.Server = Server;
