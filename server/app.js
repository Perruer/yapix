process.env.NODE_PATH = __dirname;
require('module').Module._initPaths();

const yapi = require('./yapi.js');
const commons = require('./utils/commons');
yapi.commons = commons;
const dbModule = require('./utils/db.js');
yapi.connect = dbModule.connect();
const mockServer = require('./middleware/mockServer.js');
require('./plugin.js');
const websockify = require('koa-websocket');
const websocket = require('./websocket.js');
const storageCreator = require('./utils/storage')
require('./utils/notice')

const Koa = require('koa');
const koaStatic = require('koa-static');
const { koaBody } = require('koa-body');
const router = require('./router.js');

global.storageCreator = storageCreator;

const app = websockify(new Koa());
app.proxy = true;
yapi.app = app;

app.use(
  koaBody({
    // Mock APIs accept a body with any method, as YApi did.
    parsedMethods: ['POST', 'PUT', 'PATCH', 'DELETE', 'GET', 'HEAD'],
    multipart: true,
    jsonLimit: '2mb',
    formLimit: '1mb',
    textLimit: '1mb'
  })
);
app.use(mockServer);
app.use(router.routes());
app.use(router.allowedMethods());

websocket(app);

app.use(async (ctx, next) => {
  if (/^\/(?!api)[a-zA-Z0-9\/\-_]*$/.test(ctx.path)) {
    ctx.path = '/';
    await next();
  } else {
    await next();
  }
});

// Built files carry a content hash in their names and can be cached for good; koa-static serves the
// precompressed .gz copies itself.
const HASHED_ASSET = /^\/prd\/[^/]+\.[0-9a-f]{8}\.[a-z0-9]+$/;
app.use(async (ctx, next) => {
  await next();
  if (HASHED_ASSET.test(ctx.path)) {
    ctx.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (ctx.path === '/' || ctx.path === '/index.html') {
    ctx.set('Cache-Control', 'no-cache');
  }
});

app.use(koaStatic(yapi.path.join(yapi.WEBROOT, 'static'), { index: 'index.html', gzip: true }));


// Listen once the database is up and the token secret is loaded.
yapi.connect
  .then(() => require('./utils/token').init())
  .then(() => {
    const server = app.listen(yapi.WEBCONFIG.port);
    server.setTimeout(yapi.WEBCONFIG.timeout);
    commons.log(
      `服务已启动，请打开下面链接访问: 
http://127.0.0.1${
        yapi.WEBCONFIG.port == '80' ? '' : ':' + yapi.WEBCONFIG.port
      }/`
    );
  })
  .catch(err => {
    commons.log(err, 'error');
    process.exit(1);
  });
