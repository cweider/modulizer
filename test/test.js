XMLHttpRequest = function () {
  this.open = function () {};
  this.send = function () {};
  this.request = {status: 404};
};
require.setRootURI('/');
require.setLibraryURI('/');
require('/main.js')