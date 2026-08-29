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
    message: "Choose AI Engine Provider:",
    choices: [
      {
        name: `${chalk.bold.cyan("🔷 Google Gemini")} ${chalk.dim("(Gemini 3.6 / 3.5 / 2.5 Flash - Free & Fast)")}`,
        value: "gemini",
      },
      {
        name: `${chalk.bold.green("🟢 OpenAI")} ${chalk.dim("(GPT-5.6 Sol/Terra, GPT-4o, o3-mini, GPT-OSS)")}`,
        value: "openai",
      },
      {
        name: `${chalk.bold.hex("#A855F7")("🟣 Anthropic Claude")} ${chalk.dim("(Sonnet 5, Opus 5, Claude 3.5 Sonnet)")}`,
        value: "anthropic",
      },
      {
        name: `${chalk.bold.yellow("⚡ Groq")} ${chalk.dim("(OpenAI GPT-OSS 120B / 20B, Qwen 3.6 - Free & Fast)")}`,
        value: "groq",
      },
      {
        name: `${chalk.bold.hex("#3B82F6")("🌐 OpenRouter")} ${chalk.dim("(DeepSeek V4/R1, Qwen 3.5/2.5 Coder, Mistral)")}`,
        value: "openrouter",
      },
      {
        name: `${chalk.bold.white("🦙 Ollama")} ${chalk.dim("(Local / Offline: DeepSeek-R1, Qwen Coder, Gemma 4)")}`,
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
    openrouter: "qwen/qwen-2.5-coder-32b-instruct:free (or deepseek/deepseek-r1:free)",
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
