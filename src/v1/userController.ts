import * as crypto from "crypto";
import { Context } from "koa";
import * as Router from "koa-router";
import { getManager, Repository } from "typeorm";
import { validate, ValidationError } from "class-validator";
import * as Passport from "koa-passport";
import * as jwt from "jsonwebtoken";
import { URLSearchParams } from "url";

import { hashString } from "../utils/hashString";
import { User, VERIFICATION_EXPIRES } from "../models/user";
import {
  sendSignupSuccess,
  sendSignupResetPin,
  sendResetPassword
} from "../emails";
import { randomString } from "../utils/random-string";
import { config } from "../cfg";
import { withAuth } from "../middlewares/auth";

const generatePassword = (
  length = 20,
  wishlist = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz~!-#$"
) =>
  Array.from(crypto.randomFillSync(new Uint32Array(length)))
    .map((x) => wishlist[x % wishlist.length])
    .join("");

interface AuthStatus {
  token: string;
  masterApiId: number;
  discordUsername: string | null;
  discordDiscriminator: string | null;
  discordAvatar: string | null;
}

export class UserController {
  static authDataStorage = new Map<string, AuthStatus>();

  static getRouter(): Router {
    return new Router()
      .post("/users", UserController.createUser)
      .post("/users/:id/verify", UserController.verify)
      .post("/users/:id/reset-pin", UserController.resetPin)
      .post("/users/reset-password", UserController.resetPassword)
      .post("/users/login", UserController.login)
      .get("/users/login-discord", UserController.loginDiscord)
      .get("/users/login-discord/callback", UserController.loginDiscordCallback)
      .get("/users/login-discord/status", UserController.loginDiscordStatus)
      .get("/users/me", withAuth(), UserController.getMyUserInfo)
      .get("/users/:id", withAuth(), UserController.getUserInfo)
      .get("/enduser-verify/:email/:pin", UserController.verifyEnduser)
      .post("/users/me/play/:serverAddress", withAuth(), UserController.play)
      .get(
        "/servers/:serverAddress/sessions/:session",
        UserController.getUserByServerAndSession
      );
  }

  static getRepository(ctx: Context | Router.RouterContext): Repository<User> {
    return getManager(
      (ctx as Record<string, string>)["connectionName"]
    ).getRepository(User);
  }

  static async createUser(ctx: Context | Router.RouterContext): Promise<void> {
    const userRepository = UserController.getRepository(ctx);

    const { name, email, password } = ctx.request.body;

    const user: User = new User();
    user.name = name;
    user.email = email;
    user.password = password;
    user.verificationPin = randomString(32);

    const errors: ValidationError[] = await validate(user, {
      skipMissingProperties: true
    });

    if (errors.length > 0) {
      ctx.status = 400;
      ctx.body = errors;
    } else if (await userRepository.findOne({ email: user.email })) {
      ctx.status = 400;
      ctx.body = "The specified e-mail address already exists";
    } else if (await userRepository.findOne({ name: user.name })) {
      ctx.status = 400;
      ctx.body = "A user with the same name already exists";
    } else {
      await userRepository.save(user);
      const actualUser = await userRepository.findOne({ email: user.email });
      if (actualUser) {
        ctx.status = 201;
        ctx.body = { id: actualUser.id };
      } else {
        ctx.status = 500;
        ctx.body = "findOne returned undefined unexpectedly";
      }
    }
  }

  private static async verifyImpl(
    ctx: Context | Router.RouterContext,
    id: number,
    email: string,
    verificationPin: string,
    password?: string
  ): Promise<boolean> {
    const passwordHash = await hashString("" + password, "" + email);
    const verificationPinHash = await hashString(
      "" + verificationPin,
      "" + email
    );
    const userRepository = UserController.getRepository(ctx);
    const updateResult = await userRepository.update(
      password
        ? {
          id,
          verificationPin: verificationPinHash,
          password: passwordHash,
          hasVerifiedEmail: false
        }
        : {
          id,
          verificationPin: verificationPinHash,
          hasVerifiedEmail: false
        },
      {
        hasVerifiedEmail: true
      }
    );
    return !!updateResult.affected;
  }

