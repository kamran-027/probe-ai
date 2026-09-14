import dotenv from "dotenv";
dotenv.config();

import chalk from "chalk";
import ora from "ora";
import readline from "readline";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { createProbeAgent, PROBE_SYSTEM_MESSAGE } from "./agent.js";
import { printModernBanner } from "./ui.js";
import { resolveProviderConfig } from "./wizard.js";

// Configure marked for clean, modern terminal rendering
marked.use(
  markedTerminal({
    width: 90,
    reflowText: true,
    tab: 2,
    heading: chalk.bold.hex("#6366F1"),
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
  printModernBanner("1.1.0");

  const providerConfig = await resolveProviderConfig();
  console.log(
    chalk.hex("#10B981")(
      `\n✓ Connected to ${providerConfig.provider.toUpperCase()} engine${
        providerConfig.modelName ? ` (${providerConfig.modelName})` : ""
      }\n`
    )
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
      const promptSymbol = chalk.bold.hex("#6366F1")("❯ ");
      const input = await promptUser(`\n${promptSymbol}`);
      if (!input) continue;

      const trimmed = input.trim();

      if (trimmed.toLowerCase() === "exit" || trimmed.toLowerCase() === "quit" || trimmed.toLowerCase() === "/exit") {
        console.log(chalk.hex("#6366F1")("\nGoodbye! 👋\n"));
        rl.close();
        process.exit(0);
      }

      if (trimmed.toLowerCase() === "/clear") {
        console.clear();
        printModernBanner("1.1.5");
        continue;
      }

      if (trimmed.toLowerCase() === "/reset") {
        messages.length = 0;
        messages.push(PROBE_SYSTEM_MESSAGE);
        console.log(chalk.hex("#10B981")("\n✓ Conversation session reset.\n"));
        continue;
      }

      if (trimmed.toLowerCase() === "/help") {
        console.log(
          chalk.dim("\nProbeAI Commands & Examples:") +
            chalk.cyan("\n  /clear") + chalk.dim(" - Clear screen") +
            chalk.cyan("\n  /reset") + chalk.dim(" - Reset conversation memory") +
            chalk.cyan("\n  /exit ") + chalk.dim(" - Quit ProbeAI") +
            chalk.yellow("\n\nExample Prompts:") +
            chalk.white("\n  • Inspect http://localhost:8000 and export Postman collection") +
            chalk.white("\n  • Test all endpoints on https://bookmark-agent-backend.onrender.com") +
            chalk.white("\n  • Set auth Bearer <jwt_token> and test protected routes\n")
        );
        continue;
      }

      console.log(); // Clean line break
      messages.push(new HumanMessage(input));

      spinner = ora({
        text: chalk.dim("Synthesizing test scenarios & auditing schemas..."),
        color: "cyan",
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
          "\n" +
            chalk.hex("#6366F1")(
              "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ProbeAI Assessment ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            )
        );
        const rendered = marked(finalResponse);
        console.log(rendered);
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
