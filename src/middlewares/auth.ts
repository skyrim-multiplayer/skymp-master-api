import { Context } from "koa";
import { RouterContext } from "koa-router";
import * as Passport from "koa-passport";
import * as R from "ramda";

import { Strategies } from "../utils/passport-init";
import { Roles } from "../models/user";

export const withAuth = (
  roles: Roles[] = [],
  hasVerifiedEmail = true
) => async (
  ctx: Context | RouterContext,
  next: () => Promise<unknown>
): Promise<void> => {
  await Passport.authenticate(Strategies.jwt, async (err, user) => {
    if (err) return ctx.throw(500, err);
    if (!user) return ctx.throw(401, "Unauthorized");
    if (hasVerifiedEmail && !user.hasVerifiedEmail)
      return ctx.throw(403, "Your email not verified");
    if (roles.length && !R.intersection(user.roles, roles).length)
      return ctx.throw(403, "You don't have permission to access");
    (ctx as Record<string, unknown>).user = user;
    await next();
  })(ctx, next);
};
