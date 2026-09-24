# Running Yapix with Docker

The image `ghcr.io/perruer/yapix` is built for `linux/amd64` and `linux/arm64`.

```bash
YAPIX_ADMIN_PASSWORD='a long password' docker compose up -d
```

[docker-compose.yml](../../docker-compose.yml) starts Yapix with MongoDB 8. Open http://localhost:3000 and sign in with `YAPIX_ADMIN_EMAIL` (default `admin@admin.com`) and the password you set.

## How the container starts

1. If `/data/config.json` does not exist, it is written from the variables below. After that the file is used as it is, so edit it (or delete it to regenerate it) to change settings.
2. On the first start the database is prepared: indexes, and the admin account unless a user with that e-mail already exists. An existing YApi database is kept as it is. `/data/init.lock` marks this as done.
3. The server starts on port 3000.

Keep `/data` on a volume. You can also mount your own `config.json` at `/data/config.json`, for example the one from an existing YApi installation.

## Variables

| Variable | Default | |
| --- | --- | --- |
| `YAPIX_MONGO_URL` | `mongodb://mongo:27017/yapi` | MongoDB connection string (`db.connectString`) |
| `YAPIX_ADMIN_EMAIL` | `admin@admin.com` | Admin account (`adminAccount`) |
| `YAPIX_ADMIN_PASSWORD` | random, printed in the log once | Password of a new admin account. At least 8 characters |
| `YAPIX_PORT` | `3000` | Port inside the container |
| `YAPIX_CLOSE_REGISTER` | `true` | `false` lets anyone create an account |
| `YAPIX_MAIL_HOST`, `YAPIX_MAIL_PORT`, `YAPIX_MAIL_FROM`, `YAPIX_MAIL_USER`, `YAPIX_MAIL_PASS` | mail off | SMTP settings for notifications |
| `YAPIX_PASSSALT` | secret kept in the database | Key for project tokens. Set it to the `passsalt` of your YApi `config.json` to keep YApi tokens |
| `YAPIX_LEGACY_TOKENS` | `false` | Accept tokens that YApi made with its public default key (see [UPGRADING](../../UPGRADING.md)) |
| `YAPIX_INSECURE_TLS` | `false` | Skip TLS certificate checks for server-side test requests |
| `YAPIX_SCRIPT_ENABLE` | `false` | Run pre- and post-request scripts in server-side test runs |
| `YAPIX_CONFIG` | `/data/config.json` | Where the configuration lives |

These variables only shape the generated `config.json`; the other YApi settings (LDAP, `plugins` and so on) go straight into that file.

## Upgrading from a YApi container

Point `YAPIX_MONGO_URL` at the YApi database (MongoDB 4.4 or later), or mount the YApi `config.json` at `/data/config.json`. Read [UPGRADING.md](../../UPGRADING.md) first: YApi tokens made without `passsalt` need to be replaced.

Client plugins from npm (`plugins` in `config.json`) are bundled into the client at build time, so the image only contains the built-in plugins. To add others, build your own image from this repository with those packages installed.
