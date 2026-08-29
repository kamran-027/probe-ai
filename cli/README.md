# 🔍 ProbeAI — Autonomous API Reliability & Postman Suite Generator

<div align="center">

**An autonomous developer CLI agent that inspects OpenAPI specs, synthesizes multi-scenario test suites, executes real-time HTTP calls, and auto-exports ready-to-import Postman collections.**

[![npm version](https://img.shields.io/npm/v/@kamrankhan027/probe-ai.svg?style=for-the-badge&color=CB3837&logo=npm)](https://www.npmjs.com/package/@kamrankhan027/probe-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![LangGraph](https://img.shields.io/badge/LangGraph.js-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)](https://langchain-ai.github.io/langgraphjs/)
[![Multi-Provider](https://img.shields.io/badge/AI_Engine-Universal-8E75B2?style=for-the-badge)](https://ai.google.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

---

## ⚡ Quickstart

### Option 1: Run Instantly via `npx` (Zero Installation Required)
```bash
npx @kamrankhan027/probe-ai@latest
```

---

### Option 2: Install Globally

**Using npm:**
```bash
npm install -g @kamrankhan027/probe-ai
```

**Using pnpm / yarn:**
```bash
pnpm add -g @kamrankhan027/probe-ai
# or
yarn global add @kamrankhan027/probe-ai
```

Then run ProbeAI from **any directory** on your machine:
```bash
probe-ai
```

---

## 🧠 Supported AI Models & Providers

ProbeAI is **universal and provider-agnostic**. On startup, select your preferred engine:

| Provider | Supported Models | Environment Variable |
|---|---|---|
| **🔷 Google Gemini** | `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-2.5-flash`, `gemini-2.5-pro` | `GEMINI_API_KEY` |
| **🟢 OpenAI** | `gpt-5.6` (Sol/Terra/Luna), `gpt-4o`, `gpt-4o-mini`, `o3-mini`, `gpt-oss` | `OPENAI_API_KEY` |
| **🟣 Anthropic Claude** | `claude-sonnet-5`, `claude-opus-5`, `claude-3-5-sonnet-latest`, `claude-3-5-haiku` | `ANTHROPIC_API_KEY` |
| **⚡ Groq (LPU Engine)** | `llama-3.3-70b-versatile`, `gpt-oss-120b`, `qwen-3.6` (Free & Ultra-Fast) | `GROQ_API_KEY` |
| **🌐 OpenRouter** | `deepseek/deepseek-r1:free`, `qwen/qwen-2.5-coder-32b-instruct:free`, `mistral-large-3` | `OPENROUTER_API_KEY` |
| **🦙 Ollama (Local)** | `qwen2.5-coder:7b`, `deepseek-r1`, `llama3.3`, `gemma-4` (100% Offline & Free) | *None needed!* |

> 💡 **Custom Model Overrides**: You can pass any custom model string directly via environment variables (e.g. `OPENAI_MODEL=gpt-5.6` or `ANTHROPIC_MODEL=claude-sonnet-5`) or during the interactive startup prompt.

---

## 🌟 Key Superpowers

* **🔍 Auto-Discovery via OpenAPI**: Probes any API base URL (e.g. `http://localhost:8000`) and parses `/openapi.json` to map all routes, parameters, and security schemas.
* **📦 1-Click Postman Collection Export**: Eliminates 30+ minutes of manual route recreation by generating ready-to-import **Postman Collection v2.1** files (`reports/probe_collection.json`).
* **🔐 Smart Auth Detective**: Supports direct token injection (`Bearer ...` or `X-API-Key`) **AND** autonomous login flows (executing `POST /auth/login`, extracting the JWT token, and binding it to subsequent requests).
* **⚡ Real-Time HTTP Latency Profiling**: Fires live requests, catches `422/404/401` edge cases, and logs latency in milliseconds.
* **📊 Standalone HTML & Terminal Reports**: Generates interactive single-page HTML audit dashboards with health scores and payload replays.

---

## 💡 Example Prompts to Try

```text
❯ inspect https://bookmark-agent-backend.onrender.com and export a Postman collection
```
*Auto-maps all endpoints and creates `reports/postman_collection.json`.*

```text
❯ test all endpoints on https://bookmark-agent-backend.onrender.com and save an HTML report
```
*Executes Happy Path, Query Filter, and Error test cases and saves `reports/audit_report.html`.*

```text
❯ set auth Bearer my_jwt_token_123 and test protected endpoints
```
*Injects your authorization header into session memory for all subsequent calls.*

---

## 🏗️ Repository Architecture

```text
probe-ai/
├── cli/                            # 🚀 Native TypeScript NPM Package (@kamrankhan027/probe-ai)
│   ├── src/
│   │   ├── index.ts                # Interactive CLI loop & Modern UI
│   │   ├── wizard.ts               # Multi-Provider Startup Wizard
│   │   ├── model-factory.ts        # Universal LangChain chat model factory
│   │   ├── agent.ts                # @langchain/langgraph ReAct workflow
│   │   └── tools/                  # OpenAPI, HTTP, Auth, Postman & Report tools
│   ├── dist/
│   │   └── index.js                # ⚡ Single zero-dependency bundled executable (tsup)
│   └── package.json
├── python/                         # Python implementation (LangGraph + Rich)
│   ├── agent.py
│   └── requirements.txt
└── reports/                        # Shared output directory
```

---

<div align="center">
Built by <b>Kamran Khan</b> as part of <b>Cadence Labs</b>.
</div>
