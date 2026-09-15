import chalk from "chalk";
import { select, password, input } from "@inquirer/prompts";
import { ProviderConfig, ProviderType } from "./model-factory.js";

export async function resolveProviderConfig(forcePrompt: boolean = false): Promise<ProviderConfig> {
  const detectedKeys: Record<ProviderType, string | undefined> = {
    gemini: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    groq: process.env.GROQ_API_KEY,
    ollama: undefined,
  };

  console.log(chalk.dim("Select your AI engine provider and model:\n"));

  const provider = (await select({
    message: chalk.white.bold("Select AI Engine Provider:"),
    choices: [
      {
        name: `${chalk.bold.hex("#818CF8")("OpenRouter")}     ${chalk.dim("·  GLM 5.3 / DeepSeek V4 / Llama 3.3")}${detectedKeys.openrouter ? chalk.hex("#10B981")("  [Key detected]") : ""}`,
        value: "openrouter",
      },
      {
        name: `${chalk.bold.hex("#38BDF8")("Google Gemini")}  ${chalk.dim("·  gemini-3.6-flash / gemini-3.5")}${detectedKeys.gemini ? chalk.hex("#10B981")("  [Key detected]") : ""}`,
        value: "gemini",
      },
      {
        name: `${chalk.bold.hex("#34D399")("OpenAI")}         ${chalk.dim("·  gpt-4o / gpt-4o-mini / o3-mini")}${detectedKeys.openai ? chalk.hex("#10B981")("  [Key detected]") : ""}`,
        value: "openai",
      },
      {
        name: `${chalk.bold.hex("#C084FC")("Anthropic")}      ${chalk.dim("·  claude-3-5-sonnet / haiku")}${detectedKeys.anthropic ? chalk.hex("#10B981")("  [Key detected]") : ""}`,
        value: "anthropic",
      },
      {
        name: `${chalk.bold.hex("#FBBF24")("Groq (LPU)")}     ${chalk.dim("·  openai/gpt-oss-120b / llama-3.3")}${detectedKeys.groq ? chalk.hex("#10B981")("  [Key detected]") : ""}`,
        value: "groq",
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
      default: process.env.OLLAMA_MODEL || "qwen2.5-coder:7b",
    });
    return { provider: "ollama", modelName: customModel };
  }

  const keyLabels: Record<string, string> = {
    openrouter: "OpenRouter API Key (https://openrouter.ai):",
    gemini: "Gemini API Key (https://aistudio.google.com):",
    openai: "OpenAI API Key (https://platform.openai.com):",
    anthropic: "Anthropic API Key (https://console.anthropic.com):",
    groq: "Groq API Key (https://console.groq.com):",
  };

  let key: string = "";
  const detected = detectedKeys[provider];

  if (detected) {
    const choice = await select({
      message: `API Key for ${provider.toUpperCase()}:`,
      choices: [
        {
          name: `Use detected key from environment (${detected.slice(0, 4)}••••${detected.slice(-4)})`,
          value: "detected",
        },
        {
          name: "Enter a different API key manually",
          value: "manual",
        },
      ],
    });

    if (choice === "detected") {
      key = detected;
    } else {
      key = await password({
        message: `Enter your ${keyLabels[provider]}`,
        mask: "•",
      });
    }
  } else {
    key = await password({
      message: `Enter your ${keyLabels[provider]}`,
      mask: "•",
    });
  }

  if (!key.trim()) {
    console.log(chalk.red("\nError: An API key is required to proceed. Exiting...\n"));
    process.exit(1);
  }

  // Model selection presets
  const modelPresets: Record<string, Array<{ name: string; value: string }>> = {
    openrouter: [
      { name: `z-ai/glm-5.3-flash ${chalk.dim("(Recommended · Ultra-fast, tool calling)")}`, value: "z-ai/glm-5.3-flash" },
      { name: `deepseek/deepseek-v4.1-flash ${chalk.dim("(DeepSeek V4.1 · Native tools)")}`, value: "deepseek/deepseek-v4.1-flash" },
      { name: `meta-llama/llama-3.3-70b-instruct ${chalk.dim("(Llama 3.3 70B · Tool support)")}`, value: "meta-llama/llama-3.3-70b-instruct" },
      { name: "Enter custom model ID...", value: "custom" },
    ],
    gemini: [
      { name: `gemini-3.6-flash ${chalk.dim("(Recommended · Latest Google model)")}`, value: "gemini-3.6-flash" },
      { name: `gemini-3.5-flash ${chalk.dim("(Stable)")}`, value: "gemini-3.5-flash" },
      { name: `gemini-2.5-pro ${chalk.dim("(Advanced reasoning)")}`, value: "gemini-2.5-pro" },
      { name: "Enter custom model ID...", value: "custom" },
    ],
    openai: [
      { name: `gpt-4o ${chalk.dim("(Recommended)")}`, value: "gpt-4o" },
      { name: `gpt-4o-mini ${chalk.dim("(Fast & lightweight)")}`, value: "gpt-4o-mini" },
      { name: `o3-mini ${chalk.dim("(Reasoning)")}`, value: "o3-mini" },
      { name: "Enter custom model ID...", value: "custom" },
    ],
    anthropic: [
      { name: `claude-3-5-sonnet-latest ${chalk.dim("(Recommended)")}`, value: "claude-3-5-sonnet-latest" },
      { name: `claude-3-5-haiku ${chalk.dim("(Fast & cost effective)")}`, value: "claude-3-5-haiku" },
      { name: "Enter custom model ID...", value: "custom" },
    ],
    groq: [
      { name: `openai/gpt-oss-120b ${chalk.dim("(Recommended · Fast LPU)")}`, value: "openai/gpt-oss-120b" },
      { name: `llama-3.3-70b-versatile ${chalk.dim("(Llama 3.3)")}`, value: "llama-3.3-70b-versatile" },
      { name: "Enter custom model ID...", value: "custom" },
    ],
  };

  let selectedModel: string = "";
  const presets = modelPresets[provider];

  if (presets) {
    const modelChoice = await select({
      message: `Choose ${provider.toUpperCase()} Model:`,
      choices: presets,
    });

    if (modelChoice === "custom") {
      selectedModel = await input({
        message: "Enter custom model ID:",
        default: "",
      });
    } else {
      selectedModel = modelChoice;
    }
  } else {
    selectedModel = await input({
      message: "Enter model ID:",
      default: "",
    });
  }

  return {
    provider,
    apiKey: key.trim(),
    modelName: selectedModel.trim() || undefined,
  };
}
