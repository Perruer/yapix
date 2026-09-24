// Second part of the end-to-end API test: mock expectations, test collections, the open API,
// built-in plugins, logs, follows and clean-up.
/* eslint-disable no-console */

const swagger = {
  swagger: '2.0',
  info: { title: 'imported', version: '1.0.0' },
  basePath: '/',
  paths: {
    '/orders': {
      get: { tags: ['orders'], summary: 'list orders', responses: { 200: { description: 'ok' } } }
    },
    '/orders/{id}': {
      delete: {
        tags: ['orders'],
        summary: 'delete order',
        parameters: [{ name: 'id', in: 'path', required: true, type: 'integer' }],
        responses: { 200: { description: 'ok' } }
      }
    }
  }
};

export async function more(ctx, { check, ok, Client }) {
  const { admin, user, userId, groupId, projectId, basepath, getId, postId, token } = ctx;
  const anon = () => new Client();
  let r;

  // --- mock expectations
  r = await user.post('/api/plugin/advmock/case/save', {
    project_id: projectId,
    interface_id: getId,
    name: 'admin role',
    params: { role: 'admin' },
    res_body: JSON.stringify({ expected: true }),
    code: 200,
    ip_enable: false
  });
  check('save a mock expectation', ok(r), r);
  r = await user.get(`/api/plugin/advmock/case/list?interface_id=${getId}`);
  check('list mock expectations', ok(r) && r.data.length === 1, r);

  // --- test collections
  r = await user.post('/api/col/add_col', { project_id: projectId, name: 'smoke', desc: 'e2e' });
  check('add a test collection', ok(r), r);
  const colId = r.data && r.data._id;
  r = await user.post('/api/col/add_case', {
    project_id: projectId,
    interface_id: postId,
    col_id: colId,
    casename: 'login',
    case_env: 'mock',
    req_params: [],
    req_headers: [{ name: 'Content-Type', value: 'application/json' }],
    req_query: [],
    req_body_type: 'json',
    req_body_other: JSON.stringify({ user: 'alice', password: 'x' })
  });
  check('add a test case', ok(r), r);
  const caseId = r.data && r.data._id;
  r = await user.get(`/api/col/case_list?col_id=${colId}`);
  check('list test cases', ok(r) && r.data.length === 1, r);
  r = await user.post('/api/col/up_case', { id: caseId, casename: 'login (updated)' });
  check('update a test case', ok(r), r);
  r = await user.get(`/api/col/case?caseid=${caseId}`);
  check('get a test case', ok(r) && r.data.casename === 'login (updated)', r);

  // --- open API (project token)
  if (token) {
    r = await anon().get(`/api/open/project_interface_data?token=${token}&project_id=${projectId}`);
    check('open API lists interfaces with the project token', ok(r) && Array.isArray(r.data), r);
    r = await anon().post('/api/open/import_data', {
      type: 'swagger',
      json: JSON.stringify(swagger),
      project_id: projectId,
      merge: 'normal',
      token
    });
    check('open API imports a Swagger document', ok(r), r);
    r = await user.get(`/api/interface/list?project_id=${projectId}&page=1&limit=50`);
    check('imported interfaces are listed', ok(r) && r.data.count === 4, r && r.data && r.data.count);
  } else {
    check('project token is available for the open API', false, 'no token');
  }

  // --- built-in plugins
  r = await user.get(`/api/plugin/export?type=json&pid=${projectId}&status=all`, { raw: true });
  check('export project data as JSON', r.status === 200 && r.text.includes('/users/{id}'), r.text && r.text.slice(0, 200));
  r = await user.get(`/api/plugin/export?type=markdown&pid=${projectId}&status=all`, { raw: true });
  check('export project data as markdown', r.status === 200 && r.text.includes('/login'), r.text && r.text.slice(0, 200));
  r = await user.get(`/api/plugin/exportSwagger?type=OpenAPIV2&pid=${projectId}&status=all`, { raw: true });
  check('export project data as Swagger 2.0', r.status === 200 && r.text.includes('"swagger"'), r.text && r.text.slice(0, 200));
  r = await user.post('/api/plugin/wiki_desc/up', { project_id: projectId, desc: '<p>notes</p>', markdown: 'notes' });
  check('save the project wiki', ok(r), r);
  r = await user.get(`/api/plugin/wiki_desc/get?project_id=${projectId}`);
  check('read the project wiki', ok(r) && r.data && r.data.markdown === 'notes', r);
  r = await admin.get('/api/plugin/statismock/count');
  check('statistics for admins', ok(r) && r.data.interfaceCount >= 2, r);

  // --- logs, follows, search
  r = await user.get(`/api/log/list?typeid=${projectId}&type=project&page=1&limit=10`);
  check('project log has entries', ok(r) && r.data.total > 0, r);
  r = await user.post('/api/follow/add', { projectid: projectId });
  check('follow a project', ok(r), r);
  r = await user.get('/api/follow/list');
  check('follow list contains the project', ok(r) && r.data.list.some(f => f.projectid === projectId), r);
  r = await user.post('/api/follow/del', { projectid: projectId });
  check('unfollow a project', ok(r), r);
  r = await user.get(`/api/project/search?q=${encodeURIComponent('project-')}`);
  check('search finds the project', ok(r) && r.data.project.some(p => p._id === projectId), r);

  // --- clean-up
  r = await user.get(`/api/col/del_case?caseid=${caseId}`);
  check('delete a test case', ok(r), r);
  r = await user.get(`/api/col/del_col?col_id=${colId}`);
  check('delete a test collection', ok(r), r);
  r = await user.post('/api/interface/del', { id: getId });
  check('delete an interface', ok(r), r);
  r = await admin.post('/api/project/del', { id: projectId });
  check('delete the project', ok(r), r);
  r = await admin.post('/api/group/del', { id: groupId });
  check('delete the group', ok(r), r);
  r = await admin.post('/api/user/del', { id: userId });
  check('delete the user', ok(r), r);
  r = await user.get('/api/user/status');
  check('deleted user is signed out', !ok(r), r);
}
