import * as fs from "fs";

export interface Config {
  PORT: number;
  JWT_SECRET: string;
  DB_URL: string;
  EMAIL_USER: string;
  EMAIL_PASS: string;
  STATS_CSV_PATH: string;
  IS_GITHUB_ACTION?: string;
  S3_AWS_ACCESS_KEY_ID?: string;
  S3_AWS_SECRET_ACCESS_KEY?: string;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  EXTERNAL_URL_BASE?: string;
}

const getConfig = (): Config => {
  const cfgPath = "./src/config.json";

  if (process.env.USE_ARGS) {
    const config = {};
    [
      "PORT",
      "JWT_SECRET",
      "DB_URL",
      "EMAIL_USER",
      "EMAIL_PASS",
      "STATS_CSV_PATH",
      "IS_GITHUB_ACTION",
      "S3_AWS_ACCESS_KEY_ID",
      "S3_AWS_SECRET_ACCESS_KEY",
      "DISCORD_CLIENT_ID",
      "DISCORD_CLIENT_SECRET",
      "EXTERNAL_URL_BASE",
    ].forEach((optionName) => {
      if (process.env[optionName] !== undefined) {
        config[optionName] = process.env[optionName];
      }
    });
    if (process.env.DATABASE_URL) {
      config["DB_URL"] = process.env.DATABASE_URL;
    }
    fs.writeFileSync(cfgPath, JSON.stringify(config));
    console.log("Using config from env");
  }

  const exampleConfig = fs.readFileSync("./src/config-example.json", "utf-8");
  if (!fs.existsSync(cfgPath)) fs.writeFileSync(cfgPath, exampleConfig);
  const cfg: Config = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
  if (JSON.stringify(cfg) === JSON.stringify(JSON.parse(exampleConfig)))
    throw new Error("Please fill config.json with valid values");
  return cfg;
};

export const config = getConfig();
