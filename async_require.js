var fs = require('fs');
var pathutil = require('path');
var events = require('events');

var kernelPath = pathutil.join(__dirname, 'kernel.js');
var kernel = 'var require = '
  + fs.readFileSync(kernelPath, 'utf8')
  + 'return require;';

var buildKernel = new Function('XMLHttpRequest', kernel);
var buildMockXMLHttpRequestClass = function (virtualPaths) {
  var emitter = new events.EventEmitter();
  var requestCount = 0;
  var idleTimer = undefined;
  var idleHandler = function () {
    emitter.emit('idle');
  };
  var requested = function (info) {
    clearTimeout(idleTimer);
    requestCount++;
    emitter.emit('requested', info);
  };
  var responded = function (info) {
    emitter.emit('responded', info);
    requestCount--;
    if (requestCount == 0) {
      idleTimer = setTimeout(idleHandler, 0);
    }
  };

  var MockXMLHttpRequest = function () {
  };
  MockXMLHttpRequest.prototype = new function () {
    this.open = function(method, url, async) {
      this.async = async;
      this.url = url;
    }
    this.send = function () {
      var requestPath;
      var path;
      var basePath;
      var realPath;

      var components = this.url.split('/');
      for (var i = 0, ii = components.length; i < ii; i++) {
        components[i] = decodeURIComponent(components[i]);
      }
      requestPath = components.join('/')
      for (var virtualPath in virtualPaths) {
        if (Object.prototype.hasOwnProperty.call(virtualPaths, virtualPath)) {
          var testPath = requestPath.slice(0, virtualPath.length);
          if (testPath == virtualPath) {
            path = requestPath.slice(virtualPath.length, requestPath.length);
            basePath = virtualPaths[virtualPath];
            realPath = pathutil.join(basePath, path);
            break;
          }
        }
      }

      var info = {
        async: !!this.async
      , requestPath: requestPath
      , path: path
      , basePath: basePath
      , realPath: realPath
      };
      requested(info);
      if (!this.async) {
        try {
          this.status = 200;
          this.responseText = fs.readFileSync(realPath);
        } catch (e) {
          this.status = 404;
        }
        this.readyState = 4;
        responded(info);
      } else {
        var self = this;
        fs.readFile(realPath, 'utf8', function (error, text) {
          self.status = error ? 404 : 200;
          self.responseText = text;
          self.readyState = 4;
          var handler = self.onreadystatechange;
          handler && handler();
          responded(info);
        });
      }
    }
  };
  MockXMLHttpRequest.emitter = emitter;

  return MockXMLHttpRequest;
}

function requireForPaths(rootPath, libraryPath) {
  var virtualPaths = {
    root: rootPath
  , library: libraryPath
  };
  var MockXMLHttpRequest = buildMockXMLHttpRequestClass(virtualPaths);
  var mockRequire = buildKernel(MockXMLHttpRequest);
  mockRequire.setRootURI('root');
  mockRequire.setLibraryURI('library');
  mockRequire.emitter = MockXMLHttpRequest.emitter;
  return mockRequire;
}

exports.requireForPaths = requireForPaths;
