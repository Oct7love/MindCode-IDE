import { BaseAIProvider } from "./base";
import type {
  ChatMessage,
  StreamCallbacks,
  ModelInfo,
  AIProviderConfig,
  ToolSchema,
  ToolCallbacks,
  ToolCallInfo,
} from "@shared/types/ai";
import { DEFAULT_BASE_URLS } from "../config";
import * as http from "http";
import * as https from "https";

/** 响应体最大字节数 (10MB) */
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

/** 流式无数据超时 (30s) */
const STREAM_IDLE_TIMEOUT_MS = 30000;

export class ClaudeProvider extends BaseAIProvider {
  name = "claude" as const;
  displayName = "Claude (Anthropic)";

  models: ModelInfo[] = [
    {
      id: "claude-opus-4-6",
      name: "Claude Opus 4.6",
      contextWindow: 200000,
      inputPrice: 15,
      outputPrice: 75,
    },
    {
      id: "claude-sonnet-4-5-20250929",
      name: "Claude Sonnet 4.5",
      contextWindow: 200000,
      inputPrice: 3,
      outputPrice: 15,
    },
    {
      id: "claude-haiku-4-5-20251001",
      name: "Claude Haiku 4.5",
      contextWindow: 200000,
      inputPrice: 0.8,
      outputPrice: 4,
    },
  ];

  private apiKey: string;
  private baseUrl: string;

  constructor(config: AIProviderConfig) {
    super(config);
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URLS.claude;
  }

