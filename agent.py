import os
import time
import json
from datetime import datetime
from typing import Annotated, Literal, Sequence, Optional, Dict, Any, List
from urllib.parse import urljoin, urlparse

from dotenv import load_dotenv
load_dotenv()

# Check for Gemini API Key
api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
if not api_key:
    print("[WARNING] No GEMINI_API_KEY found. Create a .env file with GEMINI_API_KEY=your_key")

# =====================================================================
# LIBRARIES & TOOLS
# =====================================================================
import httpx
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.markdown import Markdown

# Initialize Rich Console
console = Console()

# LangChain & LangGraph imports
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, ToolMessage, SystemMessage
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
import langchain_google_genai.chat_models as chat_models
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from typing_extensions import TypedDict

# =====================================================================
# MONKEYPATCH: thought_signature for Gemini 3+ models
# =====================================================================
orig_parse_chat_history = chat_models._parse_chat_history

def patched_parse_chat_history(*args, **kwargs):
    system_instruction, history = orig_parse_chat_history(*args, **kwargs)
    for content in history:
        for part in content.parts:
            if part.function_call:
                part.thought_signature = b"skip_thought_signature_validator"
    return system_instruction, history

chat_models._parse_chat_history = patched_parse_chat_history

# Global Session Headers (remembers auth tokens across turns)
SESSION_HEADERS: Dict[str, str] = {
    "User-Agent": "ProbeAI-Tester/2.0"
}

# In-memory execution history for report generation
TEST_EXECUTION_LOGS: List[Dict[str, Any]] = []

# =====================================================================
# 1. CORE PROBEAI TOOLS
# =====================================================================

@tool
def fetch_openapi_spec(base_url: str) -> str:
    """
    Fetch and parse the OpenAPI/Swagger specification JSON from a given base URL
    (e.g., http://localhost:8000 or http://localhost:8000/openapi.json).
    Returns a summary of all available routes, methods, parameters, and security schemes.
    """
    console.print(f"\n[bold cyan]🔍 [Tool: fetch_openapi_spec][/bold cyan] Probing: {base_url}")
    
    target_url = base_url.rstrip("/")
    if not target_url.endswith("openapi.json"):
        target_url = f"{target_url}/openapi.json"
        
    try:
        response = httpx.get(target_url, timeout=10.0, follow_redirects=True)
        response.raise_for_status()
        spec = response.json()
        
        info = spec.get("info", {})
        paths = spec.get("paths", {})
        components = spec.get("components", {})
        security_schemes = components.get("securitySchemes", {})
        
        endpoints_summary = []
        for path, methods in paths.items():
            for method, details in methods.items():
                endpoints_summary.append({
                    "method": method.upper(),
                    "path": path,
                    "summary": details.get("summary", details.get("description", "No description")),
                    "parameters": details.get("parameters", []),
                    "requestBody": bool(details.get("requestBody")),
                    "security": details.get("security", spec.get("security", []))
                })
                
        return json.dumps({
            "title": info.get("title", "API Spec"),
            "version": info.get("version", "1.0"),
            "security_schemes": security_schemes,
            "endpoint_count": len(endpoints_summary),
            "endpoints": endpoints_summary[:15]
        }, indent=2)

    except Exception as e:
        return f"Could not fetch OpenAPI spec from {target_url}: {str(e)}"


