import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";
import chalk from "chalk";
import { logStep } from "../ui.js";

export const fetchOpenApiSpecTool = tool(
  async ({ baseUrl }: { baseUrl: string }) => {
    const cleanBase = baseUrl.replace(/\/+$/, "");
    const candidatePaths = cleanBase.endsWith(".json") || cleanBase.endsWith(".yaml") || cleanBase.endsWith(".yml")
      ? [cleanBase]
      : [
          `${cleanBase}/openapi.json`,
          `${cleanBase}/swagger.json`,
          `${cleanBase}/v3/api-docs`,
          `${cleanBase}/api-docs`,
          `${cleanBase}/api/openapi.json`,
          `${cleanBase}/docs/openapi.json`,
        ];

    logStep("🔍", "Probing API Documentation Specs...", chalk.cyan(cleanBase));

    let spec: any = null;
    let resolvedUrl = "";

    for (const url of candidatePaths) {
      try {
        const response = await axios.get(url, { timeout: 6000, validateStatus: (s) => s === 200 });
        if (response.data && (response.data.paths || response.data.openapi || response.data.swagger)) {
          spec = response.data;
          resolvedUrl = url;
          break;
        }
      } catch {
        // try next candidate path
      }
    }

    if (!spec) {
      logStep("✕", "No OpenAPI/Swagger spec discovered", chalk.yellow("Probed /openapi.json, /swagger.json, /v3/api-docs, /api-docs"));
      return JSON.stringify({
        status: "not_found",
        message: `No OpenAPI or Swagger spec file was exposed at ${cleanBase}. Probed paths: /openapi.json, /swagger.json, /v3/api-docs, /api-docs. You can test routes directly using execute_http_request by specifying the method and path (e.g. GET /api/v1/health or POST /auth/login), or ask the user for specific route details.`,
      });
    }

    try {
      const info = spec.info || {};
      const paths = spec.paths || {};
      const components = spec.components || {};
      const securitySchemes = components.securitySchemes || {};

      const endpointsSummary: any[] = [];
      for (const [path, methods] of Object.entries(paths) as [string, any][]) {
        for (const [method, details] of Object.entries(methods) as [string, any][]) {
          endpointsSummary.push({
            method: method.toUpperCase(),
            path,
            summary: details.summary || details.description || "No description",
            parameters: details.parameters || [],
            requestBody: Boolean(details.requestBody),
            security: details.security || spec.security || [],
          });
        }
      }

      logStep("✓", `Discovered ${endpointsSummary.length} endpoints`, chalk.dim(`from ${resolvedUrl} (v${info.version || "1.0"})`));

      return JSON.stringify(
        {
          title: info.title || "API Spec",
          version: info.version || "1.0",
          spec_url: resolvedUrl,
          security_schemes: securitySchemes,
          endpoint_count: endpointsSummary.length,
          endpoints: endpointsSummary.slice(0, 25),
        },
        null,
        2
      );
    } catch (err: any) {
      logStep("✕", "Failed to parse spec format", chalk.red(err.message));
      return `Discovered spec at ${resolvedUrl} but failed to parse: ${err.message}`;
    }
  },
  {
    name: "fetch_openapi_spec",
    description: "Fetch and parse OpenAPI/Swagger specification JSON from a base URL (e.g. http://localhost:8000).",
    schema: z.object({
      baseUrl: z.string().describe("The base URL or openapi.json URL of the API server"),
    }),
  }
);
