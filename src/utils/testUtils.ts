import { createConnection, getManager, Repository } from "typeorm";
import Axios, { AxiosInstance } from "axios";
import * as fs from "fs";
import * as parseCsv from "csv-parse/lib/sync";

import { prefix, StatsElement } from "./statsManager";
import { entities } from "../models";
import { App } from "../app";
import { User } from "../models/user";
import { config } from "../cfg";

export interface TestUserInfo {
  user: User;
}

let app_: App;
let api_: AxiosInstance;
let users_: Repository<User>;
let testPort_ = 7777;

export class TestUtilsProvider {
  static get app(): App {
    return app_;
  }

  static get users(): Repository<User> {
    return users_;
  }

  static get api(): AxiosInstance {
    return api_;
  }

  static get testPort(): number {
    return testPort_;
  }

  static get statsCsvPath(): string {
    return "./temp.csv";
  }

  static async createTestUser(
    options: Partial<User> = { hasVerifiedEmail: false }
  ): Promise<TestUserInfo> {
    const usr: User = new User();
    usr.hasVerifiedEmail = false;
    usr.name = "igor";
    usr.email = "lelele@test.be";
    usr.password = "jejeje";
    usr.verificationPin = "qwerty";
    usr.verificationPinSentAt = new Date();

    Object.keys(options).forEach((key) => (usr[key] = options[key]));

    await TestUtilsProvider.users.save(usr);

    const user = await TestUtilsProvider.users.findOne({
      name: usr.name
    });
    expect(user).not.toBeFalsy();
    if (!user) return { user: usr };

    return { user };
  }

  static async getStats(): Promise<Array<StatsElement>> {
    const v: string = (await TestUtilsProvider.api.get("/stats")).data;

    const res: Array<StatsElement> = parseCsv(v, {
      columns: true,
      skip_empty_lines: true
    });
    return res;
  }

  static async beforeEach(): Promise<void> {
    ++testPort_;
    fs.writeFileSync(TestUtilsProvider.statsCsvPath, prefix);
    const connection = await createConnection({
      type: "postgres",
      url:
        config.IS_GITHUB_ACTION === "true"
          ? config.DB_URL
          : config.DB_URL + "_test",
      logging: false,
      synchronize: true,
      entities: entities,
      name: "conn" + Math.random().toString()
    });
    app_ = new App(connection, {
      enableLogging: false,
      statsCsvPath: TestUtilsProvider.statsCsvPath
    });
    await TestUtilsProvider.app.listen(TestUtilsProvider.testPort);

    api_ = Axios.create({
      baseURL: `http://localhost:${TestUtilsProvider.testPort}/api/`
    });

    users_ = getManager(TestUtilsProvider.app.connectionName).getRepository(
      User
    );
  }

  static async afterEach(): Promise<void> {
    await TestUtilsProvider.users.clear();
    TestUtilsProvider.app.close();
  }
}
