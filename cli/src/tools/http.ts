import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";
import chalk from "chalk";
import { sessionHeaders, testExecutionLogs } from "./state.js";
import { formatMethodBadge, formatStatusBadge } from "../ui.js";

export const executeHttpRequestTool = tool(
  async ({
    method,
    url,
    headersJson = "{}",
    paramsJson = "{}",
    bodyJson = "{}",
  }: {
    method: string;
    url: string;
    headersJson?: string;
    paramsJson?: string;
    bodyJson?: string;
  }) => {
    const cleanMethod = method.trim().toUpperCase();
    const mergedHeaders: Record<string, string> = { ...sessionHeaders };
    try {
      if (headersJson && headersJson.trim() !== "{}") {
        Object.assign(mergedHeaders, JSON.parse(headersJson));
      }
    } catch {
      return "Error: headersJson must be valid JSON.";
    }

    let params = {};
    let data = undefined;
    try {
      if (paramsJson && paramsJson.trim() !== "{}") {
        params = JSON.parse(paramsJson);
      }
      if (bodyJson && bodyJson.trim() !== "{}") {
        data = JSON.parse(bodyJson);
      }
    } catch (e: any) {
      return `Error parsing JSON parameters: ${e.message}`;
    }

    const startTime = Date.now();
    try {
      const response = await axios({
        method: cleanMethod,
        url,
        headers: mergedHeaders,
        params,
        data,
        validateStatus: () => true,
        timeout: 15000,
      });

      const elapsedMs = Date.now() - startTime;
      const methodBadge = formatMethodBadge(cleanMethod);
      const statusBadge = formatStatusBadge(response.status);
      const latencyStr = chalk.dim(`${elapsedMs}ms`);

      let pathPreview = url;
      try {
        const u = new URL(url);
        pathPreview = u.pathname + (u.search || "");
      } catch {
        pathPreview = url;
      }

      console.log(`  ⚡ ${methodBadge} ${chalk.white(pathPreview)}  ${statusBadge}  ${latencyStr}`);

      const now = new Date();
      testExecutionLogs.push({
        method: cleanMethod,
        url,
        statusCode: response.status,
        elapsedMs,
        timestamp: `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`,
        params,
        body: data,
        response: response.data,
        passed: (response.status >= 200 && response.status < 400) || response.status === 401 || response.status === 404,
      });

      return JSON.stringify(
        {
          status_code: response.status,
          status_text: response.statusText,
          elapsed_ms: elapsedMs,
          headers: response.headers,
          response_body: response.data,
        },
        null,
        2
      );
    } catch (err: any) {
      console.log(`  ✕ ${chalk.bgRed.white(` ${cleanMethod} `)} ${chalk.red(url)}  ${chalk.red(err.message)}`);
      return JSON.stringify({
        error: `Request failed: ${err.message}`,
        status_code: 0,
      });
    }
  },
  {
    name: "execute_http_request",
    description: "Execute a real HTTP request (GET, POST, PUT, DELETE) to test an API endpoint. Automatically merges session auth headers and logs latency.",
    schema: z.object({
      method: z.string().describe("HTTP method, e.g. GET, POST, DELETE"),
      url: z.string().describe("Target endpoint URL"),
      headersJson: z.string().default("{}").describe("Optional JSON string of custom headers"),
      paramsJson: z.string().default("{}").describe("Optional JSON string of query parameters"),
      bodyJson: z.string().default("{}").describe("Optional JSON string payload body"),
    }),
  }
);
