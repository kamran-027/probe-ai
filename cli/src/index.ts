import dotenv from "dotenv";
dotenv.config();

import chalk from "chalk";
import boxen from "boxen";
import ora from "ora";
import readline from "readline";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { createProbeAgent, PROBE_SYSTEM_MESSAGE } from "./agent.js";

// Configure marked to render styled terminal output
marked.use(
  markedTerminal({
    width: 90,
    reflowText: true,
    tab: 2,
    heading: chalk.bold.cyan,
    firstHeading: chalk.bold.magenta,
    strong: chalk.bold.white,
    tableOptions: {
      style: {
        head: ["cyan", "bold"],
        border: ["gray"],
      },
    },
  }) as any
);

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

function printBanner() {
  console.log(
    boxen(
      `${chalk.bold.cyan("🔍 ProbeAI — Autonomous API Reliability & Postman Suite Generator")}\n` +
        `${chalk.dim("TypeScript CLI Edition • Dynamic Auth • Postman v2.1 Exporter • HTML Reports")}\n\n` +
        `${chalk.yellow("Try prompts like:")}\n` +
        ` • 'Inspect https://bookmark-agent-backend.onrender.com and export a Postman collection'\n` +
        ` • 'Test all endpoints on https://bookmark-agent-backend.onrender.com and save an HTML report'\n` +
        ` • 'Set auth Bearer my_secret_token and test protected routes'\n` +
        ` • Type ${chalk.bold.red("'exit'")} to quit`,
      {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: "cyan",
      }
    )
  );
}

async function main() {
  printBanner();

  if (!apiKey) {
    console.log(
      chalk.yellow(
        "\n[WARNING] GEMINI_API_KEY not found. Please set GEMINI_API_KEY in your environment or .env file.\n"
      )
    );
  }

  const app = createProbeAgent(apiKey || "");
  const messages: BaseMessage[] = [PROBE_SYSTEM_MESSAGE];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const promptUser = (): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(chalk.bold.green("\nYou: "), (answer) => {
        resolve(answer.trim());
      });
    });
  };

  while (true) {
    try {
      const input = await promptUser();
      if (!input) continue;

      if (input.toLowerCase() === "exit" || input.toLowerCase() === "quit") {
        console.log(chalk.cyan("\nGoodbye! 👋\n"));
        rl.close();
        process.exit(0);
      }

      messages.push(new HumanMessage(input));

      const spinner = ora({
        text: chalk.dim("ProbeAI thinking..."),
        color: "cyan",
      }).start();

      let finalResponse = "";

      const stream = await app.stream({ messages }, { streamMode: "values" });
      for await (const event of stream) {
        if (event && event.messages) {
          const lastMsg = event.messages[event.messages.length - 1];
          if (
            lastMsg instanceof AIMessage &&
            (!lastMsg.tool_calls || lastMsg.tool_calls.length === 0)
          ) {
            finalResponse = lastMsg.content as string;
          }
        }
      }

      spinner.stop();

      if (finalResponse) {
        console.log("\n" + chalk.bold.cyan("━━━━━━━━━━━━━━━━━━━━━━━━ ProbeAI Assessment ━━━━━━━━━━━━━━━━━━━━━━━━\n"));
        const rendered = marked(finalResponse);
        console.log(rendered);
      }
    } catch (err: any) {
      console.log(chalk.red(`\nAn error occurred: ${err.message}`));
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
