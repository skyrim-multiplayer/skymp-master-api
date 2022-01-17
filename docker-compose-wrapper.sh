#!/usr/bin/env bash

set -e

die() {
  echo "$@" >&2
  exit 1
}

if [ ! -e Dockerfile ]; then
  die run this script from repo root
fi

# cheatsheet: https://stackoverflow.com/a/44606194
# :? exits when no data or empty string
# := accepts empty string
# Ensuring all required variables are set:
echo "${DB_PASSWORD:?}" > /dev/null
echo "${JWT_SECRET:?}" > /dev/null
echo "${DB_URL:?}" > /dev/null
echo "${EMAIL_USER:=}" > /dev/null
echo "${EMAIL_PASS:=}" > /dev/null
echo "${STATS_CSV_PATH:?}" > /dev/null
echo "${S3_AWS_ACCESS_KEY_ID:=}" > /dev/null
echo "${S3_AWS_SECRET_ACCESS_KEY:=}" > /dev/null
echo "${DISCORD_CLIENT_ID:?}" > /dev/null
echo "${DISCORD_CLIENT_SECRET:?}" > /dev/null

exec docker-compose "$@"
