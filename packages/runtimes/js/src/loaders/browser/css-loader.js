const cacheLoader = require('../cacheLoader');

module.exports = cacheLoader(function loadCSSBundle(bundles) {
  return Promise.all(
    bundles.map(
      bundle =>
        new Promise(function(resolve, reject) {
          var link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = bundle;
          link.onerror = function(e) {
            link.onerror = link.onload = null;
            reject(e);
          };

          link.onload = function() {
            link.onerror = link.onload = null;
            resolve();
          };

          document.getElementsByTagName('head')[0].appendChild(link);
        }),
    ),
  );
});
