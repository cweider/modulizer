var require = (typeof require != 'undefined') && require.install ? require : (function () {
  var modules = {};
  var main = null;

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

  var requireRelativeTo = function (relativePath) {
    var _require = function (path) {
      var topLevelPath = normalizePath(rootedPath(path, relativePath));
      var module = moduleAtPath(topLevelPath);
      if (!module) {
        throw new Error("The module at \"" + topLevelPath + "\" does not exist.");
      }
      return module.exports;
    };
    var _install = function (topLevelPath, module) {
      if (typeof topLevelPath != 'string' || typeof module != 'function') {
        throw new Error("Argument error: install must be given a string function pair.");
      }

      if (moduleAtPath(topLevelPath)) {
        // Drop import silently
      } else {
        modules[topLevelPath] = module;
      }
    };
    _require.install = function (topLevelPathOrModuleMap, module) {
      if (typeof topLevelPathOrModuleMap == 'object') {
        var moduleMap = topLevelPathOrModuleMap;
        for (var topLevelPath in moduleMap) {
          if (Object.prototype.hasOwnProperty.call(moduleMap, topLevelPath)) {
            _install(topLevelPath, moduleMap[topLevelPath]);
          }
        }
      } else {
        _install(topLevelPathOrModuleMap, module);
      }
    };
    _require._modules = modules;
    _require.main = main;

    return _require;
  };

  return requireRelativeTo('/');
})();
require.install({
  "/main.js": function (require, exports, module) {
    Button = require('ui/button');
    Util = require('util/util');
    SpecialButton = require('ui/ext/special_button');

    console.log('Button is:');
    console.dir(Button);

    console.log('SpecialButton is:');
    console.dir(SpecialButton);

    console.log('Util is:');
    console.dir(Util);
    },
  "util/util.js": function (require, exports, module) {
    console.log('MODULE RUN: UTIL');

    exports.escapeHTML = function () {};
    exports.escapeHTMLAttribute = function () {};
    exports.importantURL = 'http://example.com/';
    },
  "ui/ext/special_button.js": function (require, exports, module) {
    Control = require('../control');
    Button = require('../../ui/button');
    Util = require('util/util');
    console.log('MODULE RUN: SPECIAL BUTTON');

    exports.Button = Button;
    exports.Control = Control;
    exports.Util = Util;
    },
  "ui/control.js": function (require, exports, module) {
    Util = require('../util/util');
    console.log('MODULE RUN: CONTROL');

    exports.i_am_a_control = true;
    exports.utils = Util;
    },
  "ui/button.js": function (require, exports, module) {
    Control = require('./control');
    Util = require('../util/util');
    console.log('MODULE RUN: BUTTON');

    exports.button1 = 'button1';
    exports.button2 = 'button2';
    exports.Control = Control;
    },
  "/../ext/index.js": function (require, exports, module) {
    /* An external file */
    }
});

require("/main.js")
