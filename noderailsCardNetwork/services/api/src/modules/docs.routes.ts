import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";

const registry = new OpenAPIRegistry();
registry.registerPath({
  method: "post",
  path: "/v1/auth/otp/request",
  responses: { 200: { description: "OTP requested" } }
});
registry.registerPath({
  method: "post",
  path: "/v1/auth/otp/verify",
  responses: { 200: { description: "OTP verified and JWT issued" } }
});
registry.registerPath({
  method: "post",
  path: "/v1/signing-requests",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            chain: z.enum(["evm", "solana"]),
            method: z.string()
          })
        }
      }
    }
  },
  responses: {
    202: {
      description: "Signing request accepted"
    }
  }
});
registry.registerPath({
  method: "get",
  path: "/v1/signing-requests/methods",
  responses: { 200: { description: "Supported signing methods" } }
});
registry.registerPath({
  method: "post",
  path: "/v1/signing-requests/{id}/confirm",
  responses: { 200: { description: "Request signed" } }
});
registry.registerPath({
  method: "get",
  path: "/v1/wallet/profile",
  responses: { 200: { description: "Email + display name for card surfaces" } }
});
registry.registerPath({
  method: "get",
  path: "/v1/wallet/activity",
  responses: { 200: { description: "Recent signing requests (Web3), optional client origin" } }
});

const generator = new OpenApiGeneratorV31(registry.definitions);
const doc = generator.generateDocument({
  openapi: "3.1.0",
  info: {
    title: "Noderails Card API",
    version: "0.1.0"
  }
});

export const docsRouter: ExpressRouter = Router();
docsRouter.get("/openapi.json", (_req, res) => {
  res.json(doc);
});
