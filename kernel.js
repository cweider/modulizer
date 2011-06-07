(function () {
  /* Storage */
  var main = null;
  var modules = {};
  var loadingModules = {};
  var installWaiters = {};
  var installRequests = [];
  var installRequest = undefined;

  var syncLock = undefined;
  var globalKeyPath = undefined;

  var rootURI = undefined;
  var libraryURI = undefined;

  /* Paths */
  function normalizePath(path) {
    var pathComponents1 = path.split('/');
    var pathComponents2 = [];

    var component;
    for (var i = 0, ii = pathComponents1.length; i < ii; i++) {
      component = pathComponents1[i];
      switch (component) {
        case '':
        case '.':
          if (i == 0) {
            pathComponents2.push(component);
          }
          break;
        case '..':
          if (pathComponents2.length > 1
            || (pathComponents2.length == 1
              && pathComponents2[0] != ''
              && pathComponents2[0] != '.')) {
            pathComponents2.pop();
            break;
          }
        default:
          pathComponents2.push(component);
      }
    }

    return pathComponents2.join('/');
  }

  function fullyQualifyPath(path, basePath) {
    var fullyQualifiedPath = path;
    if (path.charAt(0) == '.'
      && (path.charAt(1) == '/'
        || (path.charAt(1) == '.' && path.charAt(2) == '/'))) {
      if (!basePath) {
        basePath = '/';
      } else if (basePath.charAt(basePath.length-1) != '/') {
        basePath += '/';
      }
      fullyQualifiedPath = basePath + path;
    }
    return fullyQualifiedPath;
  }

  function setRootURI(URI) {
    if (!URI) {
      throw new Error("Argument Error: invalid root URI.");
    }
    rootURI = (URI.charAt(URI.length-1) == '/' ? URI.slice(0,-1) : URI);
  }

  function setLibraryURI(URI) {
    libraryURI = (URI.charAt(URI.length-1) == '/' ? URI : URI + '/');
  }

  function URIForModulePath(path) {
    var components = path.split('/');
    for (var i = 0, ii = components.length; i < ii; i++) {
      components[i] = encodeURIComponent(components[i]);
    }
    path = components.join('/')

    if (path.charAt(0) == '/') {
      if (!rootURI) {
        throw new Error("Attempt to retrieve the root module "
          + "\""+ path + "\" but no root URI is defined.");
      }
      return rootURI + path;
    } else {
      if (!libraryURI) {
        throw new Error("Attempt to retrieve the library module "
          + "\""+ path + "\" but no libary URI is defined.");
      }
      return libraryURI + path;
    }
  }

  /* Remote */
  function setGlobalKeyPath (value) {
    globalKeyPath = value;
  }

  var XMLHttpFactories = [
    function () {return new XMLHttpRequest()},
    function () {return new ActiveXObject("Msxml2.XMLHTTP")},
    function () {return new ActiveXObject("Msxml3.XMLHTTP")},
    function () {return new ActiveXObject("Microsoft.XMLHTTP")}
  ];

  function createXMLHTTPObject() {
    var xmlhttp = false;
    for (var i = 0, ii = XMLHttpFactories.length; i < ii; i++) {
      try {
        xmlhttp = XMLHttpFactories[i]();
      } catch (error) {
        continue;
      }
      break;
    }
    return xmlhttp;
  }

  /* Modules */
  function fetchModule(path, continuation) {
    if (Object.prototype.hasOwnProperty.call(installWaiters, path)) {
      installWaiters[path].push(continuation);
    } else {
      installWaiters[path] = [continuation];
      scheduleFetchInstall(path);
    }
  }

  function scheduleFetchInstall(path) {
    installRequests.push(path);
    if (installRequest === undefined) {
      continueScheduledFetchInstalls();
    }
  }

  function continueScheduledFetchInstalls() {
    if (installRequests.length > 0) {
      installRequest = installRequests.pop();
      var fetchFunc = globalKeyPath ? fetchInstallJSONP : fetchInstallXHR;
      fetchFunc(installRequest);
    }
  }

  function fetchInstallXHR(path) {
    var request = createXMLHTTPObject();
    if (!request) {
      throw new Error("Error making remote request.")
    }

    request.open('GET', URIForModulePath(path), true);
    request.onreadystatechange = function (event) {
      if (request.readyState == 4) {
        if (request.status == 200) {
          // Build module constructor.
          var response = new Function(
              'return function (require, exports, module) {\n'
                + request.responseText + '};\n')();

          install(path, response);
        } else {
          install(path, null);
        }
      }
    };
    request.send(null);
  }

  function fetchInstallJSONP(path) {
    var head = document.head
      || document.getElementsByTagName('head')[0]
      || document.documentElement;
    var script = document.createElement('script');
    script.async = "async";
    script.defer = "defer";
    script.type = "text/javascript";
    script.src = URIForModulePath(path)
      + '?callback=' + encodeURIComponent(globalKeyPath + '.define');

    head.insertBefore(script, head.firstChild);
  }

  function fetchModuleSync(path, continuation) {
    var request = createXMLHTTPObject();
    if (!request) {
      throw new Error("Error making remote request.")
    }

    request.open('GET', URIForModulePath(path), false);
    request.send(null);
    if (request.status == 200) {
      // Build module constructor.
      var response = new Function(
          'return function (require, exports, module) {\n'
            + request.responseText + '};\n')();

      install(path, response);
    } else {
      install(path, null);
    }
    continuation();
  }

  function loadModule(path) {
    var module = modules[path];
    // If it's a function then it hasn't been exported yet. Run function and
    //  then replace with exports result.
    if (module instanceof Function) {
      if (Object.prototype.hasOwnProperty.call(loadingModules, path)) {
        throw new Error("Encountered circurlar dependency.");
      }
      var _module = {id: path, exports: {}};
      var _require = requireRelativeTo(path.replace(/[^\/]+$/,''));
      if (!main) {
        main = _module;
      }
      loadingModules[path] = true;
      module(_require, _module.exports, _module);
      module = modules[path] = _module;
      delete loadingModules[path];
    }
    return module;
  }

  function _moduleAtPath(path, fetchFunc, continuation) {
    var suffixes = ['', '.js', '/index.js'];
    var i = 0, ii = suffixes.length;
    var _find = function (i) {
      if (i < ii) {
        var path_ = path + suffixes[i];
        var after = function () {
          var module = loadModule(path_);
          if (module === null) {
            _find(i + 1);
          } else {
            continuation(module);
          }
        }

        if (!Object.prototype.hasOwnProperty.call(modules, path_)) {
          fetchFunc(path_, after);
        } else {
          after();
        }

      } else {
        continuation(null);
      }
    };
    _find(0);
  }

  function moduleAtPath(path, continuation) {
    // Detect if this call, which has the potential to be
    //  asynchrounously, is not completed synchronously.
    var brokeSyncLock = true;
    wrappedContinuation = function () {
      brokeSyncLock = false;
      continuation.apply(this, arguments);
    };

    _moduleAtPath(path, fetchModule, wrappedContinuation);

    if (syncLock && brokeSyncLock) {
      throw new Error(
          "Attempt to load module asnynchronously in a synchronous block.");
    }
  }

  function moduleAtPathSync(path) {
    _moduleAtPath(path, fetchModuleSync, function (m) {module = m});
    return module;
  }

  /* Installation */
  function installModule(path, module) {
    if (typeof path != 'string'
      || !((module instanceof Function) || module === null)) {
      throw new Error(
          "Argument error: install must be given a (string, function) pair.");
    }

    if (Object.prototype.hasOwnProperty.call(modules, path)) {
      // Drop import silently
    } else {
      modules[path] = module;
    }
  }

  function installModules(moduleMap) {
    if (typeof moduleMap != 'object') {
      throw new Error("Argument error: install must be given a object.");
    }
    for (var path in moduleMap) {
      if (Object.prototype.hasOwnProperty.call(moduleMap, path)) {
        installModule(path, moduleMap[path]);
      }
    }
  }

  function install(fullyQualifiedPathOrModuleMap, module) {
    var moduleMap;
    if (arguments.length == 1) {
      moduleMap = fullyQualifiedPathOrModuleMap;
      installModules(moduleMap);
    } else if (arguments.length == 2) {
      var path = fullyQualifiedPathOrModuleMap;
      installModule(fullyQualifiedPathOrModuleMap, module);
      moduleMap = {};
      moduleMap[path] = module;
    } else {
      throw new Error("Argument error: expected 1 or 2 got "
          + arguments.length + ".");
    }

    if (!syncLock) {
      for (var path in moduleMap) {
        if (Object.prototype.hasOwnProperty.call(moduleMap, path)
          && Object.prototype.hasOwnProperty.call(installWaiters, path)) {
          var continuations = installWaiters[path];
          delete installWaiters[path];
          for (var i = 0, ii = continuations.length; i < ii; i++) {
            continuations[i]();
          }
        }
      }
      if (Object.prototype.hasOwnProperty.call(moduleMap, installRequest)) {
        installRequest = undefined;
        continueScheduledFetchInstalls();
      }
    }
  }

  /* Require */
  function requireBase(path, continuation) {
    if (continuation === undefined) {
      var module = moduleAtPathSync(path);
      if (!module) {
        throw new Error("The module at \"" + path + "\" does not exist.");
      }
      return module.exports;
    } else {
      if (!(continuation instanceof Function)) {
        throw new Error("Argument Error: continuation must be a function.");
      }
      moduleAtPath(path, function (module) {continuation(module.exports)});
    }
  }

  function requireRelative(basePath, qualifiedPath, continuation) {
    qualifiedPath = qualifiedPath.toString();
    var path = normalizePath(fullyQualifyPath(qualifiedPath, basePath));
  }

  var requireRelativeTo = function (basePath) {
    function require(qualifiedPath, continuation) {
      return requireRelative(basePath, qualifiedPath, continuation);
    }
    require.main = main;

    return require;
  }

  var rootRequire = requireRelativeTo('/');
  rootRequire._modules = modules;
  rootRequire.define = install;
  rootRequire.setGlobalKeyPath = setGlobalKeyPath;
  rootRequire.setRootURI = setRootURI;
  rootRequire.setLibraryURI = setLibraryURI;
  return rootRequire;
})();
