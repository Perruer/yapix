// Sends API test requests for allowed Yapix sites. The page cannot do this itself because of CORS;
// the extension has host permissions, so its fetch is not limited by CORS.
import { allowedOrigins, syncScripts } from './sites.js';

const MAX_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_BODY_CHARS = 20 * 1024 * 1024;

chrome.runtime.onInstalled.addListener(() => syncScripts());
chrome.runtime.onStartup.addListener(() => syncScripts());

function decodeBase64(text) {
  const bin = atob(text);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function buildBody(body) {
  if (!body) return undefined;
  switch (body.kind) {
    case 'text':
      return String(body.text);
    case 'urlencoded':
      return new URLSearchParams(body.fields).toString();
    case 'binary':
      return new Blob([decodeBase64(body.data)], { type: body.type || 'application/octet-stream' });
    case 'multipart': {
      const form = new FormData();
      for (const [name, value] of Object.entries(body.fields || {})) form.append(name, String(value));
      for (const file of body.files || []) {
        form.append(file.field, new Blob([decodeBase64(file.data)], { type: file.type }), file.name);
      }
      return form;
    }
    default:
      throw new Error('unknown body kind: ' + body.kind);
  }
}

async function send(request) {
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('only http and https URLs can be requested');
  }
  const headers = new Headers();
  const skipped = [];
  for (const [name, value] of Object.entries(request.headers || {})) {
    if (value === undefined || value === null || value === '') continue;
    try {
      headers.set(name, String(value));
    } catch (e) {
      skipped.push(name);
    }
  }
  // multipart bodies need the boundary that fetch generates
  if (request.body && request.body.kind === 'multipart') headers.delete('content-type');

  const method = String(request.method || 'GET').toUpperCase();
  const controller = new AbortController();
  const timeout = Math.min(Number(request.timeout) || 60000, MAX_TIMEOUT_MS);
  const timer = setTimeout(() => controller.abort(), timeout);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : buildBody(request.body),
      credentials: 'include',
      redirect: 'follow',
      signal: controller.signal
    });
    let text = await res.text();
    if (text.length > MAX_BODY_CHARS) text = text.slice(0, MAX_BODY_CHARS);
    const responseHeaders = {};
    res.headers.forEach((value, name) => {
      responseHeaders[name] = value;
    });
    return {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
      body: text,
      runTime: Date.now() - started,
      skippedHeaders: skipped
    };
  } finally {
    clearTimeout(timer);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'request' || sender.id !== chrome.runtime.id) return false;
  (async () => {
    const origins = await allowedOrigins();
    if (!sender.origin || !origins.includes(sender.origin)) {
      return { error: 'This site is not allowed in Yapix Request Helper.' };
    }
    try {
      return await send(message.request);
    } catch (err) {
      return { error: err && err.name === 'AbortError' ? 'Request timed out' : String((err && err.message) || err) };
    }
  })().then(sendResponse);
  return true;
});
