import * as path from "path";
import * as nodemailer from "nodemailer";
import * as EmailTemplates from "email-templates";

import { config } from "../cfg";

const rootViews = path.join(__dirname, "templates");

const createTestEmailTemplates = () => {
  const user = "ethereal.user@ethereal.email";

  const transport = nodemailer.createTransport({
    auth: {
      user: user,
      pass: "verysecret"
    },
    host: "smtp.ethereal.email",
    port: 587
  });

  return new EmailTemplates({
    views: {
      root: rootViews
    },
    message: {
      from: user
    },
    transport: transport,
    send: false
  });
};

const transport = nodemailer.createTransport({
  auth: {
    user: config.EMAIL_USER,
    pass: config.EMAIL_PASS
  },
  host: "mail.privateemail.com",
  port: 465
});

const emailObject =
  process.env.NODE_ENV === "production"
    ? new EmailTemplates({
        views: {
          root: rootViews
        },
        message: {
          from: config.EMAIL_USER
        },
        transport: transport,
        send: true
      })
    : createTestEmailTemplates();

export const sendSignupVerifyPin = async (
  email: string,
  username: string,
  code: string
): Promise<void> => {
  await emailObject.send({
    template: "signup",
    message: {
      to: email
    },
    locals: {
      username: username,
      code: code
    }
  });
};

export const sendSignupSuccess = async (email: string): Promise<void> => {
  await emailObject.send({
    template: "signup-success",
    message: {
      to: email
    }
  });
};

export const sendSignupResetPin = async (
  email: string,
  username: string,
  code: string
): Promise<void> => {
  await emailObject.send({
    template: "signup-reset-pin",
    message: {
      to: email
    },
    locals: {
      username,
      code
    }
  });
};

export const sendResetPassword = async (
  email: string,
  username: string,
  newPassword: string
): Promise<void> => {
  await emailObject.send({
    template: "reset-password",
    message: {
      to: email
    },
    locals: {
      username,
      newPassword
    }
  });
};
