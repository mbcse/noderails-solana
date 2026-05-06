import { Worker } from "bullmq";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { renderWallCardOtpEmailHtml, renderWallCardOtpEmailText } from "./otp-email-template.js";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };

/** RFC 5322 From with friendly display name (avoids bare no-reply in inbox). */
function formatSesFromAddress(): string {
  const raw = process.env.SES_FROM_EMAIL?.trim() ?? "";
  if (!raw) return "";
  const display =
    process.env.SES_FROM_DISPLAY_NAME?.trim() ||
    "WallCard by NodeRails";
  const bareEmail = /^[^\s<>]+@[^\s<>]+$/.test(raw);
  if (bareEmail) return `${display} <${raw}>`;
  return raw;
}

const sesFromAddress = formatSesFromAddress();

function sesReadyForSend(): boolean {
  return Boolean(
    sesFromAddress &&
      process.env.AWS_ACCESS_KEY_ID?.trim() &&
      process.env.AWS_SECRET_ACCESS_KEY?.trim()
  );
}

const sesClient = new SESv2Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
      }
    : {})
});

new Worker(
  "otp-delivery",
  async (job) => {
    const { destination, code, channel, purpose } = job.data as {
      destination: string;
      code: string;
      channel?: string;
      purpose?: string;
    };
    if (channel !== "email") {
      console.log(`skip otp delivery for non-email channel destination=${destination}`);
      return;
    }
    if (!sesReadyForSend()) {
      if (process.env.APP_ENV === "production") {
        throw new Error(
          "email_otp_blocked: configure SES_FROM_EMAIL + AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY"
        );
      }
      const logPlaintextOtp =
        process.env.OTP_DEBUG_LOG_CODE?.trim().toLowerCase() === "true" ||
        process.env.OTP_DEBUG_LOG_CODE === "1";
      console.log(
        `\n┌── WallCard OTP — email not configured (dev only) ──\n` +
          `│ To:       ${destination}\n` +
          `│ Purpose:  ${String((job.data as { purpose?: string }).purpose ?? "unknown")}\n` +
          (logPlaintextOtp
            ? `│ Code:     ${code}\n`
            : `│ Code:     configure SES for delivery — set OTP_DEBUG_LOG_CODE=true to log plaintext locally only\n`) +
          `└──────────────────────────────────────────────────────────────────────────\n`
      );
      return;
    }
    const logoUrl = process.env.WALLCARD_OTP_EMAIL_LOGO_URL?.trim();
    const html = renderWallCardOtpEmailHtml({
      code,
      purpose,
      expiresInMinutes: 5,
      logoUrl: logoUrl || undefined
    });
    const text = renderWallCardOtpEmailText({ code, purpose, expiresInMinutes: 5 });

    await sesClient.send(
      new SendEmailCommand({
        FromEmailAddress: sesFromAddress,
        Destination: { ToAddresses: [destination] },
        Content: {
          Simple: {
            Subject: { Data: "Your WallCard verification code" },
            Body: {
              Html: { Charset: "UTF-8", Data: html },
              Text: { Charset: "UTF-8", Data: text }
            }
          }
        }
      })
    );
    console.log(`otp email sent -> ${destination}`);
  },
  { connection }
);

new Worker(
  "signing-jobs",
  async (job) => {
    const { signingRequestId, chain } = job.data as { signingRequestId: string; chain: "evm" | "solana" };
    console.log(`track signing confirmation request=${signingRequestId} chain=${chain}`);
  },
  { connection }
);

new Worker(
  "webhook-delivery",
  async (job) => {
    const { url, payload } = job.data as { url: string; payload: unknown };
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    console.log(`webhook status=${res.status} url=${url}`);
  },
  { connection }
);

console.log("worker ready");
