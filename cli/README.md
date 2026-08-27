# 🔍 ProbeAI — Autonomous API Reliability & Postman Suite Generator

<div align="center">

**An autonomous developer CLI agent that inspects OpenAPI specs, synthesizes multi-scenario test suites, executes real-time HTTP calls, and auto-exports ready-to-import Postman collections.**

[![npm version](https://img.shields.io/npm/v/@kamrankhan027/probe-ai.svg?style=for-the-badge&color=CB3837&logo=npm)](https://www.npmjs.com/package/@kamrankhan027/probe-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![LangGraph](https://img.shields.io/badge/LangGraph.js-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)](https://langchain-ai.github.io/langgraphjs/)
[![Gemini](https://img.shields.io/badge/Gemini_3.6_Flash-8E75B2?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

---

## ⚡ Quickstart

### Option 1: Run Instantly via `npx` (Zero Installation Required)
```bash
npx @kamrankhan027/probe-ai
```

---

### Option 2: Install Globally

**Using npm:**
```bash
npm install -g @kamrankhan027/probe-ai
```

**Using pnpm:**
```bash
pnpm add -g @kamrankhan027/probe-ai
```

**Using yarn:**
```bash
yarn global add @kamrankhan027/probe-ai
```

Then run ProbeAI from **any directory** on your machine:
```bash
probe-ai
```

---

## 🔑 API Key Setup

ProbeAI uses Google Gemini for fast, structured reasoning. 
* **If you have a `.env` file**: Add `GEMINI_API_KEY=your_key_here`
* **If running via `npx` without a `.env`**: ProbeAI will interactively prompt you to paste your free Gemini API key on startup.

*(Get a free key in 10 seconds at [aistudio.google.com](https://aistudio.google.com/)).*

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
You: Inspect https://bookmark-agent-backend.onrender.com and export a Postman collection
```
*Auto-maps all endpoints and creates `reports/postman_collection.json`.*

```text
You: Test all endpoints on https://bookmark-agent-backend.onrender.com and save an HTML report
```
*Executes Happy Path, Query Filter, and Error test cases and saves `reports/audit_report.html`.*

```text
You: Set auth Bearer my_jwt_token_123 and test protected endpoints
```
*Injects your authorization header into session memory for all subsequent calls.*

```text
You: Authenticate via POST https://api.example.com/login with {"email":"dev@example.com","password":"secret"}, then test /api/dashboard
```
*Extracts the JWT from the login response and tests the protected dashboard route automatically.*

---

## 🏗️ Repository Architecture

```text
probe-ai/
├── cli/                            # 🚀 Native TypeScript NPM Package (@kamrankhan027/probe-ai)
│   ├── src/
│   │   ├── index.ts                # Interactive CLI loop & Marked terminal styling
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

## 🛠️ Local Development

```bash
git clone https://github.com/kamran-027/probe-ai.git
cd probe-ai/cli
npm install
npm run build
npm start
```

---

<div align="center">
Built by <b>Kamran Khan</b> as part of <b>Cadence Labs</b>.
</div>
