// Runs in the extension's isolated world on allowed sites: passes requests from page.js to the
// background worker and the results back.
window.addEventListener('message', async event => {
  if (event.source !== window || event.origin !== location.origin) return;
  const msg = event.data;
  if (!msg || msg.source !== 'yapix-page' || msg.type !== 'request') return;
  let result;
  try {
    result = await chrome.runtime.sendMessage({ type: 'request', request: msg.request });
  } catch (err) {
    result = { error: String((err && err.message) || err) };
  }
  window.postMessage({ source: 'yapix-extension', id: msg.id, result }, location.origin);
});
