// Shared helpers for the end-to-end tests: a result counter and a small HTTP client with a cookie jar.
/* eslint-disable no-console */

export function setup(base) {
  let failed = 0;
  let passed = 0;
  function check(name, ok, detail) {
    if (ok) {
      passed++;
      console.log(`ok   ${name}`);
    } else {
      failed++;
      console.log(`FAIL ${name}${detail === undefined ? '' : ': ' + JSON.stringify(detail).slice(0, 400)}`);
    }
    return ok;
  }

  // A tiny HTTP client with its own cookie jar, one per signed-in user
  class Client {
    constructor() {
      this.cookies = new Map();
    }
    async request(method, path, body, { raw = false, headers = {} } = {}) {
      const opts = { method, headers: { ...headers }, redirect: 'manual' };
      if (this.cookies.size) opts.headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
      if (body !== undefined) {
        if (typeof body === 'string') opts.body = body;
        else {
          opts.body = JSON.stringify(body);
          opts.headers['content-type'] = 'application/json';
        }
      }
      const res = await fetch(base + path, opts);
      for (const line of res.headers.getSetCookie()) {
        const [pair] = line.split(';');
        const i = pair.indexOf('=');
        this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
      }
      const text = await res.text();
      if (raw) return { status: res.status, text, headers: res.headers };
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = { errcode: -1, errmsg: 'not json', text: text.slice(0, 200) };
      }
      return json;
    }
    get(path, opts) {
      return this.request('GET', path, undefined, opts);
    }
    post(path, body, opts) {
      return this.request('POST', path, body, opts);
    }
  }

  const ok = r => r && r.errcode === 0;

  function summary() {
    console.log(`
${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  }

  return { check, ok, Client, summary };
}
