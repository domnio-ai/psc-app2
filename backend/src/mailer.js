import { config } from "./config.js";
import { createMailService } from "./mail-service.js";

const service = createMailService(config.smtp, async (options) => {
  let nodemailer;
  try {
    nodemailer = (await import("nodemailer")).default;
  } catch {
    throw new Error("The nodemailer dependency is not installed.");
  }
  return nodemailer.createTransport(options);
});

export const mailStatus = service.mailStatus;
export const sendMail = service.sendMail;
