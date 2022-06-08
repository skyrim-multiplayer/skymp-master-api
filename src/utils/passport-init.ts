import { Middleware } from "koa";
import * as Passport from "koa-passport";
import * as LocalStrategy from "passport-local";
import { ExtractJwt, Strategy as JwtStrategy } from "passport-jwt";
import { Strategy as DiscordStrategy } from "passport-discord";
import { getManager } from "typeorm";

import { hashString } from "./hashString";
import { randomString } from "../utils/random-string";
import { User, makeFakeDiscordEmail } from "../models/user";

import { config } from "../cfg";

export enum Strategies {
  jwt = "jwt",
  local = "local"
}

export const passportInit = (connectionName: string): Middleware => {
  const userRepository = getManager(connectionName).getRepository(User);

  Passport.use(
    new LocalStrategy.Strategy(
      {
        usernameField: "email",
        passwordField: "password",
        session: false
      },
      async (email: string, password: string, done) => {
        const hashPassword = await hashString(password, email);

        const user = await userRepository.findOne({
          email: email,
          password: hashPassword
        });

        if (!user) {
          return done(null, false, {
            message: "User does not exist or wrong password"
          });
        }

        return done(null, user);
      }
    )
  );

  Passport.use(
    new DiscordStrategy(
      {
        clientID: config.DISCORD_CLIENT_ID!,
        clientSecret: config.DISCORD_CLIENT_SECRET!,
        scope: ['identify'],
        callbackURL: (
          config.EXTERNAL_URL_BASE
            ? config.EXTERNAL_URL_BASE + '/api/users/login-discord/callback'
            : undefined
        ),
      },
      (_accessToken, _refreshToken, profile, done) => {
        (async () => {
          console.log(profile);
          const email = makeFakeDiscordEmail(profile.id);
          const user = await userRepository.findOne({ email })

          if (!user) {
            const user: User = new User();
            user.name = profile.id;
            user.email = email;
            user.password = randomString(32);
            user.verificationPin = randomString(32);
            user.discordUsername = profile.username;
            user.discordDiscriminator = profile.discriminator;
            user.discordAvatar = profile.avatar;

            await userRepository.save(user);
            const actualUser = await userRepository.findOne({ email: user.email });
            if (!actualUser) {
              throw new Error("couldn't save user");
            }

            return actualUser;
          }

          user.discordUsername = profile.username;
          user.discordDiscriminator = profile.discriminator;
          user.discordAvatar = profile.avatar;
          await userRepository.save(user);

          return user;
        })()
          .then((user) => done(null, user))
          .catch((err) => done(err));
      },
    )
  );

  Passport.use(
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme("jwt"),
        secretOrKey: config.JWT_SECRET
      },
      async (payload, done) => {
        const user = await userRepository.findOne({
          id: payload.id,
          email: payload.email,
          hasVerifiedEmail: payload.hasVerifiedEmail
        });

        if (!user) {
          return done(null, false);
        }

        return done(null, user);
      }
    )
  );

  return Passport.initialize();
};