  static async verify(ctx: Context | Router.RouterContext): Promise<void> {
    let id = +ctx.params.id;
    if (!Number.isInteger(id)) id = -1;

    if (
      await UserController.verifyImpl(
        ctx,
        id,
        ctx.request.body.email,
        ctx.request.body.pin,
        ctx.request.body.password
      )
    ) {
      await sendSignupSuccess(ctx.request.body.email);
      ctx.status = 200;
      const token = jwt.sign(
        {
          id: id,
          role: "non-role",
          email: ctx.request.body.email
        },
        config.JWT_SECRET
      );
      ctx.body = { token: "JWT " + token };
    } else {
      ctx.throw(404);
    }
  }

  static async play(ctx: Context | Router.RouterContext): Promise<void> {
    const user = (ctx as Record<string, User>).user;
    // XXX: is this needed?
    //if (!(await UserController.ensureTokenMatchesId(ctx))) return;
    user.currentServerAddress = ctx.params.serverAddress;
    user.currentSession = randomString(32);
    await UserController.getRepository(ctx).save(user);
    ctx.status = 200;
    ctx.body = {
      session: user.currentSession
    };
  }

  static async getUserByServerAndSession(
    ctx: Context | Router.RouterContext
  ): Promise<void> {
    const { serverAddress, session } = ctx.params;
    if (serverAddress.indexOf(':') === -1) {
      ctx.throw(400, 'bad server IP:port passed');
    }
    const user = await UserController.getRepository(ctx).findOne({
      currentServerAddress: serverAddress,
      currentSession: session
    });
    if (!user) {
      return ctx.throw(404);
    } else {
      ctx.body = {
        user: {
          id: user.id,
          discordId: user.discordId,
        },
      };
    }
  }

  static async verifyEnduser(
    ctx: Context | Router.RouterContext
  ): Promise<void> {
    const accountVerifiedMessage =
      "Адрес электронной почты подтверждён успешно";
    const accountNotVerifiedMessage =
      "Ошибка при подтверждении адреса электронной почты";

    const user = await UserController.getRepository(ctx).findOne({
      email: ctx.params.email
    });
    const id = user ? user.id : -1;
    const verified = await UserController.verifyImpl(
      ctx,
      id,
      ctx.params.email,
      ctx.params.pin
    );
    ctx.type = "html";
    ctx.body = `<html lang="en-us"><head>
    <meta charset="UTF-8">
    <title>Skyrim Multiplayer by skyrim-multiplayer</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" type="text/css" href="stylesheets/normalize.css" media="screen">
    <link href="https://fonts.googleapis.com/css?family=Open+Sans:400,700" rel="stylesheet" type="text/css">
    <link rel="stylesheet" type="text/css" href="stylesheets/stylesheet.css" media="screen">
    <link rel="stylesheet" type="text/css" href="stylesheets/github-light.css" media="screen">
  </head>
  <body>

<center><h1>${verified ? accountVerifiedMessage : accountNotVerifiedMessage
      }</h1></center>

</body></html>`;
  }

  static async login(
    ctx: Context | Router.RouterContext,
    next: () => Promise<void>
  ): Promise<void> {
    await Passport.authenticate("local", (err, user) => {
      if (err) {
        return ctx.throw(401, err);
      }
      if (!user) {
        return ctx.throw(401, "Login failed");
      }
      const { id, hasVerifiedEmail, email, roles } = user;
      if (!hasVerifiedEmail)
        return ctx.throw(403, "Email address didn't verify");
      const payload = {
        id,
        hasVerifiedEmail,
        email,
        roles
      };
      const token = `JWT ${jwt.sign(payload, config.JWT_SECRET)}`;
      ctx.body = { token, id, name: user.name };
    })(ctx, next);
  }

  static async loginDiscord(
    ctx: Context | Router.RouterContext,
  ): Promise<void> {
    if (!ctx.query.state) {
      ctx.throw(400, 'no state');
    }
    const state: string = ctx.query.state;
    const params = new URLSearchParams({
      client_id: config.DISCORD_CLIENT_ID,
      scope: 'identify',
      response_type: 'code',
      state,
    });
    if (config.EXTERNAL_URL_BASE) {
      params.set('redirect_uri', config.EXTERNAL_URL_BASE + '/api/users/login-discord/callback');
    }
    ctx.redirect('https://discord.com/oauth2/authorize?' + params.toString());
  }

