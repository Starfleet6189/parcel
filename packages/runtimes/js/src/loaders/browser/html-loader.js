const cacheLoader = require('../cacheLoader');

module.exports = cacheLoader(function loadHTMLBundle(bundles) {
  return Promise.all(
    bundles.map(bundle =>
      fetch(bundle).then(function(res) {
        return res.text();
      }),
    ),
  );
});
