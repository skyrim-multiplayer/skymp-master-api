#!/usr/bin/env bash

# cheatsheet: https://stackoverflow.com/a/44606194
# ? without : accepts empty string
# Ensuring all required variables are set:
echo "${DB_PASSWORD:?}" > /dev/null

docker run -d --restart=always \
    -v "$PWD/data/postgres:/var/lib/postgresql" \
    -e POSTGRES_USER=master \
    -e POSTGRES_PASSWORD="$DB_PASSWORD" \
    -e POSTGRES_DB=skymp \
    -p 127.0.0.1:5432:5432 \
    --name=skymp-master-postgres postgres
