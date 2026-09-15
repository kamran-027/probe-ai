import dotenv from "dotenv";
dotenv.config();

import chalk from "chalk";
import ora from "ora";
import readline from "readline";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { createProbeAgent, PROBE_SYSTEM_MESSAGE } from "./agent.js";
import { printExecutiveBanner, printHelpMenu, renderSessionContextBar } from "./ui.js";
import { resolveProviderConfig } from "./wizard.js";
import { sessionContext, sessionHeaders, testExecutionLogs } from "./tools/state.js";

// Configure marked for clean, modern terminal rendering
marked.use(
  markedTerminal({
    width: 92,
    reflowText: true,
    tab: 2,
    heading: chalk.bold.hex("#818CF8"),
    firstHeading: chalk.bold.hex("#A855F7"),
    strong: chalk.bold.white,
    listitem: chalk.cyan,
    tableOptions: {
      style: {
        head: ["cyan", "bold"],
        border: ["gray"],
      },
    },
  }) as any
);

async function main() {
  const providerConfig = await resolveProviderConfig();
  console.clear();
  printExecutiveBanner(
    "1.2.2",
    providerConfig.provider,
    providerConfig.modelName,
    sessionContext.targetUrl,
    sessionContext.authDescription
  );

  const app = createProbeAgent(providerConfig);
  const messages: BaseMessage[] = [PROBE_SYSTEM_MESSAGE];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const promptUser = (questionText: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(questionText, (answer) => {
        resolve(answer.trim());
      });
    });
  };

  while (true) {
    let spinner: any = null;
    try {
      renderSessionContextBar(
        sessionContext.targetUrl,
        sessionContext.authDescription,
        providerConfig.modelName || providerConfig.provider
      );

      const promptSymbol = chalk.hex("#818CF8").bold("probe-ai ❯ ");
      const input = await promptUser(`\n${promptSymbol}`);
      if (!input) continue;

      const trimmed = input.trim();

      if (trimmed.toLowerCase() === "exit" || trimmed.toLowerCase() === "quit" || trimmed.toLowerCase() === "/exit") {
        console.log(chalk.hex("#818CF8")("\nGoodbye! 👋\n"));
        rl.close();
        process.exit(0);
      }

      if (trimmed.toLowerCase() === "/clear") {
        console.clear();
        printExecutiveBanner(
          "1.2.2",
          providerConfig.provider,
          providerConfig.modelName,
          sessionContext.targetUrl,
          sessionContext.authDescription
        );
        continue;
      }

      if (trimmed.toLowerCase() === "/reset") {
        messages.length = 0;
        messages.push(PROBE_SYSTEM_MESSAGE);
        console.log(chalk.hex("#10B981")("\n  ✓ Conversation session reset.\n"));
        continue;
      }

      if (trimmed.toLowerCase() === "/help") {
        printHelpMenu();
        continue;
      }

      if (trimmed.toLowerCase().startsWith("/target")) {
        const parts = trimmed.split(/\s+/);
        if (parts.length > 1) {
          sessionContext.targetUrl = parts[1].trim();
          console.log(chalk.hex("#10B981")(`\n  ✓ Active target URL set to: ${chalk.white.underline(sessionContext.targetUrl)}\n`));
        } else {
          console.log(chalk.yellow(`\n  Usage: /target http://localhost:8000\n`));
        }
        continue;
      }

      if (trimmed.toLowerCase().startsWith("/auth")) {
        const parts = trimmed.split(/\s+/);
        if (parts.length > 1) {
          const rawToken = parts.slice(1).join(" ").trim();
          const token = rawToken.toLowerCase().startsWith("bearer ") ? rawToken : `Bearer ${rawToken}`;
          sessionHeaders["Authorization"] = token;
          sessionContext.authDescription = `Bearer ••••••${token.slice(-4)}`;
          console.log(chalk.hex("#10B981")(`\n  ✓ Authentication header saved: ${chalk.white(sessionContext.authDescription)}\n`));
        } else {
          console.log(chalk.yellow(`\n  Usage: /auth <bearer_token_or_key>\n`));
        }
        continue;
      }

      if (trimmed.toLowerCase() === "/status") {
        console.log(
          chalk.hex("#818CF8").bold("\n  PROBE·AI  ·  Active Session Status\n") +
          `  ${chalk.dim("Target URL:")}      ${sessionContext.targetUrl ? chalk.white.underline(sessionContext.targetUrl) : chalk.dim("None")}\n` +
          `  ${chalk.dim("Auth Status:")}     ${sessionContext.authDescription !== "None" ? chalk.hex("#F59E0B")(sessionContext.authDescription) : chalk.dim("None")}\n` +
          `  ${chalk.dim("AI Engine:")}       ${chalk.cyan(providerConfig.provider.toUpperCase())} ${providerConfig.modelName ? chalk.dim(`(${providerConfig.modelName})`) : ""}\n` +
          `  ${chalk.dim("HTTP Calls Run:")}  ${chalk.white(testExecutionLogs.length.toString())}\n`
        );
        continue;
      }

      // Auto-detect target URL if mentioned in prompt
      const urlMatch = trimmed.match(/https?:\/\/[^\s]+/i);
      if (urlMatch && !sessionContext.targetUrl) {
        sessionContext.targetUrl = urlMatch[0].replace(/\/+$/, "");
      }

      console.log(); // Clean line break
      messages.push(new HumanMessage(input));

      spinner = ora({
        text: chalk.hex("#94A3B8")("Analyzing contracts & running reliability checks..."),
        spinner: "dots",
        color: "magenta",
      }).start();

      let finalResponse = "";
      let updatedMessages = messages;

      const stream = await app.stream({ messages }, { streamMode: "values" });
      for await (const event of stream) {
        if (event && event.messages && event.messages.length > 0) {
          updatedMessages = event.messages;
          const lastMsg = event.messages[event.messages.length - 1];
          if (
            lastMsg instanceof AIMessage &&
            (!lastMsg.tool_calls || lastMsg.tool_calls.length === 0)
          ) {
            finalResponse =
              typeof lastMsg.content === "string"
                ? lastMsg.content
                : JSON.stringify(lastMsg.content, null, 2);
          }
        }
      }

      spinner.stop();

      // Persist full conversation state for subsequent turns
      messages.length = 0;
      messages.push(...updatedMessages);

      if (finalResponse) {
        console.log(
          chalk.hex("#4F46E5")(
            "\n─── ProbeAI Assessment ─────────────────────────────────────────────────────────\n"
          )
        );
        const rendered = marked(finalResponse);
        console.log(rendered);
        console.log(
          chalk.hex("#4F46E5")(
            "───────────────────────────────────────────────────────────────────────────────\n"
          )
        );
      }
    } catch (err: any) {
      if (spinner && spinner.isSpinning) {
        spinner.stop();
      }
      // If turn failed, rollback the last unfulfilled HumanMessage to prevent corrupted state
      if (messages[messages.length - 1] instanceof HumanMessage) {
        messages.pop();
      }
      console.log(chalk.red(`\nAn error occurred: ${err.message}`));
      console.log(chalk.dim("Session preserved. You can continue chatting or type /reset to restart."));
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
