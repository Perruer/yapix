// Runs user scripts (mock scripts, test assertions, pre- and post-request scripts) in a separate V8
// isolate. A script sees only the plain data copied into the isolate and the helper libraries loaded
// there. Nothing from the Node.js process is reachable: no require, process, file system or network.
// Every run gets a fresh isolate with its own heap limit and a wall-clock deadline, and the isolate is
// disposed afterwards, so runs cannot share state.
const fs = require('fs');
const ivm = require('isolated-vm');

const MEMORY_LIMIT_MB = 64;
const CPU_TIMEOUT_MS = 3000;
const TOTAL_TIMEOUT_MS = 10000;

// Helper libraries a script may use. Each is loaded only when the script mentions it.
const LIBS = {
  Mock: { file: 'mockjs/dist/mock.js', used: /\b(Mock|Random)\b/ },
  _: { file: 'underscore/underscore-umd.js', used: /\b(_|utils)\b/ },
  CryptoJS: { file: 'crypto-js/crypto-js.js', used: /\b(CryptoJS|utils)\b/ },
  jsrsasign: {
    file: 'jsrsasign/lib/jsrsasign.js',
    used: /\bjsrsasign\b/,
    before: 'globalThis.exports = {};',
    after: 'globalThis.jsrsasign = globalThis.exports; delete globalThis.exports;'
  }
};

const sources = new Map();
function libSource(name) {
  if (!sources.has(name)) {
    const lib = LIBS[name];
    const code = fs.readFileSync(require.resolve(lib.file), 'utf8');
    sources.set(name, { code, cachedData: undefined });
  }
  return sources.get(name);
}

async function loadLib(isolate, context, name) {
  const lib = LIBS[name];
  const src = libSource(name);
  if (lib.before) await context.eval(lib.before);
  const script = await isolate.compileScript(src.code, {
    filename: lib.file,
    cachedData: src.cachedData,
    produceCachedData: !src.cachedData
  });
  if (!src.cachedData && script.cachedData) src.cachedData = script.cachedData;
  await script.run(context);
  if (lib.after) await context.eval(lib.after);
}

// Code that runs inside the isolate before the user script: logging, a small assert module, a
// setTimeout backed by the host, and the helper objects scripts expect.
const PRELUDE = `
'use strict';
const __logs = [];
function __fmt(v) {
  if (v instanceof Error) return v.name + ': ' + v.message;
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v, null, '   '); } catch (e) { return String(v); }
}
globalThis.console = {};
for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
  globalThis.console[level] = (...args) => { __logs.push(args.map(__fmt).join(' ')); };
}
globalThis.log = msg => { __logs.push('log: ' + __fmt(msg)); };

globalThis.setTimeout = (fn, ms, ...args) => {
  __sleep.apply(undefined, [Number(ms) || 0], { result: { promise: true } }).then(() => fn(...args));
  return 0;
};

class AssertionError extends Error {
  constructor(options) {
    super(options.message);
    this.name = 'AssertionError';
    this.actual = options.actual;
    this.expected = options.expected;
    this.operator = options.operator;
  }
}
function __show(v) {
  try { return JSON.stringify(v); } catch (e) { return String(v); }
}
function __fail(actual, expected, message, operator) {
  if (message instanceof Error) throw message;
  throw new AssertionError({
    message: message !== undefined ? String(message) : __show(actual) + ' ' + operator + ' ' + __show(expected),
    actual, expected, operator
  });
}
function __deepEqual(a, b, strict) {
  if (strict ? Object.is(a, b) : a == b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && __deepEqual(a[k], b[k], strict));
}
function assert(value, message) { if (!value) __fail(value, true, message, '=='); }
assert.ok = assert;
assert.equal = (a, b, m) => { if (a != b) __fail(a, b, m, '=='); };
assert.notEqual = (a, b, m) => { if (a == b) __fail(a, b, m, '!='); };
assert.strictEqual = (a, b, m) => { if (!Object.is(a, b)) __fail(a, b, m, '==='); };
assert.notStrictEqual = (a, b, m) => { if (Object.is(a, b)) __fail(a, b, m, '!=='); };
assert.deepEqual = (a, b, m) => { if (!__deepEqual(a, b, false)) __fail(a, b, m, 'deepEqual'); };
assert.deepStrictEqual = (a, b, m) => { if (!__deepEqual(a, b, true)) __fail(a, b, m, 'deepStrictEqual'); };
assert.notDeepEqual = (a, b, m) => { if (__deepEqual(a, b, false)) __fail(a, b, m, 'notDeepEqual'); };
assert.notDeepStrictEqual = (a, b, m) => { if (__deepEqual(a, b, true)) __fail(a, b, m, 'notDeepStrictEqual'); };
assert.fail = m => __fail(undefined, undefined, m === undefined ? 'Failed' : m, 'fail');
assert.throws = (fn, expected, m) => {
  try { fn(); } catch (e) { return; }
  __fail(undefined, expected, typeof expected === 'string' ? expected : m || 'Missing expected exception.', 'throws');
};
assert.doesNotThrow = (fn, m) => {
  try { fn(); } catch (e) { __fail(e, undefined, m || 'Got unwanted exception: ' + __fmt(e), 'doesNotThrow'); }
};
assert.AssertionError = AssertionError;
globalThis.assert = assert;

globalThis.__makeUtils = () => {
  const hash = name => str => CryptoJS[name](String(str)).toString();
  return Object.freeze({
    _: globalThis._,
    CryptoJS: globalThis.CryptoJS,
    jsrsasign: globalThis.jsrsasign,
    base64: str => CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(String(str))),
    unbase64: str => CryptoJS.enc.Base64.parse(String(str)).toString(CryptoJS.enc.Utf8),
    md5: hash('MD5'),
    sha1: hash('SHA1'),
    sha224: hash('SHA224'),
    sha256: hash('SHA256'),
    sha384: hash('SHA384'),
    sha512: hash('SHA512'),
    axios: () => { throw new Error('utils.axios is not available in server-side scripts'); }
  });
};

globalThis.__finish = async () => {
  const p = globalThis.promise;
  if (p && typeof p === 'object' && typeof p.then === 'function') await p;
  const out = {};
  for (const key of __outputKeys) {
    const value = globalThis[key];
    if (typeof value === 'function' || value === undefined) continue;
    try { out[key] = JSON.parse(JSON.stringify(value)); } catch (e) { /* not serializable: leave it out */ }
  }
  return JSON.stringify({ data: out, logs: __logs, storage: globalThis.__storageChanges || {} });
};
`;

