if (typeof console == 'undefined') {
  console = {
    log: function (x) {alert(x)}
  , dir: function (x) {alert(x)}
  };
}

require('/graph/1', function () {});
