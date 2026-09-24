import { allowedOrigins, originOf, setAllowed } from './sites.js';

const $ = id => document.getElementById(id);

async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function render() {
  const tab = await currentTab();
  const origin = tab && originOf(tab.url);
  const origins = await allowedOrigins();

  if (origin) {
    const allowed = origins.includes(origin);
    $('origin').textContent = origin;
    $('state').textContent = allowed ? 'Yapix can send test requests from this site.' : 'Not allowed.';
    $('toggle').textContent = allowed ? 'Stop allowing this site' : 'Allow this site';
    $('toggle').className = allowed ? 'secondary' : 'primary';
    $('toggle').hidden = false;
    $('toggle').onclick = async () => {
      await setAllowed(origin, !allowed);
      await chrome.tabs.reload(tab.id);
      render();
    };
  } else {
    $('origin').textContent = '—';
    $('state').textContent = 'Only http and https pages can be allowed.';
    $('toggle').hidden = true;
  }

  const list = $('list');
  list.textContent = '';
  for (const o of origins) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = o;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'link';
    remove.textContent = 'Remove';
    remove.onclick = async () => {
      await setAllowed(o, false);
      render();
    };
    li.append(name, remove);
    list.append(li);
  }
  $('empty').hidden = origins.length > 0;
}

render();