// Pre- and post-request scripts get a storage object backed by a copy of the stored items;
// the changed items come back in the result for the caller to save.
const STORAGE = `
globalThis.__storageChanges = {};
globalThis.storage = Object.freeze({
  getItem: name => __storageItems[name],
  setItem: (name, value) => { __storageItems[name] = value; __storageChanges[name] = value; }
});
`;

/**
 * Run a script against plain data.
 * @param {string} script user code; runs as the body of an async function, `this` is the global object
 * @param {object} options
 * @param {object} options.data values the script sees as globals; the same keys are copied back out
 * @param {string[]} [options.outputKeys] extra globals to copy back out
 * @param {boolean} [options.utils] define `utils` (lodash-like helpers, hashes, base64, CryptoJS, jsrsasign)
 * @param {object} [options.storage] items for `storage.getItem/setItem`
 * @returns {Promise<{data: object, logs: string[], storage: object}>}
 */
async function runScript(script, options = {}) {
  const data = options.data || {};
  const outputKeys = Array.from(new Set([...Object.keys(data), ...(options.outputKeys || [])]));
  const code = String(script || '');
  const isolate = new ivm.Isolate({ memoryLimit: MEMORY_LIMIT_MB });
  let timer;
  try {
    const context = await isolate.createContext();
    const jail = context.global;
    await jail.set(
      '__sleep',
      new ivm.Reference(ms => new Promise(resolve => setTimeout(resolve, Math.min(Math.max(ms, 0), TOTAL_TIMEOUT_MS))))
    );
    const wanted = Object.keys(LIBS).filter(name => LIBS[name].used.test(code) || (options.utils && name !== 'Mock'));
    for (const name of wanted) await loadLib(isolate, context, name);
    await jail.set('__outputKeys', new ivm.ExternalCopy(outputKeys).copyInto());
    await context.eval(PRELUDE);
    if (wanted.includes('Mock')) await context.eval('globalThis.Random = Mock.Random;');
    if (options.utils) await context.eval('globalThis.utils = __makeUtils();');
    if (options.storage) {
      await jail.set('__storageItems', new ivm.ExternalCopy(options.storage).copyInto());
      await context.eval(STORAGE);
    }
    await jail.set('__input', new ivm.ExternalCopy(data).copyInto());
    await context.eval('for (const k of Object.keys(__input)) globalThis[k] = __input[k]; delete globalThis.__input;');

    const run = context.eval(`(async function () {\n${code}\n}).call(globalThis).then(() => __finish())`, {
      timeout: CPU_TIMEOUT_MS,
      promise: true,
      filename: 'script.js'
    });
    const deadline = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Script did not finish in ${TOTAL_TIMEOUT_MS / 1000} s`));
        isolate.dispose();
      }, TOTAL_TIMEOUT_MS);
    });
    return JSON.parse(await Promise.race([run, deadline]));
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error(String(err));
  } finally {
    clearTimeout(timer);
    if (!isolate.isDisposed) isolate.dispose();
  }
}

module.exports = { runScript, MEMORY_LIMIT_MB, CPU_TIMEOUT_MS, TOTAL_TIMEOUT_MS };
