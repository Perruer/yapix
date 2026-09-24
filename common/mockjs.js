// Mock.js 1.1.0 is the last release. Its Util.extend copies every key of a template, so a "__proto__"
// key in a mock template writes into Object.prototype (prototype pollution, no upstream fix).
// Templates come from users, so every Yapix module loads Mock.js through this file, which replaces
// Util.extend with a copy that skips that key. Mock.js calls Util.extend through the shared Util object,
// so the replacement covers its internal calls too.
const Mock = require('mockjs');

const Util = Mock.Util;

if (!Util.extend.yapixSafe) {
  const extend = function extend() {
    let target = arguments[0] || {};
    let i = 1;
    const length = arguments.length;
    if (length === 1) {
      target = this;
      i = 0;
    }
    for (; i < length; i++) {
      const options = arguments[i];
      if (!options) continue;
      for (const name in options) {
        if (name === '__proto__') continue;
        const src = target[name];
        const copy = options[name];
        if (target === copy || copy === undefined) continue;
        if (Util.isArray(copy) || Util.isObject(copy)) {
          let clone;
          if (Util.isArray(copy)) clone = src && Util.isArray(src) ? src : [];
          if (Util.isObject(copy)) clone = src && Util.isObject(src) ? src : {};
          target[name] = Util.extend(clone, copy);
        } else {
          target[name] = copy;
        }
      }
    }
    return target;
  };
  extend.yapixSafe = true;
  Util.extend = extend;
}

module.exports = Mock;
