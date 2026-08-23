# 🔍 ProbeAI — Autonomous API Schema & Reliability Inspector

<div align="center">

**An autonomous developer CLI agent that inspects OpenAPI specs, synthesizes multi-scenario test suites, executes real-time HTTP calls, and profiles endpoint reliability.**

Built with **LangGraph**, **Gemini 3.5 Flash**, **httpx**, and **Rich**.

[![Python](https://img.shields.io/badge/Python_3.9+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org/)
[![LangGraph](https://img.shields.io/badge/LangGraph-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)](https://langchain.com/)
[![Gemini](https://img.shields.io/badge/Gemini_3.5_Flash-8E75B2?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![httpx](https://img.shields.io/badge/HTTPX_Client-026E81?style=for-the-badge)](https://www.python-httpx.org/)

</div>

---

## 🌟 Key Features

* **🔍 Auto-Discovery via OpenAPI**: Probes any base URL (e.g. `http://localhost:8000`) and parses `/openapi.json` to auto-discover all routes, request bodies, and query schemas.
* **🧪 Autonomous Test Synthesis**: Dynamically generates **Happy Path**, **Query Filters**, and **Edge-Case / Malformed** payloads to stress-test error handling.
* **⚡ Live Latency Profiling**: Executes real HTTP requests via `httpx`, profiling roundtrip latency in milliseconds.
* **📊 Rich Terminal UI & Reports**: Powered by Python's `rich` library to render clean tables, pass/fail status pills, and saved Markdown audit reports in `reports/`.

---

## 🚀 Quick Start

### 1. Setup Virtual Environment
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Add API Key
Create `.env` and add your Gemini API key:
```env
GEMINI_API_KEY=your_key_here
```

### 3. Launch ProbeAI
```bash
python agent.py
```

---

## 💡 Example Prompts

* `"Inspect and test all endpoints on http://localhost:8000"`
* `"Test the bookmarks endpoint at https://recall.kamrankhan.xyz with happy and boundary cases"`
* `"Test GET http://localhost:8000/api/bookmarks/search with empty and valid queries and save a report"`
* `"Test DELETE http://localhost:8000/api/bookmarks/99999 and evaluate error handling"`

---

<div align="center">
Built as part of the <b>Cadence Labs</b> AI Agent Mastery Series.
</div>
