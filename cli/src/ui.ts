import chalk from "chalk";
import boxen from "boxen";

export function printModernBanner(version: string = "1.0.4") {
  const content =
    `${chalk.bold.hex("#6366F1")("✦ PROBE AI")}  ${chalk.dim(`v${version}`)}  ${chalk.hex("#10B981")("● READY")}\n` +
    `${chalk.white("Autonomous API Schema & Reliability Inspector")}\n\n` +
    `${chalk.dim("Capabilities:")}\n` +
    `  ${chalk.cyan("•")} ${chalk.bold("OpenAPI Discovery")}  ${chalk.dim("Auto-maps schemas & security")}\n` +
    `  ${chalk.cyan("•")} ${chalk.bold("Postman Exporter")}   ${chalk.dim("1-click collection generation")}\n` +
    `  ${chalk.cyan("•")} ${chalk.bold("Smart Auth")}         ${chalk.dim("Login token exchange & Bearer injection")}\n` +
    `  ${chalk.cyan("•")} ${chalk.bold("HTML Audit Reports")} ${chalk.dim("Latency profiling & payload replays")}\n\n` +
    `${chalk.dim("Quick Test Prompts:")}\n` +
    `  ${chalk.gray("❯")} ${chalk.yellow("Inspect https://bookmark-agent-backend.onrender.com and export Postman collection")}\n` +
    `  ${chalk.gray("❯")} ${chalk.yellow("Test all endpoints on http://localhost:8000 and save HTML report")}\n` +
    `  ${chalk.dim("Type 'exit' to quit")}`;

  console.log(
    boxen(content, {
      padding: { top: 1, bottom: 1, left: 2, right: 2 },
      margin: { top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor: "#6366F1",
    })
  );
}

export function formatMethodBadge(method: string): string {
  const m = method.toUpperCase();
  switch (m) {
    case "GET":
      return chalk.bgBlue.bold.white(" GET ");
    case "POST":
      return chalk.bgGreen.bold.white(" POST ");
    case "PUT":
      return chalk.bgYellow.bold.black(" PUT ");
    case "DELETE":
      return chalk.bgRed.bold.white(" DEL ");
    case "PATCH":
      return chalk.bgMagenta.bold.white(" PATCH ");
    default:
      return chalk.bgGray.bold.white(` ${m} `);
  }
}

export function formatStatusBadge(status: number): string {
  if (status >= 200 && status < 300) {
    return chalk.hex("#10B981").bold(`${status} OK`);
  }
  if (status === 401 || status === 403) {
    return chalk.hex("#F59E0B").bold(`${status} Auth Required`);
  }
  if (status === 404) {
    return chalk.hex("#64748B").bold(`${status} Not Found`);
  }
  if (status === 422) {
    return chalk.hex("#EC4899").bold(`${status} Unprocessable Entity`);
  }
  return chalk.hex("#EF4444").bold(`${status} Error`);
}

export function logStep(icon: string, title: string, detail: string = "") {
  const iconColored = chalk.hex("#6366F1")(icon);
  const titleColored = chalk.bold.white(title);
  const detailColored = detail ? chalk.dim(` ${detail}`) : "";
  console.log(`  ${iconColored}  ${titleColored}${detailColored}`);
}
