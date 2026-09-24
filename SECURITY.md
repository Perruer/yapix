# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| Yapix 2.x | Yes |
| YApi 1.x (YMFE) | No. It has not been updated since November 2022; upgrade to Yapix (see [UPGRADING.md](UPGRADING.md)) |

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub: **Security → Report a vulnerability** on https://github.com/Perruer/yapix. Do not open a public issue for them.

I will confirm the report within a few days, and publish a fix and an advisory as soon as I can. Reports about YApi that also affect Yapix are welcome.

## What Yapix 2.0 fixes compared to YApi 1.12

- Server-side scripts (mock scripts, test assertions, pre- and post-request scripts) ran in `vm2`/`safeify` and `node:vm`, which do not isolate code from the server. They now run in a separate V8 isolate (`isolated-vm`) with memory and time limits and without access to Node.js.
- Project tokens were encrypted with the public default key `abcde` when `config.json` had no `passsalt`, so a project member could forge a token for any user. Yapix keeps a random key in the database and refuses tokens made with the public key.
- A new installation had the admin password `ymfe.org`; now it is set from `YAPIX_ADMIN_PASSWORD` or generated.
- Passwords were stored as salted SHA-1; now scrypt.
- API parameters could carry MongoDB query operators; they are refused.
- LDAP sign-in put the user name into the search filter unescaped and accepted empty passwords.
- Server-side test requests did not check TLS certificates (CVE-2025-70058).
- `/api/project/token` issued tokens for projects the caller could not see.
- Dependencies: YApi 1.12 had 244 known advisories in production dependencies (50 critical). Yapix has one: Mock.js prototype pollution, which has no fixed release and is mitigated in [common/mockjs.js](common/mockjs.js).
- The browser extension YApi relied on (cross-request) is Manifest V2 and no longer runs in current Chrome. Its replacement, Yapix Request Helper, works only on sites the user allows in its popup.