  static async loginDiscordCallback(
    ctx: Context | Router.RouterContext,
    next: () => Promise<void>,
  ): Promise<void> {
    const state = ctx.query.state;
    if (!state) {
      return ctx.throw(400, 'no state');
    }
    await Passport.authenticate("discord", (err, user: User) => {
      if (err) {
        return ctx.throw(401, err);
      }
      if (!user) {
        return ctx.throw(401, "Login failed");
      }
      const { id, hasVerifiedEmail, email, roles } = user;
      if (!hasVerifiedEmail) {
        return ctx.throw(403, "Email address didn't verify");
      }
      const payload = {
        id,
        hasVerifiedEmail,
        email,
        roles,
      };
      const token = `JWT ${jwt.sign(payload, config.JWT_SECRET)}`;
      ctx.body = 'Success! You may return to the game...';
      UserController.authDataStorage.set(state, {
        token,
        masterApiId: id,
        discordUsername: user.discordUsername,
        discordAvatar: user.discordAvatar,
        discordDiscriminator: user.discordDiscriminator,
      });
    })(ctx, next);
  }

  static async loginDiscordStatus(
    ctx: Context | Router.RouterContext,
  ): Promise<void> {
    const state = ctx.query.state;
    if (!state) {
      return ctx.throw(400, 'no state');
    }
    const data = UserController.authDataStorage.get(state);
    if (!data) {
      return ctx.throw(401, "When it's ready!");
    }
    ctx.body = data;
    UserController.authDataStorage.delete(state);
  }

  static async ensureTokenMatchesId(
    ctx: Context | Router.RouterContext
  ): Promise<boolean> {
    const user = (ctx as Record<string, User>).user;
    const id = +ctx.params.id;
    if (id !== user.id) {
      ctx.status = 403;
      ctx.body = "Token doesn't match id";
      return false;
    }
    return true;
  }

  static async getMyUserInfo(ctx: Context | Router.RouterContext): Promise<void> {
    const user = (ctx as Record<string, User>).user;
    ctx.body = { id: user.id, name: user.name };
  }

  static async getUserInfo(ctx: Context | Router.RouterContext): Promise<void> {
    const user = (ctx as Record<string, User>).user;
    if (!(await UserController.ensureTokenMatchesId(ctx))) return;
    ctx.body = { name: user.name };
  }

  static async resetPassword(
    ctx: Context | Router.RouterContext
  ): Promise<void> {
    const newPassword = ctx.request.body.newPassword || generatePassword(16);
    const passwordGenerated = !ctx.request.body.newPassword;

    const password = await hashString(
      "" + ctx.request.body.password,
      "" + ctx.request.body.email
    );
    const newPasswordHashed = await hashString(
      newPassword,
      "" + ctx.request.body.email
    );
    const userRepository = UserController.getRepository(ctx);
    const updateResult = await userRepository.update(
      passwordGenerated
        ? { email: ctx.request.body.email, hasVerifiedEmail: true }
        : {
          email: ctx.request.body.email,
          password,
          hasVerifiedEmail: true
        },
      {
        password: newPasswordHashed
      }
    );

    if (updateResult.affected) {
      const user = await userRepository.findOne({
        email: ctx.request.body.email
      });
      if (user) {
        await sendResetPassword(ctx.request.body.email, user.name, newPassword);
        ctx.body = {
          passwordGenerated
        };
      } else ctx.throw(418);
    } else {
      ctx.throw(404);
    }
  }

  static async resetPin(ctx: Context | Router.RouterContext): Promise<void> {
    const userRepository = UserController.getRepository(ctx);

    let id = +ctx.params.id;
    if (!Number.isInteger(id)) id = -1;

    const email = ctx.request.body.email;

    const password = await hashString(
      "" + ctx.request.body.password,
      "" + email
    );

    const user = await userRepository.findOne({ id, email, password });

    if (!user) {
      ctx.throw(400, "User not found with like this id, email and password");
    } else if (user.hasVerifiedEmail) {
      ctx.throw(400, "User has verified email");
    } else if (
      new Date().getTime() - user.verificationPinSentAt.getTime() >
      VERIFICATION_EXPIRES
    ) {
      ctx.throw(400, "Code is expired");
    } else {
      const newPin = randomString(32);

      // Maybe override EntityRepository method save ???
      user.verificationPin = await hashString(newPin, user.email);

      user.verificationPinSentAt = new Date();

      await userRepository.save(user);

      ctx.status = 200;

      sendSignupResetPin(user.email, user.name, newPin);
    }
  }
}
