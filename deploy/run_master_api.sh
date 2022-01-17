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
# ? without : accepts empty string
# Ensuring all required variables are set:
echo "${JWT_SECRET:?}" > /dev/null
echo "${DB_URL:?}" > /dev/null
echo "${EMAIL_USER:=}" > /dev/null
echo "${EMAIL_PASS:=}" > /dev/null
echo "${STATS_CSV_PATH:?}" > /dev/null
echo "${S3_AWS_ACCESS_KEY_ID:=}" > /dev/null
echo "${S3_AWS_SECRET_ACCESS_KEY:=}" > /dev/null
echo "${DISCORD_CLIENT_ID:?}" > /dev/null
echo "${DISCORD_CLIENT_SECRET:?}" > /dev/null

docker build . --tag=skymp-master-api #|| die "Can't build image"

[ -e data/stats.csv ] || echo "Time,PlayersOnline,ServersOnline" > data/stats.csv
chmod o+w data/stats.csv

docker run -d --restart=always \
  -e PORT=3000 \
  -e JWT_SECRET="$JWT_SECRET" \
  -e DB_URL="$DB_URL" \
  -e EMAIL_USER="$EMAIL_USER" \
  -e EMAIL_PASS="$EMAIL_PASS" \
  -e STATS_CSV_PATH="$STATS_CSV_PATH" \
  -e IS_GITHUB_ACTION="$IS_GITHUB_ACTION" \
  -e S3_AWS_ACCESS_KEY_ID="$S3_AWS_ACCESS_KEY_ID" \
  -e S3_AWS_SECRET_ACCESS_KEY="$S3_AWS_SECRET_ACCESS_KEY" \
  -e DISCORD_CLIENT_ID="$DISCORD_CLIENT_ID" \
  -e DISCORD_CLIENT_SECRET="$DISCORD_CLIENT_SECRET" \
  -v "$PWD/data:/data" \
  --network=host \
  --name=skymp-master-api skymp-master-api