@tool
def authenticate_via_login(login_url: str, method: str = "POST", payload_json: str = "{}", token_field: str = "access_token") -> str:
    """
    Execute a login or token-generation endpoint (e.g. POST /auth/login with credentials),
    automatically extract the bearer token from the response JSON, and store it into the session.
    Subsequent test requests will automatically include this token in the Authorization header.
    """
    console.print(f"\n[bold green]🔐 [Tool: authenticate_via_login][/bold green] Authenticating at: {login_url}")
    
    try:
        payload = json.loads(payload_json) if payload_json.strip() else {}
    except json.JSONDecodeError:
        return "Error: payload_json must be valid JSON."

    try:
        with httpx.Client(timeout=10.0, follow_redirects=True) as client:
            res = client.request(method=method.upper(), url=login_url, json=payload)
            res.raise_for_status()
            data = res.json()

        # Extract token by field name (or common fallback keys)
        token = None
        if isinstance(data, dict):
            token = data.get(token_field) or data.get("token") or data.get("access_token") or data.get("jwt") or data.get("key")
            
        if not token:
            return f"Login succeeded (HTTP {res.status_code}), but could not find token field '{token_field}' in response: {json.dumps(data)}"

        SESSION_HEADERS["Authorization"] = f"Bearer {token}"
        console.print(f"  └─ [bold green]Success![/bold green] Extracted token and bound 'Authorization: Bearer ...' to session.")
        return f"Authentication successful. Bearer token extracted from '{token_field}' and saved to session headers."

    except Exception as e:
        return f"Login request failed: {str(e)}"


@tool
def set_auth_header(header_name: str, token_value: str) -> str:
    """
    Directly set an authentication header into the active session (e.g. header_name='Authorization', token_value='Bearer eyJ...').
    All subsequent execute_http_request calls will automatically use this header.
    """
    clean_val = token_value.strip()
    if header_name.lower() == "authorization" and not clean_val.lower().startswith("bearer ") and not clean_val.lower().startswith("basic "):
        clean_val = f"Bearer {clean_val}"
        
    SESSION_HEADERS[header_name] = clean_val
    console.print(f"\n[bold green]🔑 [Tool: set_auth_header][/bold green] Set '{header_name}' header in session.")
    return f"Successfully set '{header_name}' header in session."


@tool
def execute_http_request(
    method: str,
    url: str,
    headers_json: str = "{}",
    params_json: str = "{}",
    body_json: str = "{}"
) -> str:
    """
    Execute a real HTTP request (GET, POST, PUT, DELETE, PATCH) to test an API endpoint.
    Automatically merges session auth headers. Measures latency in milliseconds and records results.
    """
    method = method.strip().upper()
    console.print(f"\n[bold yellow]⚡ [Tool: execute_http_request][/bold yellow] {method} {url}")
    
    # Merge session headers with custom headers
    merged_headers = dict(SESSION_HEADERS)
    try:
        if headers_json and headers_json.strip() != "{}":
            custom_headers = json.loads(headers_json)
            merged_headers.update(custom_headers)
        params = json.loads(params_json) if params_json and params_json.strip() != "{}" else {}
        json_body = json.loads(body_json) if body_json and body_json.strip() != "{}" else None
    except json.JSONDecodeError as err:
        return f"Error: Invalid JSON parameter passed to tool: {str(err)}"

    start_time = time.time()
    try:
        with httpx.Client(timeout=15.0, follow_redirects=True) as client:
            response = client.request(
                method=method,
                url=url,
                headers=merged_headers,
                params=params,
                json=json_body
            )
        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        
        try:
            body_preview = response.json()
        except Exception:
            body_preview = response.text[:500]

        status_color = "green" if 200 <= response.status_code < 300 else "red"
        console.print(f"  └─ Status: [{status_color}]{response.status_code}[/{status_color}] | Latency: [cyan]{elapsed_ms}ms[/cyan]")

        record = {
            "method": method,
            "url": url,
            "status_code": response.status_code,
            "elapsed_ms": elapsed_ms,
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "params": params,
            "body": json_body,
            "response": body_preview,
            "passed": 200 <= response.status_code < 400 or response.status_code in [401, 404]
        }
        TEST_EXECUTION_LOGS.append(record)

        return json.dumps({
            "status_code": response.status_code,
            "status_text": response.reason_phrase if hasattr(response, "reason_phrase") else "",
            "elapsed_ms": elapsed_ms,
            "headers": dict(response.headers),
            "response_body": body_preview
        }, indent=2)

    except httpx.TimeoutException:
        return json.dumps({"error": "Request timed out after 15 seconds", "status_code": 504})
    except Exception as e:
        return json.dumps({"error": f"Request failed: {str(e)}", "status_code": 0})


