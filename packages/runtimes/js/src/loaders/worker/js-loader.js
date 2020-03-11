/* global importScripts:readonly*/
const cacheLoader = require('../cacheLoader');

module.exports = cacheLoader(function loadJSBundle(bundles) {
  return new Promise(function(resolve, reject) {
    try {
      importScripts.apply(null, bundles);
      resolve();
    } catch (e) {
      reject(e);
    }
  });
});
