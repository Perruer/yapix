// The list of Yapix sites the user allowed, and the content scripts registered for them.
// Nothing runs on a site until the user allows it in the popup.

const KEY = 'allowedOrigins';
const SCRIPT_PREFIX = 'yapix-';

export async function allowedOrigins() {
  const data = await chrome.storage.local.get(KEY);
  return Array.isArray(data[KEY]) ? data[KEY] : [];
}

export function originOf(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.origin;
  } catch (e) {
    return null;
  }
}

function scriptsFor(origin, index) {
  const matches = [origin + '/*'];
  return [
    {
      id: `${SCRIPT_PREFIX}${index}-page`,
      matches,
      js: ['page.js'],
      runAt: 'document_start',
      world: 'MAIN',
      persistAcrossSessions: true
    },
    {
      id: `${SCRIPT_PREFIX}${index}-bridge`,
      matches,
      js: ['bridge.js'],
      runAt: 'document_start',
      world: 'ISOLATED',
      persistAcrossSessions: true
    }
  ];
}

// Re-register the content scripts so they match exactly the allowed origins.
export async function syncScripts() {
  const origins = await allowedOrigins();
  const existing = await chrome.scripting.getRegisteredContentScripts();
  const ours = existing.filter(s => s.id.startsWith(SCRIPT_PREFIX)).map(s => s.id);
  if (ours.length) await chrome.scripting.unregisterContentScripts({ ids: ours });
  const scripts = origins.flatMap((origin, i) => scriptsFor(origin, i));
  if (scripts.length) await chrome.scripting.registerContentScripts(scripts);
}

export async function setAllowed(origin, allowed) {
  const origins = new Set(await allowedOrigins());
  if (allowed) origins.add(origin);
  else origins.delete(origin);
  await chrome.storage.local.set({ [KEY]: [...origins].sort() });
  await syncScripts();
}
