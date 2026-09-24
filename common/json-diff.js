// jsondiffpatch 0.7 is an ES module; require() of it works in Node 24 and in webpack.
// The text-diff build diffs long strings by characters, as older jsondiffpatch releases did.
const jsondiffpatch = require('jsondiffpatch/with-text-diffs');
const formattersHtml = require('jsondiffpatch/formatters/html');

module.exports = { jsondiffpatch, formattersHtml };
