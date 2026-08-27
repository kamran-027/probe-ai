import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";
import chalk from "chalk";
import { sessionHeaders } from "./state.js";
import { logStep } from "../ui.js";

export const authenticateViaLoginTool = tool(
  async ({
    loginUrl,
    method = "POST",
    payloadJson = "{}",
    tokenField = "access_token",
  }: {
    loginUrl: string;
    method?: string;
    payloadJson?: string;
    tokenField?: string;
  }) => {
    logStep("🔐", "Authenticating via login endpoint...", chalk.dim(loginUrl));

    let payload = {};
    try {
      if (payloadJson && payloadJson.trim() !== "{}") {
        payload = JSON.parse(payloadJson);
      }
    } catch {
      return "Error: payloadJson must be a valid JSON string.";
    }

    try {
      const res = await axios({
        method: method.toUpperCase(),
        url: loginUrl,
        data: payload,
        timeout: 10000,
      });

      const data = res.data;
      let token = null;
      if (data && typeof data === "object") {
        token =
          data[tokenField] ||
          data.token ||
          data.access_token ||
          data.jwt ||
          data.key;
      }

      if (!token) {
        logStep("✕", "Login succeeded but token field not found", chalk.red(tokenField));
        return `Login succeeded (HTTP ${res.status}), but token field '${tokenField}' was not found in response: ${JSON.stringify(data)}`;
      }

      sessionHeaders["Authorization"] = `Bearer ${token}`;
      logStep("✓", "Extracted Bearer token & saved to session", chalk.hex("#10B981")("Authorization: Bearer ••••••"));
      return `Authentication successful. Bearer token extracted from '${tokenField}' and saved to session headers.`;
    } catch (err: any) {
      logStep("✕", "Login failed", chalk.red(err.message));
      return `Login request failed: ${err.message}`;
    }
  },
  {
    name: "authenticate_via_login",
    description: "Execute a login or token generation endpoint (e.g. POST /auth/login with credentials), extract the bearer token from JSON response, and save it to the session headers.",
    schema: z.object({
      loginUrl: z.string().describe("The URL of the login/auth endpoint"),
      method: z.string().optional().describe("HTTP method (default: POST)"),
      payloadJson: z.string().optional().describe("JSON string payload with email/username/password"),
      tokenField: z.string().optional().describe("Field name containing the token in JSON response (default: access_token)"),
    }),
  }
);

export const setAuthHeaderTool = tool(
  async ({ headerName, tokenValue }: { headerName: string; tokenValue: string }) => {
    let cleanVal = tokenValue.trim();
    if (
      headerName.toLowerCase() === "authorization" &&
      !cleanVal.toLowerCase().startsWith("bearer ") &&
      !cleanVal.toLowerCase().startsWith("basic ")
    ) {
      cleanVal = `Bearer ${cleanVal}`;
    }

    sessionHeaders[headerName] = cleanVal;
    logStep("🔑", `Set auth header: ${headerName}`, chalk.hex("#10B981")("••••••"));
    return `Successfully set '${headerName}' header in session.`;
  },
  {
    name: "set_auth_header",
    description: "Directly set an authentication header into the active session (e.g. headerName='Authorization', tokenValue='Bearer eyJ...').",
    schema: z.object({
      headerName: z.string().describe("Header key, e.g. Authorization or X-API-Key"),
      tokenValue: z.string().describe("Token or API key value"),
    }),
  }
);
