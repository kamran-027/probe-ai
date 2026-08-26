export interface ExecutionLog {
  method: string;
  url: string;
  statusCode: number;
  elapsedMs: number;
  timestamp: string;
  params: any;
  body: any;
  response: any;
  passed: boolean;
}

export const sessionHeaders: Record<string, string> = {
  "User-Agent": "ProbeAI-CLI/1.0.0",
};

export const testExecutionLogs: ExecutionLog[] = [];
