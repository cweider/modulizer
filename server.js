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
var hasOwnProperty = Object.prototype.hasOwnProperty;

function toJSLiteral(object) {
  // Remember, JSON is not a subset of JavaScript. Some line terminators must
  // be escaped manually.
  var result = JSON.stringify(object);
  result = result.replace('\u2028', '\\u2028').replace('\u2029', '\\u2029');
  return result;
}
function cacheControl(seconds) {
  return 'max-age=' + seconds;
}
function expires(seconds) {
  return (new Date((new Date()).getTime() + seconds*1000)).toUTCString();
}

/*
  I implement a JavaScript module server.

  Module associations:
  Packages have many modules and modules can have many Packages. However,
  every module can have at most one 'designated' package. Any requests for a
  module with a designated package will be fullfilled with the contents of
  that package (typically through redirection).
*/
function Server(fs, isLibrary) {
  this._fs = fs;
  this._isLibrary = !!isLibrary;
  this._cachePeriod = 180*24*60*60;

  this._associator = undefined;
}
Server.prototype = new function () {
  function handle(request, response) {
    var fs = this._fs;
    var url = require('url').parse(request.url, true);
    var modulePath = pathutil.normalize(url.pathname);
    var cachePeriod = this._cachePeriod;

    var callback;
    if (url.query['callback']) {
      if (url.query['callback'].length == 0) {
        response.writeHead(400, {
          'Content-Type': 'text/plain; charset=utf-8'
        });
        response.end("400: The parameter `callback` must be non-empty.");
        return;
      }
      callback = url.query['callback'];
    }

    if (callback) {
      // Respond JSONP style.

      var designatedModulePath;
      if (this._associator) {
        designatedModulePath = this._associator.preferredPath(modulePath);
      } else {
        designatedModulePath = modulePath;
      }

      if (designatedModulePath != modulePath) {
        // Redirect to designated module path.
        url.pathname = designatedModulePath;
        response.writeHead(301, {
          'Content-Type': 'text/plain; charset=utf-8'
        , 'Cache-Control': cacheControl(cachePeriod)
        , 'Expires': expires(cachePeriod)
        , 'Location': require('url').format(url)
        });
        response.write("301: Resource moved permanantly to "
          + require('url').format(url));
        response.end();
      } else {
        // Respond with contents of file. If file does not exist then its
        // value will be null. If there is any error reading the request will
        // be aborted
        response.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8'
        , 'Cache-Control': cacheControl(cachePeriod)
        , 'Expires': expires(cachePeriod)
        });

        var isLibrary = this._isLibrary;
        var modulePaths;
        if (this._associator) {
          modulePaths = this._associator.associatedModulePaths(modulePath);
        } else {
          modulePaths = [modulePath];
        }

        response.write(callback + '({');
        var ii = modulePaths.length;
        var _readEach = function (i) {
          if (i < ii) {
            var modulePath = modulePaths[i];
            fs.readFile(modulePath, 'utf8', function (error, text) {
              if (error &&
                  ['ENOENT', 'EISDIR', 'EACCESS'].indexOf(error.code) == -1) {
                request.connection.destroy(); // Fail hard?
              } else {
                if (error) {
                  text = 'null';
                } else {
                  text =
                    'function (require, exports, module) {'
                  + ('\n' + text).replace(/\n([^\n])/g, "\n    $1")
                  + '  }';
                }
                response.write(i == 0 ?  "\n  " : "\n, ");
                if (isLibrary) {
                  modulePath = requestPath.replace(/^\//, '');
                }
                response.write(toJSLiteral(modulePath) + ': ' + text);

                _readEach(i+1);
              }
            });
          } else {
            response.write("\n});\n");
            response.end();
          }
        };
        _readEach(0);
      }
    } else {
      // Simply respond as a normal file server would.
      fs.readFile(modulePath, function (error, text) {
        if (error &&
            ['ENOENT', 'EISDIR', 'EACCESS'].indexOf(error.code) == -1) {
          response.writeHead(500, {
            'Content-Type': 'text/plain; charset=utf-8'
          });
          response.end("500: Read error.");
        } else if (error) {
          response.writeHead(404, {
            'Content-Type': 'text/plain; charset=utf-8'
          , 'Cache-Control': cacheControl(cachePeriod)
          , 'Expires': expires(cachePeriod)
          });
          response.end("404: File not found.");
        } else {
          response.writeHead(200, {
            'Content-Type': 'application/javascript; charset=utf-8'
          , 'Cache-Control': cacheControl(cachePeriod)
          , 'Expires': expires(cachePeriod)
          });
          response.end(text, 'utf8');
        }
      });
    }
  }

  function setAssociator(associator) {
    this._associator = associator;
  }

  this.handle = handle;
  this.setAssociator = setAssociator;
}();

exports.Server = Server;
