// The old tests were written for ava; this maps the assertions they use onto node:test.
const { test } = require('node:test');
const assert = require('node:assert');

const t = {
  is: (a, b, m) => assert.strictEqual(a, b, m),
  not: (a, b, m) => assert.notStrictEqual(a, b, m),
  deepEqual: (a, b, m) => assert.deepStrictEqual(a, b, m),
  true: (v, m) => assert.strictEqual(v, true, m),
  false: (v, m) => assert.strictEqual(v, false, m),
  truthy: (v, m) => assert.ok(v, m),
  falsy: (v, m) => assert.ok(!v, m)
};

module.exports = (name, fn) => test(name, () => fn(t));
