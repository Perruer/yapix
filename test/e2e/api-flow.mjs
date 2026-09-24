// End-to-end API test against a running server (Yapix, or YApi 1.12 to confirm the test itself).
// Usage: ADMIN_PASSWORD=... node test/e2e/api-flow.mjs http://127.0.0.1:3000
// Env: ADMIN_EMAIL (default admin@admin.com), ADMIN_PASSWORD (required).
// The server must allow registration (closeRegister: false) so a second user can be created.
/* eslint-disable no-console */

const base = (process.argv[2] || 'http://127.0.0.1:3000').replace(/\/$/, '');
const adminEmail = process.env.ADMIN_EMAIL || 'admin@admin.com';
const adminPassword = process.env.ADMIN_PASSWORD;
if (!adminPassword) {
  console.error('ADMIN_PASSWORD is required');
  process.exit(2);
}

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
const stamp = Date.now().toString(36);

async function main() {
  const admin = new Client();
  const user = new Client();

  // --- users
  let r = await admin.post('/api/user/login', { email: adminEmail, password: adminPassword });
  check('admin login', ok(r), r);
  check('wrong password is rejected', !ok(await new Client().post('/api/user/login', { email: adminEmail, password: adminPassword + 'x' })));
  r = await admin.get('/api/user/status');
  check('status shows the admin', ok(r) && r.data.role === 'admin', r);

  const userEmail = `dev-${stamp}@example.com`;
  r = await user.post('/api/user/reg', { email: userEmail, password: 'Dev-pass-1', username: `dev-${stamp}` });
  check('register a user', ok(r), r);
  const userId = r.data && r.data.uid;
  r = await user.get('/api/user/status');
  check('registered user is signed in', ok(r) && r.data.email === userEmail, r);

  // --- group
  r = await admin.post('/api/group/add', { group_name: `group-${stamp}`, group_desc: 'e2e', owner_uids: [] });
  check('add group', ok(r), r);
  const groupId = r.data && r.data._id;
  r = await admin.get('/api/group/list');
  check('group list contains the group', ok(r) && r.data.some(g => g._id === groupId), r);
  r = await admin.post('/api/group/add_member', { id: groupId, member_uids: [userId], role: 'dev' });
  check('add member to group', ok(r), r);
  r = await admin.get(`/api/group/get_member_list?id=${groupId}`);
  check('group member list', ok(r) && r.data.some(m => m.uid === userId && m.role === 'dev'), r);

  // --- project
  const basepath = `/p${stamp}`;
  r = await user.post('/api/project/add', { name: `project-${stamp}`, basepath, group_id: groupId, project_type: 'private' });
  check('member adds a project', ok(r), r);
  const projectId = r.data && r.data._id;
  r = await user.get(`/api/project/get?id=${projectId}`);
  check('get project', ok(r) && r.data.basepath === basepath, r);
  r = await user.get(`/api/project/check_project_name?name=project-${stamp}&group_id=${groupId}`);
  check('duplicate project name is reported', !ok(r), r);
  r = await user.post('/api/project/up', { id: projectId, desc: 'updated by e2e', name: `project-${stamp}` });
  check('update project', ok(r), r);
  const mockDomain = `${base}/mock/${projectId}`;
  r = await user.post('/api/project/up_env', {
    id: projectId,
    env: [{ name: 'mock', domain: mockDomain, header: [], global: [] }]
  });
  check('update project environments', ok(r), r);
  r = await user.get(`/api/project/get_env?project_id=${projectId}`);
  check('get project environments', ok(r) && JSON.stringify(r.data).includes(mockDomain), r);
  r = await user.get(`/api/project/token?project_id=${projectId}`);
  check('project token', ok(r) && typeof r.data === 'string' && r.data.length > 10, r);
  const token = r.data;
  r = await user.get(`/api/project/list?group_id=${groupId}`);
  check('project list', ok(r) && r.data.list.some(p => p._id === projectId), r);

  // --- categories and interfaces
  r = await user.get(`/api/interface/getCatMenu?project_id=${projectId}`);
  check('default category exists', ok(r) && r.data.length >= 1, r);
  r = await user.post('/api/interface/add_cat', { project_id: projectId, name: 'e2e', desc: 'e2e category' });
  check('add category', ok(r), r);
  const catId = r.data && r.data._id;

  r = await user.post('/api/interface/add', {
    project_id: projectId,
    catid: catId,
    title: 'get user',
    path: '/users/{id}',
    method: 'GET',
    req_params: [{ name: 'id', desc: 'user id' }],
    res_body_type: 'json',
    res_body: JSON.stringify({ id: 1, name: 'alice' })
  });
  check('add GET interface', ok(r), r);
  const getId = r.data && r.data._id;

  const schema = {
    type: 'object',
    properties: { code: { type: 'integer', minimum: 0, maximum: 0 }, token: { type: 'string', minLength: 8 } },
    required: ['code', 'token']
  };
  r = await user.post('/api/interface/add', {
    project_id: projectId,
    catid: catId,
    title: 'login',
    path: '/login',
    method: 'POST',
    req_body_type: 'json',
    req_body_is_json_schema: false,
    req_body_other: JSON.stringify({ user: 'alice', password: 'x' }),
    res_body_type: 'json',
    res_body_is_json_schema: true,
    res_body: JSON.stringify(schema)
  });
  check('add POST interface with a JSON schema response', ok(r), r);
  const postId = r.data && r.data._id;

  r = await user.get(`/api/interface/get?id=${getId}`);
  check('get interface', ok(r) && r.data.path === '/users/{id}', r);
  r = await user.post('/api/interface/up', { id: getId, title: 'get user by id', res_body: JSON.stringify({ id: 1, name: 'bob' }) });
  check('update interface', ok(r), r);
  r = await user.get(`/api/interface/list?project_id=${projectId}&page=1&limit=20`);
  check('interface list', ok(r) && r.data.count === 2, r);
  r = await user.get(`/api/interface/list_menu?project_id=${projectId}`);
  check('interface menu', ok(r) && r.data.some(c => c._id === catId && c.list.length === 2), r);

  // --- mock server
  r = await new Client().get(`/mock/${projectId}${basepath}/users/7`);
  check('mock returns the example response', r && r.name === 'bob', r);
  r = await new Client().post(`/mock/${projectId}${basepath}/login`, { user: 'alice', password: 'x' });
  check('mock generates data from a JSON schema', r && r.code === 0 && typeof r.token === 'string' && r.token.length >= 8, r);
  r = await new Client().get(`/mock/${projectId}${basepath}/missing`);
  check('mock reports a missing interface', r && r.errcode !== 0, r);

  return { admin, user, userId, groupId, projectId, basepath, catId, getId, postId, token, mockDomain };
}

main()
  .then(async ctx => {
    if (process.env.E2E_STAGE_2 !== '0') {
      const { more } = await import('./api-flow-more.mjs');
      await more(ctx, { check, ok, base, Client });
    }
  })
  .catch(err => {
    failed++;
    console.log('FAIL unexpected error:', err && err.stack);
  })
  .finally(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  });
