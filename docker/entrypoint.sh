#!/bin/sh
# Container start: write config.json from the environment on the first run, set up the database
# once (an existing YApi database is kept), then start the server.
set -e

export YAPIX_CONFIG="${YAPIX_CONFIG:-/data/config.json}"
node /app/docker/make-config.js

if [ ! -f "$(dirname "$YAPIX_CONFIG")/init.lock" ]; then
  node /app/server/install.js
fi

exec node /app/server/app.js
