import chalk from "chalk";
import { select, password, input } from "@inquirer/prompts";
import { ProviderConfig, ProviderType } from "./model-factory.js";

export async function resolveProviderConfig(): Promise<ProviderConfig> {
  // Auto-detect if environment variable already exists
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    return {
      provider: "gemini",
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
      modelName: process.env.GEMINI_MODEL,
    };
  }

  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      modelName: process.env.OPENAI_MODEL,
    };
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY,
      modelName: process.env.ANTHROPIC_MODEL,
    };
  }

  if (process.env.GROQ_API_KEY) {
    return {
      provider: "groq",
      apiKey: process.env.GROQ_API_KEY,
      modelName: process.env.GROQ_MODEL,
    };
  }

  if (process.env.OPENROUTER_API_KEY) {
    return {
      provider: "openrouter",
      apiKey: process.env.OPENROUTER_API_KEY,
      modelName: process.env.OPENROUTER_MODEL,
    };
  }

  console.log(chalk.dim("Select your AI model provider to get started:\n"));

  const provider = (await select({
    message: chalk.white.bold("Select AI Engine Provider:"),
    choices: [
      {
        name: `${chalk.bold.hex("#38BDF8")("Google Gemini")}  ${chalk.dim("·  gemini-2.5-flash / gemini-3.5 (Free & Fast)")}`,
        value: "gemini",
      },
      {
        name: `${chalk.bold.hex("#34D399")("OpenAI")}         ${chalk.dim("·  gpt-4o / gpt-4o-mini / o3-mini")}`,
        value: "openai",
      },
      {
        name: `${chalk.bold.hex("#C084FC")("Anthropic")}      ${chalk.dim("·  claude-3-5-sonnet / claude-3-5-haiku")}`,
        value: "anthropic",
      },
      {
        name: `${chalk.bold.hex("#FBBF24")("Groq (LPU)")}     ${chalk.dim("·  openai/gpt-oss-120b / llama-3.3-70b")}`,
        value: "groq",
      },
      {
        name: `${chalk.bold.hex("#818CF8")("OpenRouter")}     ${chalk.dim("·  z-ai/glm-5.3-flash / deepseek-v4.1")}`,
        value: "openrouter",
      },
      {
        name: `${chalk.bold.white("Ollama (Local)")}  ${chalk.dim("·  qwen2.5-coder / deepseek-r1 (Offline)")}`,
        value: "ollama",
      },
    ],
  })) as ProviderType;

  if (provider === "ollama") {
    const customModel = await input({
      message: "Enter Ollama model (e.g. qwen2.5-coder:7b, deepseek-r1, llama3.3):",
      default: "qwen2.5-coder:7b",
    });
    return { provider: "ollama", modelName: customModel };
  }

  const keyLabels: Record<string, string> = {
    gemini: "Gemini API Key (https://aistudio.google.com):",
    openai: "OpenAI API Key (https://platform.openai.com):",
    anthropic: "Anthropic API Key (https://console.anthropic.com):",
    groq: "Groq API Key (https://console.groq.com):",
    openrouter: "OpenRouter API Key (https://openrouter.ai):",
  };

  const key = await password({
    message: `Enter your ${keyLabels[provider]}`,
    mask: "•",
  });

  if (!key.trim()) {
    console.log(chalk.red("\nError: An API key is required to proceed. Exiting...\n"));
    process.exit(1);
  }

  const modelHints: Record<string, string> = {
    gemini: "gemini-2.5-flash (or gemini-3.6-flash, gemini-2.5-pro)",
    openai: "gpt-4o (or gpt-5.6, gpt-4o-mini, o3-mini)",
    anthropic: "claude-3-5-sonnet-latest (or claude-sonnet-5, claude-opus-5)",
    groq: "openai/gpt-oss-120b (or openai/gpt-oss-20b, qwen/qwen3.6-27b)",
    openrouter: "z-ai/glm-5.3-flash (or deepseek/deepseek-v4.1-flash, meta-llama/llama-3.3-70b-instruct)",
  };

  const customModel = await input({
    message: `Model ID [default: ${modelHints[provider]}]:`,
    default: "",
  });

  return {
    provider,
    apiKey: key.trim(),
    modelName: customModel.trim() || undefined,
  };
}
