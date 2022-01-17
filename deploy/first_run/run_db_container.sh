#!/usr/bin/env bash

set -e

# cheatsheet: https://stackoverflow.com/a/44606194
# ? without : accepts empty string
# Ensuring all required variables are set:
echo "${DB_PASSWORD:?}" > /dev/null

MASTER_POSTGRES_DATA_PATH="${MASTER_POSTGRES_DATA_PATH:="$HOME/skymp_master_postgres_data"}"
mkdir -p "$MASTER_POSTGRES_DATA_PATH"

docker run -d --restart=always \
    -v "$MASTER_POSTGRES_DATA_PATH:/var/lib/postgresql" \
    -e POSTGRES_USER=master \
    -e POSTGRES_PASSWORD="$DB_PASSWORD" \
    -e POSTGRES_DB=skymp \
    -p 127.0.0.1:5432:5432 \
    --name=skymp-master-postgres postgres
