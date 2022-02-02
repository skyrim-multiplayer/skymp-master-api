# skymp-master-api

REST service that provides access to users, servers, and statistics of Skyrim Multiplayer.

## GitHub Secrets

- HOST: `108.108.108.108`
- PORT: `22`
- USER: `linux_user`
- KEY: `-----BEGIN RSA PRIVATE KEY----- ...`
- MASTER_REPO: `skyrim-multiplayer/skymp-master-api`
- JWT_SECRET: `idk`
- DB_PASSWORD: `your_pass`
- EMAIL_USER - currently unused
- EMAIL_PASS - currently unused
- S3_AWS_ACCESS_KEY_ID - unused
- S3_AWS_SECRET_ACCESS_KEY - unused
- DISCORD_CLIENT_ID - nic11 maintains it, I fill with random characters
- DISCORD_CLIENT_SECRET - nic11 maintains it, I fill with random characters

## Listens only 127.0.0.1

It is hardcoded. See `index.ts`.
Use Nginx to make the service accessible from the Internet.

<!-- rerun -->