  private request(
    body: string,
    stream: boolean,
  ): Promise<{
    data?: { content?: Array<{ type: string; text?: string }> };
    stream?: http.IncomingMessage;
    error?: string;
  }> {
    return new Promise((resolve) => {
      // Anthropic 原生 API 端点
      const url = new URL(`${this.baseUrl}/v1/messages`);
      const isHttps = url.protocol === "https:";
      const lib = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          Authorization: `Bearer ${this.apiKey}`,
          "anthropic-version": "2023-06-01",
          "Content-Length": Buffer.byteLength(body),
        },
      };

      const req = lib.request(options, (res) => {
        if (stream) {
          if (res.statusCode !== 200) {
            let errorData = "";
            res.on("data", (chunk) => (errorData += chunk));
            res.on("end", () => resolve({ error: `API Error ${res.statusCode}: ${errorData}` }));
          } else {
            resolve({ stream: res });
          }
        } else {
          let data = "";
          let totalBytes = 0;
          res.on("data", (chunk) => {
            totalBytes += chunk.length;
            if (totalBytes > MAX_RESPONSE_BYTES) {
              res.destroy(new Error("Response exceeded 10MB limit"));
              return;
            }
            data += chunk;
          });
          res.on("end", () => {
            if (res.statusCode !== 200) {
              resolve({ error: `API Error ${res.statusCode}: ${data}` });
            } else {
              try {
                resolve({ data: JSON.parse(data) });
              } catch (e) {
                resolve({ error: `Parse error: ${data}` });
              }
            }
          });
        }
      });

      req.on("error", (e) => resolve({ error: e.message }));
      req.write(body);
      req.end();
    });
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const systemMessage = messages.find((m) => m.role === "system");
    const chatMessages = messages.filter((m) => m.role !== "system");

    const body = JSON.stringify({
      model: this.getModel(),
      max_tokens: this.getMaxTokens(),
      system: systemMessage?.content,
      messages: chatMessages.map((m) => ({ role: m.role, content: m.content })),
    });

    const result = await this.request(body, false);
    if (result.error) throw new Error(result.error);

    const textBlock = result.data?.content?.find((block) => block.type === "text");
    return textBlock?.text || "";
  }

  async chatStream(messages: ChatMessage[], callbacks: StreamCallbacks): Promise<void> {
    const systemMessage = messages.find((m) => m.role === "system");
    const chatMessages = messages.filter((m) => m.role !== "system");

    const body = JSON.stringify({
      model: this.getModel(),
      max_tokens: this.getMaxTokens(),
      stream: true,
      system: systemMessage?.content,
      messages: chatMessages.map((m) => ({ role: m.role, content: m.content })),
    });

    let fullText = "";

    try {
      const result = await this.request(body, true);
      if (result.error) {
        callbacks.onError(new Error(result.error));
        return;
      }

      const res = result.stream!;
      let buffer = "";
      let totalBytes = 0;

      // 流式空闲超时检测
      let idleTimer = setTimeout(() => {
        res.destroy(new Error("Stream idle timeout (30s no data)"));
      }, STREAM_IDLE_TIMEOUT_MS);

      res.on("data", (chunk: Buffer) => {
        // 重置空闲超时
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          res.destroy(new Error("Stream idle timeout (30s no data)"));
        }, STREAM_IDLE_TIMEOUT_MS);

        // 响应大小限制
        totalBytes += chunk.length;
        if (totalBytes > MAX_RESPONSE_BYTES) {
          res.destroy(new Error("Stream response exceeded 10MB limit"));
          return;
        }

        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            if (!data) continue;

            try {
              const parsed = JSON.parse(data);
              // Anthropic 流式格式
              if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
                const token = parsed.delta.text;
                fullText += token;
                callbacks.onToken(token);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      });

      res.on("end", () => {
        clearTimeout(idleTimer);
        callbacks.onComplete(fullText);
      });

      res.on("error", (e: Error) => {
        clearTimeout(idleTimer);
        callbacks.onError(e);
      });
    } catch (error) {
      callbacks.onError(error as Error);
    }
  }

  async chatWithTools(
    messages: ChatMessage[],
    tools: ToolSchema[],
    callbacks: ToolCallbacks,
  ): Promise<void> {
    // 支持工具调用的流式聊天
    const systemMessage = messages.find((m) => m.role === "system");
    const chatMessages: Array<{
      role: "user" | "assistant";
      content:
        | string
        | Array<{
            type: string;
            tool_use_id?: string;
            content?: string;
            id?: string;
            name?: string;
            input?: Record<string, unknown>;
          }>;
    }> = messages
      .filter((m) => m.role !== "system")
      .map((m) => {
        if (m.role === "tool")
          return {
            role: "user" as const,
            content: [{ type: "tool_result", tool_use_id: m.toolCallId, content: m.content }],
          };
        if (m.toolCalls?.length)
          return {
            role: "assistant" as const,
            content: m.toolCalls.map((tc) => ({
              type: "tool_use",
              id: tc.id,
              name: tc.name,
              input: tc.arguments,
            })),
          };
        return { role: m.role as "user" | "assistant", content: m.content };
      });
    const claudeTools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
    const body = JSON.stringify({
      model: this.getModel(),
      max_tokens: this.getMaxTokens(),
      stream: true,
      system: systemMessage?.content,
      messages: chatMessages,
      tools: claudeTools,
    });
    let fullText = "",
      toolCalls: ToolCallInfo[] = [],
      currentToolUse: { id: string; name: string; input: string } | null = null;
    try {
      const result = await this.request(body, true);
      if (result.error) {
        callbacks.onError(new Error(result.error));
        return;
      }
      const res = result.stream!;
      let buffer = "";
      let totalBytes = 0;
      let idleTimer = setTimeout(() => {
        res.destroy(new Error("Stream idle timeout (30s no data)"));
      }, STREAM_IDLE_TIMEOUT_MS);

      res.on("data", (chunk: Buffer) => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          res.destroy(new Error("Stream idle timeout (30s no data)"));
        }, STREAM_IDLE_TIMEOUT_MS);

        totalBytes += chunk.length;
        if (totalBytes > MAX_RESPONSE_BYTES) {
          res.destroy(new Error("Stream response exceeded 10MB limit"));
          return;
        }

        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            if (
              parsed.type === "content_block_start" &&
              parsed.content_block?.type === "tool_use"
            ) {
              currentToolUse = {
                id: parsed.content_block.id,
                name: parsed.content_block.name,
                input: "",
              };
            } else if (parsed.type === "content_block_delta") {
              if (parsed.delta?.type === "text_delta") {
                fullText += parsed.delta.text;
                callbacks.onToken(parsed.delta.text);
              } else if (parsed.delta?.type === "input_json_delta" && currentToolUse) {
                currentToolUse.input += parsed.delta.partial_json || "";
              }
            } else if (parsed.type === "content_block_stop" && currentToolUse) {
              try {
                toolCalls.push({
                  id: currentToolUse.id,
                  name: currentToolUse.name,
                  arguments: JSON.parse(currentToolUse.input || "{}"),
                });
              } catch {
                /* JSON 解析忽略不完整数据 */
              }
              currentToolUse = null;
            }
          } catch {
            /* JSON 解析忽略不完整数据 */
          }
        }
      });
      res.on("end", () => {
        clearTimeout(idleTimer);
        if (toolCalls.length > 0 && callbacks.onToolCall) callbacks.onToolCall(toolCalls);
        callbacks.onComplete(fullText);
      });
      res.on("error", (e: Error) => {
        clearTimeout(idleTimer);
        callbacks.onError(e);
      });
    } catch (error) {
      callbacks.onError(error as Error);
    }
  }
}
