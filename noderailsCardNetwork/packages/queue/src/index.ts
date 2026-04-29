import { Queue } from "bullmq";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };

export const otpQueue = new Queue("otp-delivery", { connection });
export const signingQueue = new Queue("signing-jobs", { connection });
export const webhookQueue = new Queue("webhook-delivery", { connection });
