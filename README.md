<p align="center"><img src="images/yapix_mark.svg" width="96" alt="Yapix"></p>

<h1 align="center">Yapix</h1>

<p align="center">
  <b>API docs, mock server and API tests for teams. A security-maintained continuation of YApi.</b>
</p>

<p align="center">
  <a href="https://github.com/Perruer/yapix/actions/workflows/ci.yml"><img src="https://github.com/Perruer/yapix/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/Perruer/yapix/releases"><img src="https://img.shields.io/github/v/release/Perruer/yapix" alt="Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="Apache-2.0"></a>
</p>

<p align="center">English · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ru.md">Русский</a></p>

---

[YApi](https://github.com/YMFE/yapi) by YMFE is one of the most used self-hosted API management platforms (27.7k stars). Its last release came out in November 2022. Since then it does not run on current Node.js, its client cannot be rebuilt, the browser extension it needs no longer works in Chrome, and known vulnerabilities, including code execution through mock scripts, stay open.

Yapix starts from YApi 1.12 and keeps it safe to run. Your existing YApi database works as it is: users, projects, interfaces, test collections and mock data carry over.

## What's different from YApi 1.12

| | YApi 1.12 | Yapix 2.0 |
| --- | --- | --- |
| Node.js | up to 20; project tokens fail on 22+ | 24 LTS |
| Database layer | Mongoose 5.7 (2019) | Mongoose 9; MongoDB 4.4–8 |
| Mock and test scripts | `vm2`/`safeify` and `node:vm`, which do not isolate scripts from the server | a separate V8 isolate per run, with memory and time limits and no access to Node.js |
| Project tokens | encrypted with the public key `abcde` unless `passsalt` is set: members could forge tokens for other users | random key in the database; YApi's forgeable tokens refused (opt-in migration mode) |
| First admin | password `ymfe.org` | `YAPIX_ADMIN_PASSWORD` or a random password |
| Password storage | salted SHA-1 | scrypt, old hashes replaced at sign-in |
| Known advisories in production dependencies | 244 (50 critical) | 1, mitigated (Mock.js, no fixed release) |
| Client build | ykit (webpack 1) and node-sass: does not build any more | webpack 5, Babel 7, dart-sass |
| Browser extension for the Run tab | cross-request (Manifest V2, no longer runs in Chrome, no license) | Yapix Request Helper (Manifest V3, Apache-2.0), active only on sites you allow |
| Server-side test requests | TLS certificates not checked (CVE-2025-70058) | checked; opt-out for test servers |
| Docker | community images | official image for amd64 and arm64 |
| Upgrade check | — | CI fills a database with YApi 1.12 and checks it with Yapix on every change |

The full list is in [SECURITY.md](SECURITY.md) and the [changelog](CHANGELOG.md). Everything else works as in YApi 1.12: interfaces and categories, JSON Schema, Mock.js mock data and expectations, test collections and reports, Swagger/Postman/HAR import, export, the open API, wiki, plugins and LDAP.

## Quick start

### Docker

```bash
curl -O https://raw.githubusercontent.com/Perruer/yapix/main/docker-compose.yml
YAPIX_ADMIN_PASSWORD='a long password' docker compose up -d
```

Open http://localhost:3000 and sign in as `admin@admin.com`. Settings are in [docs/devops/docker.md](docs/devops/docker.md).

### From source

Node.js 24 and MongoDB 4.4 or later are required.

```bash
mkdir yapix && cd yapix
git clone https://github.com/Perruer/yapix.git vendors
cp vendors/config_example.json config.json      # set db, adminAccount and so on
cd vendors
npm ci
npm run build-client
YAPIX_ADMIN_PASSWORD='a long password' npm run install-server
npm start
```

`config.json` sits next to the `vendors` folder, as in YApi; `YAPIX_CONFIG=/path/to/config.json` can point anywhere else.

### Browser extension

To send requests from the Run tab and run test collections in the browser, install **Yapix Request Helper** (Chrome, Edge and other Chromium browsers): download it from the Run tab or from the [releases](https://github.com/Perruer/yapix/releases), load it unpacked and allow your Yapix site in its popup. See [docs/documents/extension.md](docs/documents/extension.md).

## Upgrading from YApi

Back up MongoDB, stop YApi and start Yapix on the same database. Read [UPGRADING.md](UPGRADING.md) first: it covers MongoDB versions, project tokens that need replacing, script limits and the new extension.

## Documentation

- [User guide (Chinese)](docs/documents/index.md), from YApi
- [Open API](docs/documents/openapi.md)
- [Docker](docs/devops/docker.md)
- [Plugin development](docs/documents/plugin-dev.md)

## Development

```bash
npm ci
npm test                 # unit tests
npm run dev-client       # rebuilds the client on change
npm run dev-server       # restarts the server on change
```

End-to-end tests (`test/e2e/`) run against a live server: the API flow, the upgrade from a YApi 1.12 database and the browser extension. The CI workflow shows how to run them.

## Support the project

Yapix is maintained in my free time. If it keeps your team's APIs documented and tested, you can support it:

- [Boosty](https://boosty.to/mikio_kuroki/donate)
- USDT / TRX (TRC-20): `TXUBW4e88SDTfrnJRKfbhYfFcggufbonc1`
- USDT / USDC / ETH (ERC-20): `0x1378491169064702786b2E5b58c6375776177E8A`
- TON / USDT (TON): `UQAhI7EKzoa-JuKOfv0ULMzA3FrmpxsDkXj8Qevwj2z1cMRN`

## License

[Apache-2.0](LICENSE), like YApi. Yapix is a continuation of [YApi](https://github.com/YMFE/yapi) by YMFE (Qunar); see [NOTICE](NOTICE). The original README is in [docs/upstream-README.md](docs/upstream-README.md). Yapix is not affiliated with or endorsed by YMFE or Qunar.