@tool
def export_postman_collection(base_url: str, output_filename: str = "probe_collection.json") -> str:
    """
    Generate a ready-to-import Postman Collection v2.1.0 JSON file directly from the base URL's OpenAPI spec.
    Eliminates manual Postman recreation by generating routes, methods, and mock schemas automatically.
    """
    console.print(f"\n[bold magenta]📦 [Tool: export_postman_collection][/bold magenta] Exporting Postman collection...")
    
    target_url = base_url.rstrip("/")
    if not target_url.endswith("openapi.json"):
        target_url = f"{target_url}/openapi.json"
        
    try:
        res = httpx.get(target_url, timeout=10.0, follow_redirects=True)
        res.raise_for_status()
        spec = res.json()
    except Exception as e:
        return f"Failed to fetch OpenAPI spec from {target_url}: {str(e)}"

    collection_name = spec.get("info", {}).get("title", "Exported API Collection")
    postman_items = []
    
    parsed_base = urlparse(base_url)
    host_parts = parsed_base.netloc.split(":")
    base_host = [host_parts[0]]
    base_port = host_parts[1] if len(host_parts) > 1 else ("443" if parsed_base.scheme == "https" else "80")
    
    for path, methods in spec.get("paths", {}).items():
        for method, details in methods.items():
            path_segments = [seg for seg in path.strip("/").split("/") if seg]
            
            postman_item = {
                "name": details.get("summary") or f"{method.upper()} {path}",
                "request": {
                    "method": method.upper(),
                    "header": [
                        {"key": "Content-Type", "value": "application/json", "type": "text"}
                    ],
                    "url": {
                        "raw": f"{base_url.rstrip('/')}{path}",
                        "protocol": parsed_base.scheme or "http",
                        "host": base_host,
                        "port": base_port,
                        "path": path_segments
                    },
                    "description": details.get("description", "")
                }
            }
            postman_items.append(postman_item)

    postman_collection = {
        "info": {
            "name": f"{collection_name} (ProbeAI Export)",
            "_postman_id": f"probeai-{int(time.time())}",
            "description": "Auto-generated Postman Collection by ProbeAI",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "item": postman_items
    }

    os.makedirs("reports", exist_ok=True)
    out_path = os.path.join("reports", os.path.basename(output_filename))
    with open(out_path, "w") as f:
        json.dump(postman_collection, f, indent=2)

    console.print(f"  └─ [bold green]Saved Postman Collection to: {out_path}[/bold green]")
    return f"Postman collection with {len(postman_items)} endpoints successfully generated at '{out_path}'. You can import this directly into Postman/Bruno/Insomnia!"


@tool
def save_html_audit_report(filename: str = "audit_report.html", report_title: str = "ProbeAI API Audit Report") -> str:
    """
    Generate an executive, standalone single-page HTML audit report with health score cards,
    status code distributions, latency metrics, and expandable request/response inspection accordions.
    """
    os.makedirs("reports", exist_ok=True)
    out_path = os.path.join("reports", os.path.basename(filename))
    if not out_path.endswith(".html"):
        out_path += ".html"

    total = len(TEST_EXECUTION_LOGS)
    if total == 0:
        return "No test logs recorded in this session yet. Run tests first before exporting report."

    passed = sum(1 for log in TEST_EXECUTION_LOGS if 200 <= log["status_code"] < 400)
    failed = total - passed
    avg_latency = round(sum(log["elapsed_ms"] for log in TEST_EXECUTION_LOGS) / total, 1)
    health_score = int((passed / total) * 100)

    rows_html = ""
    for idx, log in enumerate(TEST_EXECUTION_LOGS, 1):
        status_badge = (
            f'<span class="badge badge-success">{log["status_code"]} OK</span>'
            if 200 <= log["status_code"] < 300
            else f'<span class="badge badge-error">{log["status_code"]}</span>'
        )
        response_json = json.dumps(log["response"], indent=2) if isinstance(log["response"], (dict, list)) else str(log["response"])
        
        rows_html += f"""
        <div class="test-card">
          <div class="test-header">
            <div class="test-meta">
              <span class="method-tag method-{log['method'].lower()}">{log['method']}</span>
              <span class="test-url">{log['url']}</span>
            </div>
            <div class="test-stats">
              <span class="latency-tag">{log['elapsed_ms']} ms</span>
              {status_badge}
            </div>
          </div>
          <details class="test-details">
            <summary>View Request / Response Payload</summary>
            <div class="payload-box">
              <strong>Response Body:</strong>
              <pre><code>{response_json}</code></pre>
            </div>
          </details>
        </div>
        """

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{report_title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {{ --bg: #f8fafc; --card-bg: #ffffff; --text: #0f172a; --border: #e2e8f0; --accent: #4f46e5; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); padding: 40px 20px; max-width: 900px; margin: 0 auto; }}
    .header {{ text-align: center; margin-bottom: 30px; }}
    .header h1 {{ font-size: 24px; font-weight: 800; margin-bottom: 4px; }}
    .header p {{ color: #64748b; font-size: 13px; }}
    .stats-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 30px; }}
    .stat-card {{ background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; padding: 20px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.03); }}
    .stat-val {{ font-size: 28px; font-weight: 800; color: var(--accent); }}
    .stat-label {{ font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-top: 4px; }}
    .test-card {{ background: var(--card-bg); border: 1px solid var(--border); border-radius: 14px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }}
    .test-header {{ display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }}
    .test-meta {{ display: flex; align-items: center; gap: 8px; font-family: monospace; font-size: 13px; }}
    .method-tag {{ font-weight: 700; padding: 2px 8px; border-radius: 6px; font-size: 11px; }}
    .method-get {{ background: #eff6ff; color: #2563eb; }}
    .method-post {{ background: #f0fdf4; color: #16a34a; }}
    .method-delete {{ background: #fef2f2; color: #dc2626; }}
    .badge {{ padding: 3px 8px; border-radius: 99px; font-size: 11px; font-weight: 700; font-family: monospace; }}
    .badge-success {{ background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }}
    .badge-error {{ background: #fef2f2; color: #e11d48; border: 1px solid #fecdd3; }}
    .latency-tag {{ font-size: 11px; color: #64748b; font-family: monospace; margin-right: 6px; }}
    .test-details {{ margin-top: 12px; font-size: 12px; }}
    .test-details summary {{ cursor: pointer; color: var(--accent); font-weight: 500; outline: none; }}
    .payload-box {{ background: #f1f5f9; padding: 12px; border-radius: 8px; margin-top: 8px; overflow-x: auto; }}
    pre {{ margin: 0; font-size: 11px; }}
  </style>
</head>
<body>
  <div class="header">
    <h1>🔍 ProbeAI Reliability Audit</h1>
    <p>Generated on {datetime.now().strftime("%Y-%m-%d %H:%M:%S")} • Autonomous Test Suite</p>
  </div>
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-val">{health_score}%</div><div class="stat-label">Health Score</div></div>
    <div class="stat-card"><div class="stat-val">{passed}/{total}</div><div class="stat-label">Tests Passed</div></div>
    <div class="stat-card"><div class="stat-val">{avg_latency}ms</div><div class="stat-label">Avg Latency</div></div>
  </div>
  <h3>Executed Test Cases</h3>
  {rows_html}
</body>
</html>
"""
    with open(out_path, "w") as f:
        f.write(html_content)

    console.print(f"\n[bold green]📊 [Tool: save_html_audit_report][/bold green] Interactive HTML Report saved to: {out_path}")
    return f"HTML audit report successfully generated at '{out_path}'. Open it in your browser to view the interactive dashboard!"


# Combine all tools
tools = [
    fetch_openapi_spec,
    authenticate_via_login,
    set_auth_header,
    execute_http_request,
    export_postman_collection,
    save_html_audit_report
]
tool_node = ToolNode(tools)

# =====================================================================
# 2. AGENT STATE
# =====================================================================
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]

# =====================================================================
# 3. LLM & GRAPH DEFINITION (Gemini 3.6 Flash)
# =====================================================================
model = ChatGoogleGenerativeAI(
    model="gemini-3.6-flash",
    temperature=0.2,
    google_api_key=api_key,
).bind_tools(tools)

def call_model(state: AgentState):
    console.print("[dim]ProbeAI thinking...[/dim]")
    response = model.invoke(state["messages"])
    return {"messages": [response]}

def should_continue(state: AgentState) -> Literal["tools", "__end__"]:
    last = state["messages"][-1]
    if last.tool_calls:
        return "tools"
    return "__end__"

# Compile LangGraph Workflow
workflow = StateGraph(AgentState)
workflow.add_node("agent", call_model)
workflow.add_node("tools", tool_node)
workflow.add_edge(START, "agent")
workflow.add_conditional_edges("agent", should_continue)
workflow.add_edge("tools", "agent")
app = workflow.compile()

# =====================================================================
# 4. INTERACTIVE CLI LOOP
# =====================================================================
def main():
    console.print(Panel.fit(
        "[bold cyan]🔍 ProbeAI — Autonomous API Reliability & Postman Suite Generator[/bold cyan]\n"
        "[dim]Powered by Gemini 3.6 Flash • Dynamic Auth • Postman Exporter • HTML Reports[/dim]\n\n"
        "[yellow]Try prompts like:[/yellow]\n"
        " • 'Inspect https://bookmark-agent-backend.onrender.com and export a Postman collection'\n"
        " • 'Test all endpoints on https://bookmark-agent-backend.onrender.com and save an HTML report'\n"
        " • 'Set auth Bearer my_secret_jwt_token and test protected routes'\n"
        " • Type [bold red]'exit'[/bold red] to quit",
        border_style="cyan"
    ))

    SYSTEM_MESSAGE = SystemMessage(content=(
        "You are ProbeAI, an expert Senior API Reliability and QA Test Engineer agent.\n"
        "When the user interacts with you:\n"
        "1. For API Inspection & Testing:\n"
        "   - Call fetch_openapi_spec to discover endpoints & security schemes.\n"
        "   - If authentication is required or requested, use authenticate_via_login or set_auth_header.\n"
        "   - Formulate 3-4 distinct test cases (Happy Path, Query Filters, Error cases).\n"
        "   - STRICT BUDGET RULE: Execute at most 4 to 5 execute_http_request calls in total.\n"
        "2. If requested to export Postman collections, call export_postman_collection.\n"
        "3. If requested to generate reports (or after running a comprehensive test suite), call save_html_audit_report.\n"
        "4. Always finish with a clear markdown summary table and reliability grade."
    ))

    state = {"messages": [SYSTEM_MESSAGE]}

    while True:
        try:
            user_input = console.input("\n[bold green]You:[/bold green] ").strip()
            if not user_input:
                continue
            if user_input.lower() in ["exit", "quit"]:
                console.print("[bold cyan]Goodbye! 👋[/bold cyan]")
                break

            state["messages"].append(HumanMessage(content=user_input))

            final_state = state
            for event in app.stream(state, stream_mode="values"):
                if event and "messages" in event:
                    last_msg = event["messages"][-1]
                    if isinstance(last_msg, AIMessage) and not last_msg.tool_calls:
                        console.print("\n[bold purple]ProbeAI Assessment:[/bold purple]")
                        console.print(Markdown(last_msg.content))
                    final_state = event

            state["messages"] = list(final_state["messages"])

        except KeyboardInterrupt:
            console.print("\n[bold cyan]Goodbye! 👋[/bold cyan]")
            break
        except Exception as e:
            console.print(f"\n[bold red]An error occurred:[/bold red] {e}")

if __name__ == "__main__":
    main()
