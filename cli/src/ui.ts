import chalk from "chalk";
import boxen from "boxen";

export function printExecutiveBanner(
  version: string = "1.2.2",
  provider: string = "gemini",
  modelName?: string,
  targetUrl?: string,
  authStatus?: string
) {
  const brand = chalk.bold.hex("#818CF8")("PROBE") + chalk.bold.white("·AI");
  const tag = chalk.dim("API INSPECTOR");
  const subtitle = chalk.hex("#94A3B8")("Autonomous API Reliability Engine & Schema Inspector");
  const verBadge = chalk.dim(`v${version}`);

  const engineLabel = chalk.dim("Engine: ") + chalk.cyan(provider.toUpperCase()) + (modelName ? chalk.dim(` (${modelName})`) : "");
  const statusBadge = chalk.dim("Status: ") + chalk.hex("#10B981")("● Ready");
  const targetLabel = chalk.dim("Target: ") + (targetUrl ? chalk.white.underline(targetUrl) : chalk.dim("None (set in prompt or /target)"));
  const authLabel = chalk.dim("Auth: ") + (authStatus && authStatus !== "None" ? chalk.hex("#F59E0B")(authStatus) : chalk.dim("None"));

  const content =
    `  ${brand}  ${verBadge}  ${chalk.dim("·")}  ${tag}\n` +
    `  ${subtitle}\n\n` +
    `  ${engineLabel}  ·  ${statusBadge}\n` +
    `  ${targetLabel}  ·  ${authLabel}`;

  console.log(
    boxen(content, {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: { top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor: "#4F46E5",
    })
  );
}

// Backward compatibility alias
export function printModernBanner(version: string = "1.2.2") {
  printExecutiveBanner(version);
}

export function renderSessionContextBar(targetUrl?: string, authDesc?: string, modelName?: string) {
  const target = targetUrl ? chalk.white.underline(targetUrl) : chalk.dim("no target set");
  const auth = authDesc && authDesc !== "None" ? chalk.hex("#F59E0B")(authDesc) : chalk.dim("no auth");
  const model = modelName ? chalk.cyan(modelName) : chalk.dim("default engine");

  console.log(
    chalk.dim("  [ ") +
    chalk.dim("Target: ") + target + chalk.dim("  ·  ") +
    chalk.dim("Auth: ") + auth + chalk.dim("  ·  ") +
    chalk.dim("Model: ") + model +
    chalk.dim(" ]")
  );
}

export function formatMethodBadge(method: string): string {
  const m = method.toUpperCase().trim();
  switch (m) {
    case "GET":
      return chalk.bgHex("#1E3A8A").hex("#93C5FD").bold(" GET ");
    case "POST":
      return chalk.bgHex("#064E3B").hex("#6EE7B7").bold(" POST ");
    case "PUT":
      return chalk.bgHex("#78350F").hex("#FDE68A").bold(" PUT ");
    case "DELETE":
    case "DEL":
      return chalk.bgHex("#881337").hex("#FDA4AF").bold(" DEL ");
    case "PATCH":
      return chalk.bgHex("#4C1D95").hex("#DDD6FE").bold(" PATCH ");
    default:
      return chalk.bgHex("#27272A").hex("#E4E4E7").bold(` ${m} `);
  }
}

export function formatStatusBadge(status: number): string {
  if (status >= 200 && status < 300) {
    return chalk.hex("#10B981").bold(`${status} OK`);
  }
  if (status === 401) {
    return chalk.hex("#F59E0B").bold(`${status} Unauthorized`);
  }
  if (status === 403) {
    return chalk.hex("#F59E0B").bold(`${status} Forbidden`);
  }
  if (status === 404) {
    return chalk.hex("#94A3B8").bold(`${status} Not Found`);
  }
  if (status === 422) {
    return chalk.hex("#EC4899").bold(`${status} Unprocessable Entity`);
  }
  if (status >= 500) {
    return chalk.hex("#EF4444").bold(`${status} Server Error`);
  }
  return chalk.hex("#A1A1AA").bold(`${status}`);
}

export function logStep(icon: string, title: string, detail: string = "", isSubItem: boolean = false) {
  const prefix = isSubItem ? chalk.dim("  │  └─ ") : chalk.hex("#818CF8")("  ◇ ");
  const titleColored = isSubItem ? chalk.hex("#E2E8F0")(title) : chalk.bold.white(title);
  const detailColored = detail ? chalk.dim(` ${detail}`) : "";
  console.log(`${prefix}${titleColored}${detailColored}`);
}

export function printHelpMenu() {
  console.log(
    chalk.hex("#818CF8").bold("\n  PROBE·AI  ·  Commands & Controls\n") +
    chalk.dim("  Commands:\n") +
    `    ${chalk.cyan("/target <url>")}   ${chalk.dim("Set or switch the active target API base URL")}\n` +
    `    ${chalk.cyan("/auth <token>")}    ${chalk.dim("Inject Bearer token or API key into session")}\n` +
    `    ${chalk.cyan("/status")}          ${chalk.dim("Show active target, auth headers, and execution count")}\n` +
    `    ${chalk.cyan("/clear")}           ${chalk.dim("Clear terminal screen and redraw executive banner")}\n` +
    `    ${chalk.cyan("/reset")}           ${chalk.dim("Reset conversation history and graph state")}\n` +
    `    ${chalk.cyan("/help")}            ${chalk.dim("Display this command menu")}\n` +
    `    ${chalk.cyan("/exit")}            ${chalk.dim("Gracefully quit ProbeAI")}\n\n` +
    chalk.dim("  Example Workflows:\n") +
    `    ${chalk.white("•")} ${chalk.yellow("inspect http://localhost:8000 and export Postman collection")}\n` +
    `    ${chalk.white("•")} ${chalk.yellow("test all endpoints on https://api.myproject.com and save HTML report")}\n` +
    `    ${chalk.white("•")} ${chalk.yellow("run security audit on GET /api/v1/users with auth header")}\n`
  );
}
