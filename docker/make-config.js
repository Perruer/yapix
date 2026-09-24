// Writes config.json for the container from environment variables (only when there is none yet).
// See docs/devops/docker.md for the variables.
const fs = require('fs');
const path = require('path');

const env = process.env;
const target = env.YAPIX_CONFIG || '/data/config.json';
const flag = (name, fallback) => (env[name] === undefined ? fallback : /^(1|true|yes)$/i.test(env[name]));

if (fs.existsSync(target)) {
  console.log(`using ${target}`);
  process.exit(0);
}

const config = {
  port: env.YAPIX_PORT || '3000',
  adminAccount: env.YAPIX_ADMIN_EMAIL || 'admin@admin.com',
  timeout: 120000,
  closeRegister: flag('YAPIX_CLOSE_REGISTER', true),
  db: {
    connectString: env.YAPIX_MONGO_URL || 'mongodb://mongo:27017/yapi'
  },
  mail: { enable: false }
};

if (env.YAPIX_MAIL_HOST) {
  config.mail = {
    enable: true,
    host: env.YAPIX_MAIL_HOST,
    port: Number(env.YAPIX_MAIL_PORT || 465),
    from: env.YAPIX_MAIL_FROM,
    auth: { user: env.YAPIX_MAIL_USER, pass: env.YAPIX_MAIL_PASS }
  };
}
if (env.YAPIX_PASSSALT) config.passsalt = env.YAPIX_PASSSALT;
if (flag('YAPIX_LEGACY_TOKENS', false)) config.legacyTokens = true;
if (flag('YAPIX_INSECURE_TLS', false)) config.insecureTLS = true;
if (flag('YAPIX_SCRIPT_ENABLE', false)) config.scriptEnable = true;

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(config, null, 2) + '\n');
console.log(`wrote ${target}`);
