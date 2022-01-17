import { createConnection } from "typeorm";
import * as fs from "fs";

import { config } from "cfg";
import { App } from "app";
import { entities, subscribers } from "models";
import { prefix } from "utils/statsManager";

const getStatsCsvPath = () => {
  let statsCsvPath = config.STATS_CSV_PATH;
  if (!statsCsvPath && process.env.NODE_ENV !== "production") {
    statsCsvPath = "./temp.csv";
    fs.writeFileSync(statsCsvPath, prefix);
    console.log("[WARNING] Missing config.STATS_CSV_PATH, using temp.csv");
    console.log("[WARNING] It's ok for development, but not for prod");
  }
  return statsCsvPath;
};

require("child_process").exec("git rev-parse HEAD", function (_err, stdout) {
  console.log("Last commit hash on this branch is:", stdout);

  createConnection({
    type: "postgres",
    url: config.DB_URL,
    logging: ["query", "error"],
    synchronize: true,
    entities: entities,
    subscribers: subscribers,
    // ssl: { rejectUnauthorized: false }
  })
    .then(async (connection) => {
      const app = new App(connection, {
        enableLogging: true,
        statsCsvPath: getStatsCsvPath()
      });
      await app.listen(config.PORT);
      console.log(`Server started on port ${config.PORT}.`);
    })
    .catch((error: string) => {
      console.log("DB connection error: ", error);
    });
});
