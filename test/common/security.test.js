const { test } = require('node:test');
const assert = require('node:assert');
const Mock = require('../../common/mockjs.js');
const { jsondiffpatch, formattersHtml } = require('../../common/json-diff.js');

test('a __proto__ key in a mock template does not reach Object.prototype', () => {
  const template = JSON.parse('{"__proto__": {"pollutedByMock": "yes"}, "list|2": [{"id|+1": 1}]}');
  const out = Mock.mock(template);
  assert.strictEqual({}.pollutedByMock, undefined);
  assert.deepStrictEqual(out.list, [{ id: 1 }, { id: 2 }]);
});

test('the diff view escapes changed values', () => {
  const left = { name: '<img src=x onerror=alert(1)>' };
  const html = formattersHtml.format(jsondiffpatch.diff(left, { name: 'ok' }), left);
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img'));
});
