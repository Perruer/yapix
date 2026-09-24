// Browser test for the Yapix Request Helper extension (extension/).
// Usage: CHROME_PATH=<Chrome for Testing or Chromium> node test/e2e/extension.mjs http://127.0.0.1:3000
// Branded Google Chrome ignores --load-extension; use Chrome for Testing or Playwright's Chromium.
// The Yapix server must be running at the given address.
/* eslint-disable no-console */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { setup } from './lib.mjs';

const base = (process.argv[2] || 'http://127.0.0.1:3000').replace(/\/$/, '');
const extensionDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../extension');
const { check, summary } = setup(base);

// A target API that sends no CORS headers, so only the extension can read its responses.
function startEchoServer() {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      if (req.url.startsWith('/missing')) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        return res.end('not here');
      }
      res.writeHead(200, { 'content-type': 'application/json', 'x-echo': 'yes' });
      res.end(JSON.stringify({ method: req.method, url: req.url, headers: req.headers, body }));
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// Calls window.crossRequest in the page and returns what the callbacks received.
const callInPage = (page, options) =>
  page.evaluate(
    opts =>
      new Promise(resolve => {
        const done = kind => (body, header, data) =>
          resolve({ kind, body, header, status: data.res.status, statusIsNaN: Number.isNaN(data.res.status), runTime: data.runTime });
        window.crossRequest(Object.assign({}, opts, { success: done('success'), error: done('error') }));
      }),
    options
  );

async function main() {
  if (!process.env.CHROME_PATH) throw new Error('CHROME_PATH is required');
  const echo = await startEchoServer();
  const target = `http://127.0.0.1:${echo.address().port}`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yapix-ext-'));
  const context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.CHROME_PATH,
    headless: process.env.HEADED !== '1',
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`]
  });
  try {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    check('the extension loads', !!extensionId);

    // Nothing is injected before the site is allowed.
    const page = await context.newPage();
    await page.goto(base + '/');
    check('not active on a site that was not allowed', (await page.evaluate(() => typeof window.crossRequest)) === 'undefined');

    // Allow the Yapix site the way the popup does.
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.evaluate(async origin => {
      const sites = await import('./sites.js');
      await sites.setAllowed(origin, true);
    }, new URL(base).origin);
    await popup.reload();
    check('the popup lists the allowed site', (await popup.textContent('#list')).includes(new URL(base).origin));

    await page.reload();
    const version = await page.evaluate(() => window.crossRequest && window.crossRequest.yapix && window.crossRequest.version);
    check('window.crossRequest is defined on the allowed site', !!version, version);

    let r = await callInPage(page, { url: `${target}/items?q=1`, method: 'GET', headers: { 'X-Test': 'a' } });
    let echoed = r.kind === 'success' && JSON.parse(r.body);
    check('GET across origins without CORS headers', echoed && echoed.method === 'GET' && echoed.url === '/items?q=1' && echoed.headers['x-test'] === 'a', r);
    check('response headers and run time are passed back', r.header && r.header['x-echo'] === 'yes' && typeof r.runTime === 'number', r);

    r = await callInPage(page, { url: `${target}/items`, method: 'POST', headers: {}, data: { name: 'tom', n: 1 } });
    echoed = r.kind === 'success' && JSON.parse(r.body);
    check('an object body is sent as JSON', echoed && echoed.body === '{"name":"tom","n":1}' && /application\/json/.test(echoed.headers['content-type']), r);

    r = await callInPage(page, {
      url: `${target}/form`,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: { a: '1', b: 'x y' }
    });
    echoed = r.kind === 'success' && JSON.parse(r.body);
    check('a form body is url-encoded', echoed && echoed.body === 'a=1&b=x+y', r);

    r = await callInPage(page, { url: `${target}/raw`, method: 'PUT', headers: { 'Content-Type': 'text/plain' }, data: 'hello' });
    echoed = r.kind === 'success' && JSON.parse(r.body);
    check('a string body is sent as is', echoed && echoed.method === 'PUT' && echoed.body === 'hello', r);

    r = await callInPage(page, { url: `${target}/missing`, method: 'GET', headers: {} });
    check('HTTP errors come back as responses', r.kind === 'success' && r.status === 404 && r.body === 'not here', r);

    echo.close();
    r = await callInPage(page, { url: `${target}/gone`, method: 'GET', headers: {} });
    check('network errors reach the error callback with a NaN status', r.kind === 'error' && r.statusIsNaN, r);

    r = await callInPage(page, { url: 'file:///C:/Windows/win.ini', method: 'GET', headers: {} });
    check('non-http URLs are refused', r.kind === 'error', r);

    // The Yapix UI: send a request from an interface's Run tab to its mock.
    if (process.env.ADMIN_PASSWORD) await runTabFlow(context);

    // Stop allowing: the page loses window.crossRequest.
    await popup.evaluate(async origin => {
      const sites = await import('./sites.js');
      await sites.setAllowed(origin, false);
    }, new URL(base).origin);
    await page.reload();
    check('removing the site turns the helper off', (await page.evaluate(() => typeof window.crossRequest)) === 'undefined');
  } finally {
    await context.close();
    echo.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

async function runTabFlow(context) {
  const { Client, ok } = setup(base);
  const admin = new Client();
  let r = await admin.post('/api/user/login', { email: process.env.ADMIN_EMAIL || 'admin@admin.com', password: process.env.ADMIN_PASSWORD });
  if (!check('admin login for the UI test', ok(r), r)) return;
  const stamp = Date.now().toString(36);
  r = await admin.post('/api/group/add', { group_name: `ext-${stamp}`, group_desc: 'extension test', owner_uids: [] });
  const groupId = r.data._id;
  r = await admin.post('/api/project/add', { name: `ext-${stamp}`, basepath: `/ext${stamp}`, group_id: groupId, project_type: 'private' });
  const projectId = r.data._id;
  await admin.post('/api/project/up_env', {
    id: projectId,
    env: [{ name: 'mock', domain: `${base}/mock/${projectId}`, header: [], global: [] }]
  });
  r = await admin.get(`/api/interface/getCatMenu?project_id=${projectId}`);
  r = await admin.post('/api/interface/add', {
    project_id: projectId,
    catid: r.data[0]._id,
    title: 'ping',
    path: '/ping',
    method: 'GET',
    res_body_type: 'json',
    res_body: JSON.stringify({ pong: 'from-mock' })
  });
  const interfaceId = r.data._id;

  const url = new URL(base);
  await context.addCookies(
    [...admin.cookies].map(([name, value]) => ({ name, value, domain: url.hostname, path: '/' }))
  );
  const page = await context.newPage();
  await page.goto(`${base}/project/${projectId}/interface/api/${interfaceId}`);
  await page.locator('.ant-tabs-tab', { hasText: '运行' }).click();
  await page.locator('button', { hasText: /发\s*送/ }).click();
  const shown = await page
    .waitForFunction(() => document.body.innerText.includes('from-mock'), null, { timeout: 15000 })
    .then(() => true, () => false);
  check('the Run tab sends the request through the extension and shows the response', shown);

  await admin.post('/api/project/del', { id: projectId });
  await admin.post('/api/group/del', { id: groupId });
  await page.close();
}

main()
  .catch(err => check('no unexpected error', false, err && err.stack))
  .finally(summary);
