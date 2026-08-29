import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGroq } from "@langchain/groq";
import { ChatOllama } from "@langchain/ollama";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

export type ProviderType = "gemini" | "openai" | "anthropic" | "groq" | "openrouter" | "ollama";

export interface ProviderConfig {
  provider: ProviderType;
  apiKey?: string;
  modelName?: string;
  baseUrl?: string;
}

export function createChatModel(config: ProviderConfig): BaseChatModel {
  const { provider, apiKey = "", modelName, baseUrl } = config;

  switch (provider) {
    case "gemini":
      return new ChatGoogleGenerativeAI({
        model: modelName || process.env.GEMINI_MODEL || "gemini-2.5-flash",
        temperature: 0.2,
        apiKey,
        maxRetries: 3,
      });

    case "openai":
      return new ChatOpenAI({
        model: modelName || process.env.OPENAI_MODEL || "gpt-4o",
        temperature: 0.2,
        apiKey,
        maxRetries: 3,
      });

    case "anthropic":
      return new ChatAnthropic({
        model: modelName || process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
        temperature: 0.2,
        apiKey,
        maxRetries: 3,
      });

    case "groq":
      return new ChatGroq({
        model: modelName || process.env.GROQ_MODEL || "openai/gpt-oss-120b",
        temperature: 0.2,
        apiKey,
        maxRetries: 3,
      });

    case "openrouter":
      return new ChatOpenAI({
        model: modelName || process.env.OPENROUTER_MODEL || "qwen/qwen-2.5-coder-32b-instruct:free",
        temperature: 0.2,
        apiKey,
        configuration: {
          baseURL: "https://openrouter.ai/api/v1",
          defaultHeaders: {
            "HTTP-Referer": "https://github.com/kamran-027/probe-ai",
            "X-Title": "ProbeAI CLI",
          },
        },
        maxRetries: 3,
      });

    case "ollama":
      return new ChatOllama({
        model: modelName || process.env.OLLAMA_MODEL || "qwen2.5-coder:7b",
        temperature: 0.2,
        baseUrl: baseUrl || process.env.OLLAMA_HOST || "http://localhost:11434",
      });

    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}
