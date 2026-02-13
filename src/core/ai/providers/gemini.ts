import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
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

export class GeminiProvider extends BaseAIProvider {
  name = "gemini" as const;
  displayName = "Gemini (Google)";
  models: ModelInfo[] = [
    {
      id: "[次]gemini-2.5-pro",
      name: "Gemini 2.5 Pro",
      contextWindow: 1000000,
      inputPrice: 0.03,
      outputPrice: 0.12,
    },
    {
      id: "[次]gemini-2.5-pro-thinking",
      name: "Gemini 2.5 Pro Thinking",
      contextWindow: 1000000,
      inputPrice: 0.03,
      outputPrice: 0.12,
    },
    {
      id: "[次]gemini-3-flash-preview",
      name: "Gemini 3 Flash Preview",
      contextWindow: 1000000,
      inputPrice: 0.02,
      outputPrice: 0.08,
    },
    {
      id: "[次]gemini-3-pro-preview",
      name: "Gemini 3 Pro Preview",
      contextWindow: 1000000,
      inputPrice: 0.05,
      outputPrice: 0.2,
    },
    {
      id: "[次]gemini-3-pro-preview-thinking",
      name: "Gemini 3 Pro Preview Thinking",
      contextWindow: 1000000,
      inputPrice: 0.05,
      outputPrice: 0.2,
    },
  ];
  private client: OpenAI;

  constructor(config: AIProviderConfig) {
    super(config);
    console.log("[Gemini] Init: baseUrl=" + config.baseUrl + ", model=" + config.model);
    this.client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl }); // OpenAI 兼容接口
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.getModel(),
      max_tokens: this.getMaxTokens(),
      temperature: this.getTemperature(),
      messages: messages
        .filter((m) => m.role !== "tool")
        .map((m) => ({
          role: m.role as "system" | "user" | "assistant",
          content: m.content,
        })) as ChatCompletionMessageParam[],
    });
    return response.choices[0]?.message?.content || "";
  }

  async chatStream(messages: ChatMessage[], callbacks: StreamCallbacks): Promise<void> {
    let fullText = "";
    try {
      const stream = await this.client.chat.completions.create({
        model: this.getModel(),
        max_tokens: this.getMaxTokens(),
        temperature: this.getTemperature(),
        stream: true,
        messages: messages
          .filter((m) => m.role !== "tool")
          .map((m) => ({
            role: m.role as "system" | "user" | "assistant",
            content: m.content,
          })) as ChatCompletionMessageParam[],
      });
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || "";
        if (token) {
          fullText += token;
          callbacks.onToken(token);
        }
      }
      callbacks.onComplete(fullText);
    } catch (error) {
      callbacks.onError(error as Error);
    }
  }

  async chatWithTools(
    messages: ChatMessage[],
    tools: ToolSchema[],
    callbacks: ToolCallbacks,
  ): Promise<void> {
    // 支持工具调用
    let fullText = "";
    const toolCalls: ToolCallInfo[] = [];
    try {
      console.log(
        "[Gemini] chatWithTools: model=" +
          this.getModel() +
          ", messages=" +
          messages.length +
          ", tools=" +
          tools.length,
      );
      const openaiTools = tools.map((t) => ({
        type: "function" as const,
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
      const openaiMsgs: Array<{
        role: string;
        content: string | null;
        tool_call_id?: string;
        tool_calls?: Array<{
          id: string;
          type: "function";
          function: { name: string; arguments: string };
        }>;
      }> = [];
      for (const m of messages) {
        // 保持消息顺序
        if (m.role === "tool") {
          openaiMsgs.push({ role: "tool", tool_call_id: m.toolCallId, content: m.content });
        } else if (m.toolCalls?.length) {
          openaiMsgs.push({
            role: "assistant",
            content: m.content || null,
            tool_calls: m.toolCalls.map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
            })),
          });
        } else {
          openaiMsgs.push({ role: m.role, content: m.content });
        }
      }
      console.log("[Gemini] Requesting stream...");
      const stream = await this.client.chat.completions.create({
        model: this.getModel(),
        max_tokens: this.getMaxTokens(),
        temperature: this.getTemperature(),
        stream: true,
        messages: openaiMsgs as ChatCompletionMessageParam[],
        tools: openaiTools,
      });
      console.log("[Gemini] Stream received, processing chunks...");
      const toolCallMap = new Map<number, { id: string; name: string; args: string }>();
      let chunkCount = 0;
      for await (const chunk of stream) {
        chunkCount++;
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          fullText += delta.content;
          callbacks.onToken(delta.content);
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (!toolCallMap.has(tc.index))
              toolCallMap.set(tc.index, {
                id: tc.id || "",
                name: tc.function?.name || "",
                args: "",
              });
            const existing = toolCallMap.get(tc.index)!;
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name = tc.function.name;
            if (tc.function?.arguments) existing.args += tc.function.arguments;
          }
        }
      }
      console.log(
        "[Gemini] Stream done: chunks=" +
          chunkCount +
          ", fullText.length=" +
          fullText.length +
          ", toolCalls=" +
          toolCallMap.size,
      );
      for (const [, tc] of toolCallMap) {
        try {
          toolCalls.push({ id: tc.id, name: tc.name, arguments: JSON.parse(tc.args || "{}") });
        } catch {
          /* JSON 解析忽略不完整数据 */
        }
      }
      if (toolCalls.length > 0 && callbacks.onToolCall) callbacks.onToolCall(toolCalls);
      callbacks.onComplete(fullText);
    } catch (error) {
      console.error("[Gemini] Error:", error);
      callbacks.onError(error as Error);
    }
  }
}
