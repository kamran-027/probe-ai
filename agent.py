import os
import time
import json
from typing import Annotated, Literal, Sequence, Optional, Dict, Any
from urllib.parse import urljoin

from dotenv import load_dotenv
load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
if not api_key:
    print("[WARNING] No API key found. Create a .env file with GEMINI_API_KEY=your_key")

# =====================================================================
# LIBRARIES & TOOLS
# =====================================================================
import httpx
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.markdown import Markdown

# Initialize Rich Console for beautiful terminal formatting
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

# =====================================================================
# 1. DEFINE AGENT TOOLS
# =====================================================================

@tool
def fetch_openapi_spec(base_url: str) -> str:
    """
    Fetch and parse the OpenAPI/Swagger specification JSON from a given base URL
    (e.g., http://localhost:8000 or http://localhost:8000/openapi.json).
    Returns a summary of all available routes, methods, and parameters.
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
        
        endpoints_summary = []
        for path, methods in paths.items():
            for method, details in methods.items():
                endpoints_summary.append({
                    "method": method.upper(),
                    "path": path,
                    "summary": details.get("summary", details.get("description", "No description")),
                    "parameters": details.get("parameters", []),
                    "requestBody": bool(details.get("requestBody"))
                })
                
        return json.dumps({
            "title": info.get("title", "API Spec"),
            "version": info.get("version", "1.0"),
            "endpoint_count": len(endpoints_summary),
            "endpoints": endpoints_summary[:15]  # Limit to 15 to preserve context
        }, indent=2)

    except Exception as e:
        return f"Could not fetch OpenAPI spec from {target_url}: {str(e)}"


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
    headers_json, params_json, and body_json must be valid JSON strings (or empty '{}').
    Measures latency in milliseconds and records the response status and body.
    """
    method = method.strip().upper()
    console.print(f"\n[bold yellow]⚡ [Tool: execute_http_request][/bold yellow] {method} {url}")
    
    headers = {}
    params = {}
    json_body = None
    
    try:
        if headers_json and headers_json.strip() != "{}":
            headers = json.loads(headers_json)
        if params_json and params_json.strip() != "{}":
            params = json.loads(params_json)
        if body_json and body_json.strip() != "{}":
            json_body = json.loads(body_json)
    except json.JSONDecodeError as err:
        return f"Error: Invalid JSON parameter passed to tool: {str(err)}"

    start_time = time.time()
    try:
        with httpx.Client(timeout=15.0, follow_redirects=True) as client:
            response = client.request(
                method=method,
                url=url,
                headers=headers,
                params=params,
                json=json_body
            )
        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        
        # Format preview response
        try:
            body_preview = response.json()
        except Exception:
            body_preview = response.text[:500]

        status_color = "green" if 200 <= response.status_code < 300 else "red"
        console.print(f"  └─ Status: [{status_color}]{response.status_code}[/{status_color}] | Latency: [cyan]{elapsed_ms}ms[/cyan]")

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
def save_test_report(filename: str, report_markdown: str) -> str:
    """
    Save a comprehensive API Test Audit report in markdown format into the local 'reports/' folder.
    """
    os.makedirs("reports", exist_ok=True)
    safe_name = os.path.basename(filename)
    if not safe_name.endswith(".md"):
        safe_name += ".md"
        
    path = os.path.join("reports", safe_name)
    with open(path, "w") as f:
        f.write(report_markdown)
        
    console.print(f"\n[bold green]📁 [Tool: save_test_report][/bold green] Report saved to: {path}")
    return f"Test report successfully saved to '{path}'."


# Combine all tools
tools = [fetch_openapi_spec, execute_http_request, save_test_report]
tool_node = ToolNode(tools)

# =====================================================================
# 2. AGENT STATE
# =====================================================================
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]

# =====================================================================
# 3. LLM & GRAPH DEFINITION
# =====================================================================
model = ChatGoogleGenerativeAI(
    model="gemini-3.5-flash",
    temperature=0.4,
    google_api_key=api_key,
).bind_tools(tools)

def call_model(state: AgentState):
    console.print("[dim]Agent thinking...[/dim]")
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
        "[bold cyan]🔍 ProbeAI — Autonomous API Schema & Reliability Inspector[/bold cyan]\n"
        "[dim]Dynamic Test Synthesis • Live Latency Profiling • Edge-Case & Error Auditing[/dim]\n\n"
        "[yellow]Try prompts like:[/yellow]\n"
        " • 'Test all endpoints on http://localhost:8000'\n"
        " • 'Test the bookmarks endpoint at https://recall.kamrankhan.xyz'\n"
        " • 'Test GET http://localhost:8000/api/bookmarks/search with valid and malformed queries'\n"
        " • Type [bold red]'exit'[/bold red] to quit",
        border_style="cyan"
    ))

    SYSTEM_MESSAGE = SystemMessage(content=(
        "You are ProbeAI, an expert Senior API Reliability and QA Test Engineer agent. "
        "When the user gives you an endpoint or base URL to test: "
        "1. If it's a base URL or OpenAPI spec, call fetch_openapi_spec to discover available endpoints. "
        "2. Formulate 2-4 distinct test scenarios: "
        "   - Happy Path (valid parameters & payloads) "
        "   - Edge Case / Query Filters "
        "   - Boundary / Error Case (invalid ID, malformed types, missing fields) "
        "3. Execute the tests using execute_http_request. "
        "4. Evaluate the responses (status codes, latency in ms, returned payload). "
        "5. Conclude with a clean structured summary grading pass/fail status and diagnosing any bugs found. "
        "Optionally save a report using save_test_report if requested or when a comprehensive audit is completed."
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
                        console.print("\n[bold purple]Agent Assessment:[/bold purple]")
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
