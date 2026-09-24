// Upgrade test: fill a database with YApi 1.12, then check that Yapix serves the same data.
// Usage:
//   ADMIN_PASSWORD=... node test/e2e/upgrade.mjs seed  http://127.0.0.1:3201 state.json   (YApi 1.12)
//   ADMIN_PASSWORD=... node test/e2e/upgrade.mjs check http://127.0.0.1:3300 state.json   (Yapix, same database)
/* eslint-disable no-console */
import fs from 'node:fs';
import { setup } from './lib.mjs';

const [mode, baseArg, stateFile] = process.argv.slice(2);
if (!['seed', 'check'].includes(mode) || !baseArg || !stateFile) {
  console.error('usage: upgrade.mjs seed|check <base url> <state file>');
  process.exit(2);
}
const base = baseArg.replace(/\/$/, '');
const adminEmail = process.env.ADMIN_EMAIL || 'admin@admin.com';
const adminPassword = process.env.ADMIN_PASSWORD;
if (!adminPassword) {
  console.error('ADMIN_PASSWORD is required');
  process.exit(2);
}

const { check, ok, Client, summary } = setup(base);

async function seed() {
  const stamp = Date.now().toString(36);
  const admin = new Client();
  const user = new Client();
  let r = await admin.post('/api/user/login', { email: adminEmail, password: adminPassword });
  check('admin login', ok(r), r);

  const email = `old-${stamp}@example.com`;
  const password = 'Old-pass-1';
  r = await user.post('/api/user/reg', { email, password, username: `old-${stamp}` });
  check('register a user', ok(r), r);
  const userId = r.data && r.data.uid;

  r = await admin.post('/api/group/add', { group_name: `old-group-${stamp}`, group_desc: 'upgrade', owner_uids: [] });
  check('add group', ok(r), r);
  const groupId = r.data && r.data._id;
  r = await admin.post('/api/group/add_member', { id: groupId, member_uids: [userId], role: 'owner' });
  check('add member', ok(r), r);

  const basepath = `/old${stamp}`;
  r = await user.post('/api/project/add', { name: `old-project-${stamp}`, basepath, group_id: groupId, project_type: 'private' });
  check('add project', ok(r), r);
  const projectId = r.data && r.data._id;

  r = await user.get(`/api/project/token?project_id=${projectId}`);
  check('project token', ok(r) && typeof r.data === 'string', r);
  const token = r.data;

  r = await user.post('/api/interface/add_cat', { project_id: projectId, name: 'old', desc: 'upgrade' });
  check('add category', ok(r), r);
  const catId = r.data && r.data._id;
  r = await user.post('/api/interface/add', {
    project_id: projectId,
    catid: catId,
    title: 'old interface',
    path: '/things/{id}',
    method: 'GET',
    req_params: [{ name: 'id', desc: 'id' }],
    res_body_type: 'json',
    res_body: JSON.stringify({ id: 1, kind: 'old' })
  });
  check('add interface', ok(r), r);
  const interfaceId = r.data && r.data._id;

  r = await user.post('/api/col/add_col', { project_id: projectId, name: 'old collection', desc: 'upgrade' });
  check('add test collection', ok(r), r);
  const colId = r.data && r.data._id;
  r = await user.post('/api/col/add_case', {
    project_id: projectId,
    interface_id: interfaceId,
    col_id: colId,
    casename: 'old case',
    case_env: '',
    req_params: [{ name: 'id', value: '5' }],
    req_headers: [],
    req_query: []
  });
  check('add test case', ok(r), r);
  const caseId = r.data && r.data._id;

  const state = { email, password, userId, groupId, projectId, basepath, token, catId, interfaceId, colId, caseId };
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  console.log('state written to', stateFile);
}

async function verify() {
  const s = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  const admin = new Client();
  const user = new Client();
  let r = await admin.post('/api/user/login', { email: adminEmail, password: adminPassword });
  check('admin still logs in', ok(r), r);
  r = await user.post('/api/user/login', { email: s.email, password: s.password });
  check('old user logs in with the old password', ok(r) && r.data.uid === s.userId, r);

  r = await user.get(`/api/project/get?id=${s.projectId}`);
  check('old project is there', ok(r) && r.data.basepath === s.basepath, r);
  r = await user.get(`/api/interface/get?id=${s.interfaceId}`);
  check('old interface is there', ok(r) && r.data.title === 'old interface', r);
  r = await user.get(`/api/col/case_list?col_id=${s.colId}`);
  check('old test case is there', ok(r) && r.data.some(c => c._id === s.caseId), r);

  r = await new Client().get(`/api/interface/list_menu?token=${s.token}&project_id=${s.projectId}`);
  check('token issued by YApi still works', ok(r) && JSON.stringify(r.data).includes('old interface'), r);
  r = await user.get(`/api/project/token?project_id=${s.projectId}`);
  check('the project token is unchanged', ok(r) && r.data === s.token, r);

  r = await new Client().request('GET', `/mock/${s.projectId}${s.basepath}/things/5`, undefined, { raw: true });
  check('old interface is mocked', r.status === 200 && JSON.parse(r.text).kind === 'old', r.text.slice(0, 200));

  // New documents continue the old numeric id sequences.
  r = await user.post('/api/interface/add', {
    project_id: s.projectId,
    catid: s.catId,
    title: 'new interface',
    path: '/things',
    method: 'POST',
    res_body_type: 'json',
    res_body: '{}'
  });
  check('add an interface after the upgrade', ok(r) && r.data._id > s.interfaceId, r);
  const newId = r.data && r.data._id;
  r = await user.post('/api/project/add', {
    name: `new-project-${Date.now().toString(36)}`,
    basepath: `/new${Date.now().toString(36)}`,
    group_id: s.groupId,
    project_type: 'private'
  });
  check('add a project after the upgrade', ok(r) && r.data._id > s.projectId, r);
  if (ok(r)) await user.post('/api/project/del', { id: r.data._id });
  if (newId) await user.post('/api/interface/del', { id: newId });
}

(mode === 'seed' ? seed() : verify())
  .catch(err => check('no unexpected error', false, err && err.stack))
  .finally(summary);
