import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import { logStep } from "../ui.js";

export const exportPostmanCollectionTool = tool(
  async ({
    baseUrl,
    outputFilename = "probe_collection.json",
  }: {
    baseUrl: string;
    outputFilename?: string;
  }) => {
    let targetUrl = baseUrl.replace(/\/+$/, "");
    if (!targetUrl.endsWith("openapi.json")) {
      targetUrl = `${targetUrl}/openapi.json`;
    }

    logStep("📦", "Generating Postman v2.1 Collection...", chalk.dim(baseUrl));

    try {
      const res = await axios.get(targetUrl, { timeout: 10000 });
      const spec = res.data;

      const collectionName = spec.info?.title || "Exported API Collection";
      const postmanItems: any[] = [];

      const parsedUrl = new URL(baseUrl);
      const hostParts = parsedUrl.hostname.split(".");
      const protocol = parsedUrl.protocol.replace(":", "");
      const port = parsedUrl.port || (protocol === "https" ? "443" : "80");

      for (const [routePath, methods] of Object.entries(spec.paths || {}) as [string, any][]) {
        for (const [method, details] of Object.entries(methods) as [string, any][]) {
          const pathSegments = routePath.split("/").filter(Boolean);

          postmanItems.push({
            name: details.summary || `${method.toUpperCase()} ${routePath}`,
            request: {
              method: method.toUpperCase(),
              header: [
                { key: "Content-Type", value: "application/json", type: "text" },
              ],
              url: {
                raw: `${baseUrl.replace(/\/+$/, "")}${routePath}`,
                protocol,
                host: hostParts,
                port,
                path: pathSegments,
              },
              description: details.description || "",
            },
          });
        }
      }

      const postmanCollection = {
        info: {
          name: `${collectionName} (ProbeAI Export)`,
          _postman_id: `probeai-${Date.now()}`,
          description: "Auto-generated Postman Collection by ProbeAI",
          schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        item: postmanItems,
      };

      const reportsDir = path.resolve(process.cwd(), "reports");
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      const outPath = path.join(reportsDir, path.basename(outputFilename));
      fs.writeFileSync(outPath, JSON.stringify(postmanCollection, null, 2));

      logStep("✓", `Saved Postman Collection (${postmanItems.length} routes)`, chalk.hex("#10B981")(outPath));
      return `Postman collection with ${postmanItems.length} endpoints successfully generated at '${outPath}'. You can import this directly into Postman/Bruno/Insomnia!`;
    } catch (err: any) {
      logStep("✕", "Postman Export Failed", chalk.red(err.message));
      return `Failed to export Postman collection: ${err.message}`;
    }
  },
  {
    name: "export_postman_collection",
    description: "Generate a ready-to-import Postman Collection v2.1.0 JSON file directly from the base URL's OpenAPI spec.",
    schema: z.object({
      baseUrl: z.string().describe("The base URL of the API server"),
      outputFilename: z.string().default("probe_collection.json").describe("Output filename (default: probe_collection.json)"),
    }),
  }
);
