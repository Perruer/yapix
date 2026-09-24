# Upgrading from YApi to Yapix

Yapix 2.0 runs on the database of YApi 1.12 (and earlier 1.x releases) as it is: users, groups, projects, interfaces, test collections, mock expectations, wiki pages and logs carry over, and new ids continue the old sequences. CI checks this on every change with a database filled by YApi 1.12.

## Steps

1. Back up MongoDB (`mongodump`) and your `config.json`.
2. Stop YApi.
3. Start Yapix on the same database:
   - **Docker:** use `ghcr.io/perruer/yapix` with `YAPIX_MONGO_URL` pointing at your database, or mount your `config.json` at `/data/config.json` (see [docs/devops/docker.md](docs/devops/docker.md)).
   - **From source or a YApi-style folder:** Yapix keeps YApi's layout (`<folder>/vendors` next to `<folder>/config.json`). Replace `vendors` with Yapix, run `npm ci --omit=dev` and `npm run build-client` in it, and start `node vendors/server/app.js`. `YAPIX_CONFIG=/path/to/config.json` can point anywhere else.
4. Sign in as before and get new project tokens (below).

Requirements: **Node.js 24** or later and **MongoDB 4.4** or later (tested with MongoDB 8). Many YApi setups run MongoDB 3.x or 4.0, which the current driver cannot talk to: upgrade MongoDB first, one major version at a time (for example 4.0 → 4.2 → 4.4), following MongoDB's upgrade guides.

## What changes

### Project tokens

When `config.json` had no `passsalt`, YApi encrypted project tokens with the public key `abcde`. Anyone holding a token could decrypt it and build a token for another user, admins included. Yapix keeps a random secret in the database instead and refuses tokens made with the public key:

```
token 无效: this token was made by YApi with a public key. Get a new token in the project settings.
```

Get new tokens in Project → Settings → Token and update your scripts and CI. If you need the old tokens for a while, set `"legacyTokens": true` in `config.json`: they are accepted again and every use is logged with a warning. Remove the setting once your tokens are replaced.

If your `config.json` sets `passsalt`, tokens keep working unchanged.

### Scripts

Mock scripts, test-case assertions and (with `scriptEnable`) server-side pre- and post-request scripts run in a separate V8 isolate instead of `vm2`/`safeify`:

- the data (`mockJson`, `params`, `body`, `header`, `status`, `records` ...), `Mock`/`Random`, `assert`, `log`, `utils` (`_`, `CryptoJS`, `jsrsasign`, hashes, base64) and `storage` work as before;
- there is no `require`, `process`, file system or network; `utils.axios` is not available in server-side scripts;
- limits: 64 MB of memory, 3 s of CPU time for the synchronous part and 10 s in total.

Scripts that ran in the browser (the Run tab and test collections in the browser) are not affected.

### Accounts

- New installations get the admin password from `YAPIX_ADMIN_PASSWORD` or a random one printed once, instead of `ymfe.org`. Existing admins keep their password.
- Passwords are stored as scrypt hashes. Old hashes are replaced on each user's next sign-in; nothing to do.
- `config_example.json` closes registration (`"closeRegister": true`). Existing `config.json` files are not changed.

### Server-side test requests

Requests sent by the server (the open API `run_auto_test`) check TLS certificates. For test servers with self-signed certificates, add the CA with `NODE_EXTRA_CA_CERTS`, or set `"insecureTLS": true` to skip the check as YApi did.

### Browser extension

The Run tab needs the **Yapix Request Helper** extension instead of cross-request. See [docs/documents/extension.md](docs/documents/extension.md). It works only on the sites you allow in its popup.

### Other changes

- API parameters that contain MongoDB query operators (`{"$ne": null}` and similar) are refused with code 400.
- `/api/project/token` checks that the caller can see the project.
- The admin page no longer checks a third-party service for new versions.
- Client plugins listed in `config.json` are bundled when the client is built, as in YApi: run `npm run build-client` after changing `plugins`. The Docker image contains the built-in plugins only.
- `reconnectTries` and `reconnectInterval` in `config.json` are ignored; the MongoDB driver reconnects on its own. Other `db.options` are passed to the driver.

## Rolling back

Yapix does not change the structure of YApi's collections. It adds a `yapix_settings` collection (the token secret) and replaces password hashes on sign-in. To go back to YApi, restore your backup, or keep the database and reset the passwords of users who signed in to Yapix: YApi cannot read scrypt hashes.
