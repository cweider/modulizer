var require = (typeof require != 'undefined') && require.install ? require : (function () {
  /* Storage */
  var modules = {};
  var main = null;

  /* Paths */
  var normalizePath = function (path) {
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

  var rootedPath = function (path, relativePath) {
    var topLevelPath = path;
    if (path.charAt(0) == '.' && (path.charAt(1) == '/' || (path.charAt(1) == '.' && path.charAt(2) == '/'))) {
       topLevelPath = (relativePath || '/') + path;
    }
    return topLevelPath;
  };

  /* Modules */
  var moduleAtPath = function (topLevelPath) {
    var suffixes = ['', '.js', '/index.js'];
    for (var i = 0, ii = suffixes.length; i < ii; i++) {
      var suffix = suffixes[i];
      var path = topLevelPath + suffix;
      var module = Object.prototype.hasOwnProperty.call(modules, path) && modules[path];
      if (module) {
        // If it's a function then it hasn't been exported yet. Run function and
        //  then replace with exports result.
        if (module instanceof Function) {
          var _module = {id: topLevelPath, exports: {}};
          if (!main) {
            main = _module;
          }
          modules[topLevelPath] = _module;
          module(requireRelativeTo(path.replace(/[^\/]+$/,'')), _module.exports, _module);
          module = _module;
        }
        return module;
      }
    }
    return null;
  };

  /* Installation */
  var installModule = function (topLevelPath, module) {
    if (typeof topLevelPath != 'string' || typeof module != 'function') {
      throw new Error("Argument error: install must be given a (string, function) pair.");
    }

    if (moduleAtPath(topLevelPath)) {
      // Drop import silently
    } else {
      modules[topLevelPath] = module;
    }
  };
  var installModules = function (moduleMap) {
    if (typeof moduleMap != 'object') {
      throw new Error("Argument error: install must be given a object.");
    }
    for (var topLevelPath in moduleMap) {
      if (Object.prototype.hasOwnProperty.call(moduleMap, topLevelPath)) {
        _install(topLevelPath, moduleMap[topLevelPath]);
      }
    }
  };
  var installMulti = function (topLevelPathOrModuleMap, module) {
    if (arguments.length == 1) {
      installModules(topLevelPathOrModuleMap);
    } else if (arguments.length == 2) {
      installModule(topLevelPathOrModuleMap, module);
    } else {
      throw new Error("Argument error: expected 1 or 2 got " + arguments.length + ".");
    }
  };

  /* Require */
  var require = function (topLevelPath) {
    var module = moduleAtPath(topLevelPath);
    if (!module) {
      throw new Error("The module at \"" + topLevelPath + "\" does not exist.");
    }
    return module.exports;
  }

  var requireRelativeTo = function (relativePath) {
    var _require = function (path) {
      var topLevelPath = normalizePath(rootedPath(path, relativePath));
      return require(topLevelPath);
    };
    _require.install = installMulti;
    _require._modules = modules;
    _require.main = main;

    return _require;
  };

  return requireRelativeTo('/');
})();
