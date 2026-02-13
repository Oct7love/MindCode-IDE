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

// 延迟导入 electron.net，避免在模块加载阶段访问未初始化的 Electron API
let electronNet: typeof import("electron").net | null = null;
function getNet(): typeof import("electron").net {
  if (!electronNet) {
    electronNet = require("electron").net;
  }
  return electronNet!;
}

export class CodesucProvider extends BaseAIProvider {
  // 特价渠道 - Electron net 模块（纯文本 Agent Loop）
  name = "codesuc" as const;
  displayName = "Claude (特价)";
  models: ModelInfo[] = [
    {
      id: "codesuc-opus",
      name: "Claude Opus 4.5 [特价]",
      contextWindow: 200000,
      inputPrice: 10,
      outputPrice: 50,
    },
    {
      id: "codesuc-sonnet",
      name: "Claude Sonnet 4.5 [特价]",
      contextWindow: 200000,
      inputPrice: 2,
      outputPrice: 10,
    },
    {
      id: "codesuc-haiku",
      name: "Claude Haiku 4.5 [特价]",
      contextWindow: 200000,
      inputPrice: 0.25,
      outputPrice: 1.25,
    },
  ];
  supportsTools = false; // 渠道不支持 Anthropic tools，使用纯文本 Agent Loop
  private apiKey: string;
  private baseUrl: string;
  private modelMap: Record<string, string> = {
    "codesuc-opus": "claude-opus-4-5-20251101",
    "codesuc-sonnet": "claude-sonnet-4-5-20250929",
    "codesuc-haiku": "claude-haiku-4-5-20251001",
    "special-claude-opus-4-5": "claude-opus-4-5-20251101",
    "special-claude-sonnet-4-5": "claude-sonnet-4-5-20250929",
    "special-claude-haiku-4-5": "claude-haiku-4-5-20251001",
    opus: "claude-opus-4-5-20251101",
    sonnet: "claude-sonnet-4-5-20250929",
    haiku: "claude-haiku-4-5-20251001",
  };

  private capabilitiesCache: { tools: boolean; stream: boolean; probed: boolean } = {
    tools: false,
    stream: true,
    probed: false,
  };

