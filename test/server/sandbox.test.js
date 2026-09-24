const { test } = require('node:test');
const assert = require('node:assert');
const { runScript } = require('../../server/utils/sandbox');

test('globals go in and changed values come back', async () => {
  const out = await runScript('mockJson.name = "tom"; httpCode = 201; resHeader["x-a"] = "1";', {
    data: { mockJson: { id: 1 }, httpCode: 200, resHeader: {} }
  });
  assert.deepStrictEqual(out.data, { mockJson: { id: 1, name: 'tom' }, httpCode: 201, resHeader: { 'x-a': '1' } });
});

test('the caller keeps its own objects unchanged', async () => {
  const data = { body: { a: 1 } };
  await runScript('body.a = 2;', { data });
  assert.strictEqual(data.body.a, 1);
});

test('log and console output is returned', async () => {
  const out = await runScript('log({ a: 1 }); console.log("x", 2);', { data: {} });
  assert.deepStrictEqual(out.logs, ['log: {\n   "a": 1\n}', 'x 2']);
});

test('assert failures surface as AssertionError', async () => {
  await assert.rejects(runScript('assert.equal(status, 200);', { data: { status: 404 } }), err => {
    assert.match(err.message, /404 == 200/);
    return true;
  });
  await runScript('assert.deepEqual(body, { a: [1, 2] }); assert(status === 200);', {
    data: { status: 200, body: { a: [1, 2] } }
  });
});

test('await works and a context.promise is awaited', async () => {
  const out = await runScript('await null; x = 1; promise = new Promise(r => setTimeout(() => { y = 2; r(); }, 10));', {
    data: { x: 0 },
    outputKeys: ['y']
  });
  assert.deepStrictEqual(out.data, { x: 1, y: 2 });
});

test('Mock.js is available to mock scripts', async () => {
  const out = await runScript('mockJson = Mock.mock({ "list|3": [{ id: "@id" }] }); email = Random.email();', {
    data: { mockJson: null, email: '' }
  });
  assert.strictEqual(out.data.mockJson.list.length, 3);
  assert.match(out.data.email, /@/);
});

test('utils offer hashes, base64 and CryptoJS', async () => {
  const out = await runScript(
    'md5 = utils.md5("abc"); sha256 = utils.sha256("abc"); b = utils.base64("привет"); u = utils.unbase64(b); hmac = utils.CryptoJS.HmacSHA256("m", "k").toString(); keys = utils._.keys({ a: 1 });',
    { data: {}, outputKeys: ['md5', 'sha256', 'b', 'u', 'hmac', 'keys'], utils: true }
  );
  assert.strictEqual(out.data.md5, '900150983cd24fb0d6963f7d28e17f72');
  assert.strictEqual(out.data.sha256, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.strictEqual(out.data.b, Buffer.from('привет').toString('base64'));
  assert.strictEqual(out.data.u, 'привет');
  assert.strictEqual(out.data.hmac, require('crypto').createHmac('sha256', 'k').update('m').digest('hex'));
  assert.deepStrictEqual(out.data.keys, ['a']);
});

test('storage changes are returned for the caller to save', async () => {
  const out = await runScript('storage.setItem("token", storage.getItem("seed") + "-1");', {
    data: {},
    storage: { seed: 'abc' }
  });
  assert.deepStrictEqual(out.storage, { token: 'abc-1' });
});

test('scripts cannot reach Node.js', async () => {
  const out = await runScript('kinds = [typeof require, typeof process, typeof module, typeof Buffer, typeof fetch];', {
    data: { kinds: null }
  });
  assert.deepStrictEqual(out.data.kinds, ['undefined', 'undefined', 'undefined', 'undefined', 'undefined']);
});

test('a script that never ends is stopped', async () => {
  const started = Date.now();
  await assert.rejects(runScript('while (true) {}', { data: {} }));
  assert.ok(Date.now() - started < 8000);
});

test('a script that allocates too much memory is stopped', async () => {
  await assert.rejects(runScript('const a = []; while (true) a.push(new Array(1e5).fill(1));', { data: {} }));
});
