// Runs in the page on allowed Yapix sites and defines window.crossRequest(options), the function
// Yapix (and YApi before it) calls to send API test requests. It keeps YApi's calling convention:
//   options: { url, method, headers, data, files, file, timeout, success, error }
//   success(body, headers, data) / error(body, headers, data), data = { req, res: { body, header, status, statusText }, runTime }
(() => {
  if (window.crossRequest) return;

  const VERSION = '1.0.0';
  const pending = new Map();
  let seq = 0;

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const msg = event.data;
    if (!msg || msg.source !== 'yapix-extension') return;
    const done = pending.get(msg.id);
    if (!done) return;
    pending.delete(msg.id);
    done(msg.result || { error: 'no response from the extension' });
  });

  function contentType(headers) {
    for (const name of Object.keys(headers)) {
      if (name.toLowerCase() === 'content-type') return String(headers[name] || '').toLowerCase();
    }
    return '';
  }

  function toBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  function inputFiles(id) {
    const el = document.getElementById(id);
    return el && el.files ? Array.from(el.files) : [];
  }

  async function describeBody(options, headers) {
    const data = options.data;
    if (options.file) {
      const [file] = inputFiles(options.file);
      if (file) return { kind: 'binary', type: file.type, data: toBase64(await file.arrayBuffer()) };
    }
    const fileFields = options.files && typeof options.files === 'object' ? options.files : null;
    if (fileFields && Object.keys(fileFields).length) {
      const files = [];
      for (const [field, id] of Object.entries(fileFields)) {
        for (const file of inputFiles(id)) {
          files.push({ field, name: file.name, type: file.type, data: toBase64(await file.arrayBuffer()) });
        }
      }
      return { kind: 'multipart', fields: data && typeof data === 'object' ? data : {}, files };
    }
    if (data === undefined || data === null || data === '') return null;
    if (typeof data !== 'object') return { kind: 'text', text: String(data) };
    const type = contentType(headers);
    if (type.indexOf('application/x-www-form-urlencoded') === 0) return { kind: 'urlencoded', fields: data };
    if (type.indexOf('multipart/form-data') === 0) return { kind: 'multipart', fields: data, files: [] };
    if (!type) headers['Content-Type'] = 'application/json;charset=UTF-8';
    return { kind: 'text', text: JSON.stringify(data) };
  }

  function crossRequest(options) {
    options = options || {};
    const started = Date.now();
    const headers = Object.assign({}, options.headers);
    const id = ++seq;

    const finish = result => {
      if (result.error) {
        const data = {
          req: options,
          res: { body: result.error, header: {}, status: NaN, statusText: result.error },
          runTime: Date.now() - started
        };
        (options.error || options.success || function () {})(result.error, {}, data);
        return;
      }
      const data = {
        req: options,
        res: { body: result.body, header: result.headers, status: result.status, statusText: result.statusText },
        runTime: result.runTime
      };
      (options.success || function () {})(result.body, result.headers, data);
    };

    describeBody(options, headers).then(
      body => {
        pending.set(id, finish);
        window.postMessage(
          {
            source: 'yapix-page',
            type: 'request',
            id,
            request: { url: options.url, method: options.method || 'GET', headers, body, timeout: options.timeout }
          },
          location.origin
        );
      },
      err => finish({ error: String((err && err.message) || err) })
    );
  }

  crossRequest.version = VERSION;
  crossRequest.yapix = true;
  Object.defineProperty(window, 'crossRequest', { value: crossRequest, writable: false, configurable: false });
})();
