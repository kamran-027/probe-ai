import { tool } from "@langchain/core/tools";
import { z } from "zod";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import { testExecutionLogs } from "./state.js";
import { logStep } from "../ui.js";

export const saveHtmlAuditReportTool = tool(
  async ({
    filename = "audit_report.html",
    reportTitle = "ProbeAI API Audit Report",
  }: {
    filename?: string;
    reportTitle?: string;
  }) => {
    const total = testExecutionLogs.length;
    if (total === 0) {
      return "No test execution logs recorded in this session yet. Run tests first before exporting a report.";
    }

    const reportsDir = path.resolve(process.cwd(), "reports");
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    let outPath = path.join(reportsDir, path.basename(filename));
    if (!outPath.endsWith(".html")) {
      outPath += ".html";
    }

    const passed = testExecutionLogs.filter((l) => l.statusCode >= 200 && l.statusCode < 400).length;
    const avgLatency = Math.round(
      testExecutionLogs.reduce((acc, curr) => acc + curr.elapsedMs, 0) / total
    );
    const healthScore = Math.round((passed / total) * 100);

    let rowsHtml = "";
    for (const log of testExecutionLogs) {
      const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
      const statusBadge = isSuccess
        ? `<span class="badge badge-success">${log.statusCode} OK</span>`
        : `<span class="badge badge-error">${log.statusCode}</span>`;

      const responseJson =
        typeof log.response === "object"
          ? JSON.stringify(log.response, null, 2)
          : String(log.response);

      rowsHtml += `
        <div class="test-card">
          <div class="test-header">
            <div class="test-meta">
              <span class="method-tag method-${log.method.toLowerCase()}">${log.method}</span>
              <span class="test-url">${log.url}</span>
            </div>
            <div class="test-stats">
              <span class="latency-tag">${log.elapsedMs} ms</span>
              ${statusBadge}
            </div>
          </div>
          <details class="test-details">
            <summary>View Request / Response Payload</summary>
            <div class="payload-box">
              <strong>Response Body:</strong>
              <pre><code>${responseJson}</code></pre>
            </div>
          </details>
        </div>
      `;
    }

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${reportTitle}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root { --bg: #f8fafc; --card-bg: #ffffff; --text: #0f172a; --border: #e2e8f0; --accent: #4f46e5; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); padding: 40px 20px; max-width: 900px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { font-size: 24px; font-weight: 800; margin-bottom: 4px; }
    .header p { color: #64748b; font-size: 13px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 30px; }
    .stat-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; padding: 20px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.03); }
    .stat-val { font-size: 28px; font-weight: 800; color: var(--accent); }
    .stat-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-top: 4px; }
    .test-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 14px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
    .test-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
    .test-meta { display: flex; align-items: center; gap: 8px; font-family: monospace; font-size: 13px; }
    .method-tag { font-weight: 700; padding: 2px 8px; border-radius: 6px; font-size: 11px; }
    .method-get { background: #eff6ff; color: #2563eb; }
    .method-post { background: #f0fdf4; color: #16a34a; }
    .method-delete { background: #fef2f2; color: #dc2626; }
    .badge { padding: 3px 8px; border-radius: 99px; font-size: 11px; font-weight: 700; font-family: monospace; }
    .badge-success { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
    .badge-error { background: #fef2f2; color: #e11d48; border: 1px solid #fecdd3; }
    .latency-tag { font-size: 11px; color: #64748b; font-family: monospace; margin-right: 6px; }
    .test-details { margin-top: 12px; font-size: 12px; }
    .test-details summary { cursor: pointer; color: var(--accent); font-weight: 500; outline: none; }
    .payload-box { background: #f1f5f9; padding: 12px; border-radius: 8px; margin-top: 8px; overflow-x: auto; }
    pre { margin: 0; font-size: 11px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔍 ProbeAI Reliability Audit</h1>
    <p>Generated on ${new Date().toISOString()} • Autonomous Test Suite</p>
  </div>
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-val">${healthScore}%</div><div class="stat-label">Health Score</div></div>
    <div class="stat-card"><div class="stat-val">${passed}/${total}</div><div class="stat-label">Tests Passed</div></div>
    <div class="stat-card"><div class="stat-val">${avgLatency}ms</div><div class="stat-label">Avg Latency</div></div>
  </div>
  <h3>Executed Test Cases</h3>
  ${rowsHtml}
</body>
</html>
`;

    fs.writeFileSync(outPath, htmlContent);
    logStep("📊", "Generated HTML Audit Dashboard", chalk.hex("#10B981")(outPath));
    return `HTML audit report successfully generated at '${outPath}'. Open it in your browser to view the interactive dashboard!`;
  },
  {
    name: "save_html_audit_report",
    description: "Generate an executive standalone single-page HTML audit report with health scores, latency metrics, and expandable request/response inspection accordions.",
    schema: z.object({
      filename: z.string().default("audit_report.html").describe("Report filename (default: audit_report.html)"),
      reportTitle: z.string().default("ProbeAI API Audit Report").describe("Title for the report"),
    }),
  }
);
