import { Context } from "koa";
import * as Router from "koa-router";
import { makeStatsElement } from "../utils/makeStatsElement";
import { cloneStructured } from "../utils/cloneStructured";
import { prefix, StatsManager } from "../utils/statsManager";

const ipAndPortRegex = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]):[0-9]+$/;

const playerLimit = 100;

export interface ServerOnline {
  online: number;
}

export interface Server extends ServerOnline {
  name: string;
  maxPlayers: number;
  ip: string;
  port: number;
  lastUpdate?: Date;
}

const g_servers = new Map<string, Server>();

export const latestVersion = "5.0.6.1";

export const defaultServerTimeout = 10000;

const historicalStatsManager = new StatsManager("./data/stats0911.csv");

export class LegacyController {
  public static serverTimeout = defaultServerTimeout;

  static getRouter(): Router {
    return new Router()
      .get("/skymp_link/:skympver", LegacyController.getSkympLink)
      .get("/skse_link/:skympver", LegacyController.getSkseLink)
      .get("/latest_version", LegacyController.getLatestVersion)
      .get("/stats", LegacyController.getStats)
      .get("/servers", LegacyController.getServers)
      .post("/servers/:address", LegacyController.createOrUpdateServer);
  }

  static async getSkympLink(
    ctx: Context | Router.RouterContext
  ): Promise<void> {
    if (!ctx.params.skympver.startsWith("5."))
      return ctx.throw(400, "Bad multiplayer version");
    ctx.body =
      "https://github.com/skyrim-multiplayer/skymp5-binaries/releases/download/" +
      ctx.params.skympver +
      "/client.zip";
  }

  static async getSkseLink(ctx: Context | Router.RouterContext): Promise<void> {
    if (!ctx.params.skympver.startsWith("5."))
      return ctx.throw(400, "Bad multiplayer version");
    ctx.body = "https://skse.silverlock.org/beta/skse64_2_00_19.7z";
  }

  static async getLatestVersion(
    ctx: Context | Router.RouterContext
  ): Promise<void> {
    ctx.body = latestVersion;
  }

  static async getStats(ctx: Context | Router.RouterContext): Promise<void> {
    const statsManager = LegacyController.getStatsManager(ctx);
    const stats = historicalStatsManager.get().concat(statsManager.get());
    let statsDump = prefix;
    stats.forEach(
      (element) =>
        (statsDump += `${element.Time},${element.PlayersOnline},${element.ServersOnline}\n`)
    );
    ctx.body = statsDump;
  }

  static async getServers(ctx: Context | Router.RouterContext): Promise<void> {
    await LegacyController.removeOutdatedServers();

    const res = Array.from(g_servers).map((pair) => cloneStructured(pair[1]));
    res.forEach((server) => delete server.lastUpdate);
    ctx.body = res;
  }

  static async createOrUpdateServer(
    ctx: Context | Router.RouterContext
  ): Promise<void> {
    if (!ctx.params.address.match(ipAndPortRegex)) {
      return ctx.throw(
        400,
        "Address must contain IP and port (i.e. 127.0.0.1:7777)"
      );
    }
    const [ip, port] = ctx.params.address.split(":");
    if (!ctx.ip.startsWith("::") && ctx.ip !== ip) {
      return ctx.throw(
        403,
        `Your IP is expected to be ${ip}, but it is ${ctx.ip}`
      );
    }

    const server: Server = {
      ip: ip,
      port: +port,
      name: "" + (ctx.request.body.name || "Yet Another Scamp Server"),
      maxPlayers: +ctx.request.body.maxPlayers || playerLimit,
      online: +ctx.request.body.online,
      lastUpdate: new Date()
    };

    if (server.maxPlayers > playerLimit) server.maxPlayers = playerLimit;
    if (server.maxPlayers < 1) server.maxPlayers = 1;
    server.maxPlayers = Math.floor(server.maxPlayers);

    if ("" + server.online === "NaN") server.online = 0;
    if (server.online > server.maxPlayers) server.online = server.maxPlayers;
    if (server.online < 0) server.online = 0;
    server.online = Math.floor(server.online);

    g_servers.set(ctx.params.address, server);

    const st = LegacyController.getStatsManager(ctx);
    const lastAdd = st.getLastAddMoment();
    if (!lastAdd || Date.now() - lastAdd.getTime() > 1000 * 60) {
      const serverList = Array.from(g_servers).map((pair) => pair[1]);
      st.add(makeStatsElement(new Date(), serverList));
    }

    ctx.body = "Nice";
  }

  private static getStatsManager(
    ctx: Context | Router.RouterContext
  ): StatsManager {
    return (ctx as Record<string, StatsManager>)["statsManager"];
  }

  private static async removeOutdatedServers() {
    const toRemove = new Array<string>();
    for (const [address, server] of g_servers) {
      if (
        server.lastUpdate &&
        Date.now() - server.lastUpdate.getTime() >=
          LegacyController.serverTimeout
      )
        toRemove.push(address);
    }
    toRemove.forEach((item) => g_servers.delete(item));
  }
}