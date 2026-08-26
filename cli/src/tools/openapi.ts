import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";
import chalk from "chalk";

export const fetchOpenApiSpecTool = tool(
  async ({ baseUrl }: { baseUrl: string }) => {
    console.log(chalk.cyan(`\n🔍 [Tool: fetch_openapi_spec] Probing: ${baseUrl}`));
    
    let targetUrl = baseUrl.replace(/\/+$/, "");
    if (!targetUrl.endsWith("openapi.json")) {
      targetUrl = `${targetUrl}/openapi.json`;
    }

    try {
      const response = await axios.get(targetUrl, { timeout: 10000 });
      const spec = response.data;

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

      return JSON.stringify(
        {
          title: info.title || "API Spec",
          version: info.version || "1.0",
          security_schemes: securitySchemes,
          endpoint_count: endpointsSummary.length,
          endpoints: endpointsSummary.slice(0, 15),
        },
        null,
        2
      );
    } catch (err: any) {
      return `Could not fetch OpenAPI spec from ${targetUrl}: ${err.message}`;
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
