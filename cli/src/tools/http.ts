import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";
import chalk from "chalk";
import { sessionHeaders, testExecutionLogs } from "./state.js";

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
    console.log(chalk.yellow(`\n⚡ [Tool: execute_http_request] ${cleanMethod} ${url}`));

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
        validateStatus: () => true, // Don't throw on 4xx/5xx so agent can inspect response
        timeout: 15000,
      });

      const elapsedMs = Date.now() - startTime;
      const statusColor = response.status >= 200 && response.status < 300 ? chalk.green : chalk.red;
      console.log(`  └─ Status: ${statusColor(response.status)} | Latency: ${chalk.cyan(`${elapsedMs}ms`)}`);

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
      headersJson: z.string().optional().describe("Optional JSON string of custom headers"),
      paramsJson: z.string().optional().describe("Optional JSON string of query parameters"),
      bodyJson: z.string().optional().describe("Optional JSON string payload body"),
    }),
  }
);
