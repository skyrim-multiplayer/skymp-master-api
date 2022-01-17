import * as Koa from "koa";
import * as helmet from "koa-helmet";
import * as logger from "koa-logger";
import * as cors from "@koa/cors";
import * as koaBody from "koa-body";
import { Connection } from "typeorm";
import * as Router from "koa-router";

import { getRouter } from "./v1";
import { StatsManager } from "./utils/statsManager";
import { passportInit } from "./utils/passport-init";
import { errorHandler } from "./middlewares/error-handler";

export interface AppOptions {
  enableLogging: boolean;
  statsCsvPath: string;
}

export class App {
  constructor(private connection: Connection, options: AppOptions) {
    this.statsManager = new StatsManager(options.statsCsvPath);

    this.app = new Koa()
      .use(helmet())
      .use(cors())
      .use(koaBody({ multipart: true }))
      .use(passportInit(this.connection.name));
    this.app.context["connectionName"] = this.connection.name;
    this.app.context["statsManager"] = this.statsManager;

    if (options.enableLogging) this.app.use(logger());

    const v1 = getRouter();
    const router = new Router({
      prefix: "/api"
    })
      .use(v1.routes())
      .use("/v1", v1.routes());
    this.app
      .use(errorHandler)
      .use(router.routes())
      .use(router.allowedMethods());

    this.onClose.push(() => connection.close());
  }

  listen(port: number): Promise<void> {
    return new Promise((resolve) => {
      const server = this.app.listen(port, "127.0.0.1", resolve); // TODO(#20): Unhardcode
      this.onClose.push(() => server.close());
    });
  }

  close(): void {
    this.onClose.forEach((f) => f());
    this.onClose = [];
  }

  get connectionName(): string {
    return this.connection.name;
  }

  private app: Koa;
  private onClose = new Array<() => void>();
  private statsManager: StatsManager;
}
