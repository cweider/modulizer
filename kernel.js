var require =
  (typeof require != 'undefined') && require.install ? require :(function () {
  /* Storage */
  var main = null;
  var modules = {};
  var loadingModules = {};

  var rootURI = '/';
  var libraryURI = undefined;

  /* Paths */
  function normalizePath(path) {
    var pathComponents1 = path.split('/');
    var pathComponents2 = [];
    if (path.charAt(0) == '/') {
      pathComponents1.unshift('');
    }

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
          if (pathComponents2.length) {
            pathComponents2.pop();
            break;
          }
        default:
          pathComponents2.push(component);
      }
    }

    return pathComponents2.join('/');
  };

  var fullyQualifyPath = function (path, basePath) {
    var fullyQualifiedPath = path;
    if (path.charAt(0) == '.'
      && (path.charAt(1) == '/'
        || (path.charAt(1) == '.'
          && path.charAt(2) == '/'))) {
      if (!basePath) {
        basePath = '/';
      } else if (basePath.charAt(basePath.length-1) != '/') {
        basePath += '/';
      }
      fullyQualifiedPath = basePath + path;
    }
    return fullyQualifiedPath;
  };

  function setRootURI(URI) {
    if (!URI) {
      throw new Error("Argument Error: invalid root URI.");
    }
    rootURI = (URI.charAt(URI.length-1) == '/' ? URI.slice(0,-1) : URI);
  };

  function setLibraryURI(URI) {
    libraryURI = (URI.charAt(URI.length-1) == '/' ? URI : URI + '/');
  };

  function URIForModulePath(path) {
    if (path.charAt(0) == '/') {
      return rootURI + path;
    } else {
      if (!libraryURI) {
        throw new Error("Attempt to retrieve the library module "
          + "\""+ path + "\" but no libary URI is defined.");
      }
      return libraryURI + path;
    }
  };

  /* Remote */
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
  };

  /* Modules */
  function fetchModuleSync(path) {
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

      installMulti(path, response);
    } else {
      installMulti(path, null);
    }
  };

  function loadModule(path) {
    var module = modules[path];
    // If it's a function then it hasn't been exported yet. Run function and
    //  then replace with exports result.
    if (module instanceof Function) {
      if (Object.prototype.hasOwnProperty(loadingModules, path)) {
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
  };

  function moduleAtPath(path) {
    var suffixes = ['', '.js', '/index.js'];
    for (var i = 0, ii = suffixes.length; i < ii; i++) {
      var path_ = path + suffixes[i];
      if (!Object.prototype.hasOwnProperty.call(modules, path_)) {
        fetchModuleSync(path_);
      }

      var module = loadModule(path_);
      if (module) {
        return module;
      }
    }
    return undefined;
  };

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
  };

  function installModules(moduleMap) {
    if (typeof moduleMap != 'object') {
      throw new Error("Argument error: install must be given a object.");
    }
    for (var path in moduleMap) {
      if (Object.prototype.hasOwnProperty.call(moduleMap, path)) {
        installModule(path, moduleMap[path]);
      }
    }
  };

  function installMulti(fullyQualifiedPathOrModuleMap, module) {
    if (arguments.length == 1) {
      installModules(fullyQualifiedPathOrModuleMap);
    } else if (arguments.length == 2) {
      installModule(fullyQualifiedPathOrModuleMap, module);
    } else {
      throw new Error("Argument error: expected 1 or 2 got "
          + arguments.length + ".");
    }
  };

  /* Require */
  function requireBase(path) {
    var module = moduleAtPath(path);
    if (!module) {
      throw new Error("The module at \"" + path + "\" does not exist.");
    }
    return module.exports;
  };

  var requireRelativeTo = function (basePath) {
    function require(qualifiedPath) {
      var path = normalizePath(fullyQualifyPath(qualifiedPath, basePath));
      return requireBase(path);
    };
    require.main = main;

    return require;
  };

  var rootRequire = requireRelativeTo('/');
  rootRequire._modules = modules;
  rootRequire.install = installMulti;
  rootRequire.setRootURI = setRootURI;
  rootRequire.setLibraryURI = setLibraryURI;
  return rootRequire;
})();