  constructor(config: AIProviderConfig) {
    super(config);
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || DEFAULT_BASE_URLS.codesuc).replace(/\/$/, "");
    console.log(`[Codesuc] Init: baseUrl=${this.baseUrl}, apiKey=${this.apiKey?.slice(0, 10)}...`);
  }

  async probeCapabilities(): Promise<{ tools: boolean; stream: boolean }> {
    // 能力探测（启动时调用一次）
    if (this.capabilitiesCache.probed) return this.capabilitiesCache;
    console.log(`[Codesuc] Probing capabilities...`);
    const testMsg = [{ role: "user", content: "hi" }];
    const testTool = [
      { name: "test", description: "test", input_schema: { type: "object", properties: {} } },
    ];
    try {
      // 测试 tools 支持
      const body = {
        model: "claude-opus-4-5-20251101",
        max_tokens: 10,
        messages: testMsg,
        tools: testTool,
      };
      await this.request(body, false);
      this.capabilitiesCache.tools = true;
      this.supportsTools = true;
      console.log(`[Codesuc] Tools supported: YES`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("400") || msg.includes("渠道")) {
        this.capabilitiesCache.tools = false;
        this.supportsTools = false;
        console.log(`[Codesuc] Tools supported: NO (${msg})`);
      } else {
        console.log(`[Codesuc] Tools probe error: ${msg}`);
      }
    }
    this.capabilitiesCache.probed = true;
    return this.capabilitiesCache;
  }

  private getApiModel(): string {
    const localModel = this.getModel();
    return this.modelMap[localModel] || localModel;
  }

  private async request(
    body: Record<string, unknown>,
    stream: boolean,
  ): Promise<Record<string, unknown>> {
    const url = `${this.baseUrl}/v1/messages`;
    const bodyStr = JSON.stringify(body);
    console.log(`[Codesuc] Request: ${url}, model=${body.model}, stream=${stream}`);
    return new Promise((resolve, reject) => {
      const request = getNet().request({ method: "POST", url });
      request.setHeader("Content-Type", "application/json");
      request.setHeader("x-api-key", this.apiKey); // Anthropic 标准认证
      request.setHeader("anthropic-version", "2023-06-01");
      let responseData = "";
      let statusCode = 0;
      request.on("response", (response) => {
        statusCode = response.statusCode;
        console.log(`[Codesuc] Response status: ${statusCode}`);
        if (stream) {
          resolve({ response, statusCode });
          return;
        }
        response.on("data", (chunk) => {
          responseData += chunk.toString();
        });
        response.on("end", () => {
          if (statusCode !== 200) {
            reject(new Error(`API Error ${statusCode}: ${responseData}`));
            return;
          }
          try {
            resolve(JSON.parse(responseData));
          } catch {
            reject(new Error(`Parse error: ${responseData}`));
          }
        });
        response.on("error", reject);
      });
      request.on("error", (err) => {
        console.error(`[Codesuc] Request error:`, err);
        reject(err);
      });
      request.write(bodyStr);
      request.end();
    });
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const systemMsg = messages.find((m) => m.role === "system");
    const chatMsgs = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));
    const system = systemMsg ? [{ type: "text", text: systemMsg.content }] : undefined; // 数组格式
    const body = {
      model: this.getApiModel(),
      max_tokens: this.getMaxTokens(),
      system,
      messages: chatMsgs,
    };
    const response = await this.request(body, false);
    const content = response?.content as Array<{ type: string; text?: string }> | undefined;
    return content?.find((b) => b.type === "text")?.text || "";
  }

  async chatStream(messages: ChatMessage[], callbacks: StreamCallbacks): Promise<void> {
    const systemMsg = messages.find((m) => m.role === "system");
    const chatMsgs = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));
    const system = systemMsg ? [{ type: "text", text: systemMsg.content }] : undefined;
    const body = {
      model: this.getApiModel(),
      max_tokens: this.getMaxTokens(),
      stream: true,
      system,
      messages: chatMsgs,
    };
    let fullText = "";
    try {
      const result = (await this.request(body, true)) as {
        response: import("electron").IncomingMessage;
        statusCode: number;
      };
      const { response, statusCode } = result;
      if (statusCode !== 200) {
        let errData = "";
        response.on("data", (c: Buffer) => (errData += c.toString()));
        response.on("end", () => {
          console.error(`[Codesuc] Stream Error ${statusCode}: ${errData}`);
          callbacks.onError(new Error(`API Error ${statusCode}: ${errData}`));
        });
        return;
      }
      let buffer = "";
      let chunkCount = 0;
      response.on("data", (chunk: Buffer) => {
        const chunkStr = chunk.toString();
        chunkCount++;
        buffer += chunkStr;
        // 按双换行分割 SSE 事件，更可靠
        const events = buffer.split(/\n\n/);
        buffer = events.pop() || ""; // 保留最后不完整的部分
        for (const event of events) {
          const lines = event.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data:")) continue; // 兼容 'data:' 和 'data: '
            const data = line.slice(line.startsWith("data: ") ? 6 : 5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const p = JSON.parse(data);
              if (p.type === "content_block_delta" && p.delta?.type === "text_delta") {
                fullText += p.delta.text;
                callbacks.onToken(p.delta.text);
              } else if (p.delta?.text) {
                fullText += p.delta.text;
                callbacks.onToken(p.delta.text);
              }
            } catch {
              /* JSON 解析忽略不完整数据 */
            }
          }
        }
      });
      response.on("end", () => {
        console.log(`[Codesuc] chatStream end: ${chunkCount} chunks, ${fullText.length} chars`);
        callbacks.onComplete(fullText);
      });
      response.on("error", (e: Error) => callbacks.onError(e));
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`[Codesuc] chatStream error:`, err.message);
      callbacks.onError(err);
    }
  }

  async chatWithTools(
    messages: ChatMessage[],
    tools: ToolSchema[],
    callbacks: ToolCallbacks,
  ): Promise<void> {
    // 纯文本 Agent Loop（不发送 tools 字段）
    const toolsPrompt = this.buildToolsPrompt(tools); // 将 tools 转为纯文本描述嵌入 system prompt
    const systemMsg = messages.find((m) => m.role === "system");
    const enhancedSystem = [
      { type: "text", text: `${systemMsg?.content || ""}\n\n${toolsPrompt}` },
    ];
    const chatMsgs = messages
      .filter((m) => m.role !== "system")
      .map((m) => {
        if (m.role === "tool")
          return { role: "user", content: `[Tool Result: ${m.toolCallId}]\n${m.content}` }; // 工具结果转为纯文本
        if (m.toolCalls?.length)
          return {
            role: "assistant",
            content: m.toolCalls
              .map(
                (tc) =>
                  `<tool_call>\n<name>${tc.name}</name>\n<arguments>${JSON.stringify(tc.arguments, null, 2)}</arguments>\n</tool_call>`,
              )
              .join("\n"),
          };
        return { role: m.role, content: m.content };
      });
    const body = {
      model: this.getApiModel(),
      max_tokens: this.getMaxTokens(),
      stream: true,
      system: enhancedSystem,
      messages: chatMsgs,
    }; // 不传 tools 字段
    let fullText = "";
    try {
      const result = (await this.request(body, true)) as {
        response: import("electron").IncomingMessage;
        statusCode: number;
      };
      const { response, statusCode } = result;
      if (statusCode !== 200) {
        let errData = "";
        response.on("data", (c: Buffer) => (errData += c.toString()));
        response.on("end", () =>
          callbacks.onError(new Error(`API Error ${statusCode}: ${errData}`)),
        );
        return;
      }
      let buffer = "";
      let chunkCount = 0;
      let errorDetected = false;
      let toolCallDepth = 0; // 追踪是否在 <tool_call> 块内
      let pendingText = ""; // 累积待发送的文本，用于检测标签边界

      // 过滤 tool_call 标签，只发送非工具调用部分给 onToken
      const filterAndEmitToken = (text: string) => {
        pendingText += text;
        let safeText = "";

        while (pendingText.length > 0) {
          if (toolCallDepth > 0) {
            // 在工具调用块内，查找结束标签
            const endIdx = pendingText.indexOf("</tool_call>");
            if (endIdx !== -1) {
              pendingText = pendingText.slice(endIdx + 13); // 跳过 </tool_call>
              toolCallDepth--;
            } else {
              // 结束标签可能跨 chunk，保留待检测
              if (pendingText.length > 20) {
                pendingText = pendingText.slice(-20);
              }
              break;
            }
          } else {
            // 查找开始标签
            const startIdx = pendingText.indexOf("<tool_call>");
            if (startIdx !== -1) {
              // 发送标签之前的安全文本
              safeText += pendingText.slice(0, startIdx);
              pendingText = pendingText.slice(startIdx + 11); // 跳过 <tool_call>
              toolCallDepth++;
            } else {
              // 检查是否有不完整的开始标签（可能跨 chunk）
              const partialMatch = pendingText.match(
                /<(?:t(?:o(?:o(?:l(?:_(?:c(?:a(?:l(?:l)?)?)?)?)?)?)?)?)?$/,
              );
              if (partialMatch) {
                safeText += pendingText.slice(0, partialMatch.index);
                pendingText = partialMatch[0];
              } else {
                safeText += pendingText;
                pendingText = "";
              }
              break;
            }
          }
        }

        if (safeText) {
          callbacks.onToken(safeText);
        }
      };

      response.on("data", (chunk: Buffer) => {
        const chunkStr = chunk.toString();
        chunkCount++;
        if (chunkCount <= 3)
          console.log(
            `[Codesuc] Chunk #${chunkCount} (${chunkStr.length} bytes):`,
            chunkStr.slice(0, 200),
          );

        // 检测 API 返回的错误 JSON（状态码200但内容是错误）
        if (
          chunkCount === 1 &&
          chunkStr.includes('"error"') &&
          chunkStr.includes('"type":"error"')
        ) {
          try {
            const errJson = JSON.parse(chunkStr);
            if (errJson.error?.message) {
              console.error(`[Codesuc] API Error in response:`, errJson.error.message);
              errorDetected = true;
              callbacks.onError(new Error(`Codesuc API: ${errJson.error.message}`));
              return;
            }
          } catch {
            /* JSON 解析忽略不完整数据 */
          }
        }
        if (errorDetected) return;

        buffer += chunkStr;
        // 按双换行分割 SSE 事件，更可靠
        const events = buffer.split(/\n\n/);
        buffer = events.pop() || ""; // 保留最后不完整的部分
        for (const event of events) {
          const lines = event.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data:")) continue; // 兼容 'data:' 和 'data: '
            const data = line.slice(line.startsWith("data: ") ? 6 : 5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const p = JSON.parse(data);
              // 兼容多种响应格式
              if (p.type === "content_block_delta" && p.delta?.type === "text_delta") {
                fullText += p.delta.text;
                filterAndEmitToken(p.delta.text);
              } else if (p.delta?.text) {
                // 简化格式
                fullText += p.delta.text;
                filterAndEmitToken(p.delta.text);
              } else if (p.choices?.[0]?.delta?.content) {
                // OpenAI 兼容格式
                fullText += p.choices[0].delta.content;
                filterAndEmitToken(p.choices[0].delta.content);
              }
            } catch (e) {
              console.log(`[Codesuc] Parse error:`, data.slice(0, 100));
            }
          }
        }
      });
      response.on("end", () => {
        console.log(
          `[Codesuc] Stream end: ${chunkCount} chunks, fullText=${fullText.length} chars`,
        );
        const toolCalls = this.parseToolCalls(fullText); // 从纯文本中解析工具调用
        if (toolCalls.length > 0 && callbacks.onToolCall) callbacks.onToolCall(toolCalls);
        callbacks.onComplete(fullText);
      });
      response.on("error", (e: Error) => callbacks.onError(e));
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`[Codesuc] chatWithTools error:`, err.message);
      callbacks.onError(err);
    }
  }

  private buildToolsPrompt(tools: ToolSchema[]): string {
    // 将 tools schema 转为纯文本描述
    const toolDescs = tools
      .map((t) => `### ${t.name}\n${t.description}\n参数: ${JSON.stringify(t.parameters, null, 2)}`)
      .join("\n\n");
    return `# 可用工具\n你可以调用以下工具完成任务。调用时使用 <tool_call> 标签：\n<tool_call>\n<name>工具名</name>\n<arguments>{"参数名": "值"}</arguments>\n</tool_call>\n\n${toolDescs}`;
  }

  private parseToolCalls(text: string): ToolCallInfo[] {
    // 从模型输出中解析 <tool_call> 标签
    const calls: ToolCallInfo[] = [];
    const regex =
      /<tool_call>\s*<name>([^<]+)<\/name>\s*<arguments>([\s\S]*?)<\/arguments>\s*<\/tool_call>/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      try {
        calls.push({
          id: `tc_${Date.now()}_${calls.length}`,
          name: match[1].trim(),
          arguments: JSON.parse(match[2].trim()),
        });
      } catch {
        console.warn("[Codesuc] 工具调用参数解析失败:", match[1]?.trim());
      }
    }
    return calls;
  }
}
