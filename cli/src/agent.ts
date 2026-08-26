import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { StateGraph, START, Annotation } from "@langchain/langgraph";
import { BaseMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import chalk from "chalk";

import { fetchOpenApiSpecTool } from "./tools/openapi.js";
import { authenticateViaLoginTool, setAuthHeaderTool } from "./tools/auth.js";
import { executeHttpRequestTool } from "./tools/http.js";
import { exportPostmanCollectionTool } from "./tools/postman.js";
import { saveHtmlAuditReportTool } from "./tools/report.js";

const tools = [
  fetchOpenApiSpecTool,
  authenticateViaLoginTool,
  setAuthHeaderTool,
  executeHttpRequestTool,
  exportPostmanCollectionTool,
  saveHtmlAuditReportTool,
];

const toolNode = new ToolNode(tools);

// Define Agent State
export const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (curr, update) => curr.concat(update),
    default: () => [],
  }),
});

export function createProbeAgent(apiKey: string) {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3.6-flash",
    temperature: 0.2,
    apiKey,
  }).bindTools(tools);

  const callModel = async (state: typeof GraphState.State) => {
    const response = await model.invoke(state.messages);
    return { messages: [response] };
  };

  const shouldContinue = (state: typeof GraphState.State) => {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
      return "tools";
    }
    return "__end__";
  };

  const workflow = new StateGraph(GraphState)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent");

  return workflow.compile();
}

export const PROBE_SYSTEM_MESSAGE = new SystemMessage(
  "You are ProbeAI, an expert Senior API Reliability and QA Test Engineer agent.\n" +
    "When the user interacts with you:\n" +
    "1. For API Inspection & Testing:\n" +
    "   - Call fetch_openapi_spec to discover endpoints & security schemes.\n" +
    "   - If authentication is required or requested, use authenticate_via_login or set_auth_header.\n" +
    "   - Formulate 3-4 distinct test cases (Happy Path, Query Filters, Error cases).\n" +
    "   - STRICT BUDGET RULE: Execute at most 4 to 5 execute_http_request calls in total.\n" +
    "2. If requested to export Postman collections, call export_postman_collection.\n" +
    "3. If requested to generate reports (or after running a comprehensive test suite), call save_html_audit_report.\n" +
    "4. Always finish with a clear markdown summary table and reliability grade."
);
