import OpenAI from 'openai';
import { BaseAIProvider } from './base';
import { ChatMessage, StreamCallbacks, ModelInfo, AIProviderConfig, ToolSchema, ToolCallbacks, ToolCallInfo } from '@shared/types/ai';

export class GeminiProvider extends BaseAIProvider {
  name = 'gemini' as const;
  displayName = 'Gemini (Google)';
  models: ModelInfo[] = [
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 1000000, inputPrice: 1.25, outputPrice: 5 },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000, inputPrice: 0.075, outputPrice: 0.3 },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1000000, inputPrice: 0.1, outputPrice: 0.4 },
  ];
  private client: OpenAI;

  constructor(config: AIProviderConfig) {
    super(config);
    this.client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl }); // OpenAI 兼容接口
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const response = await this.client.chat.completions.create({ model: this.getModel(), max_tokens: this.getMaxTokens(), temperature: this.getTemperature(), messages: messages.filter(m => m.role !== 'tool').map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })) });
    return response.choices[0]?.message?.content || '';
  }

  async chatStream(messages: ChatMessage[], callbacks: StreamCallbacks): Promise<void> {
    let fullText = '';
    try {
      const stream = await this.client.chat.completions.create({ model: this.getModel(), max_tokens: this.getMaxTokens(), temperature: this.getTemperature(), stream: true, messages: messages.filter(m => m.role !== 'tool').map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })) });
      for await (const chunk of stream) { const token = chunk.choices[0]?.delta?.content || ''; if (token) { fullText += token; callbacks.onToken(token); } }
      callbacks.onComplete(fullText);
    } catch (error) { callbacks.onError(error as Error); }
  }

  async chatWithTools(messages: ChatMessage[], tools: ToolSchema[], callbacks: ToolCallbacks): Promise<void> { // 支持工具调用
    let fullText = '';
    const toolCalls: ToolCallInfo[] = [];
    try {
      const openaiTools = tools.map(t => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.parameters } }));
      const openaiMsgs: any[] = [];
      for (const m of messages) { // 保持消息顺序
        if (m.role === 'tool') { openaiMsgs.push({ role: 'tool', tool_call_id: m.toolCallId, content: m.content }); }
        else if (m.toolCalls?.length) { openaiMsgs.push({ role: 'assistant', content: m.content || null, tool_calls: m.toolCalls.map(tc => ({ id: tc.id, type: 'function' as const, function: { name: tc.name, arguments: JSON.stringify(tc.arguments) } })) }); }
        else { openaiMsgs.push({ role: m.role, content: m.content }); }
      }
      const stream = await this.client.chat.completions.create({ model: this.getModel(), max_tokens: this.getMaxTokens(), temperature: this.getTemperature(), stream: true, messages: openaiMsgs, tools: openaiTools });
      const toolCallMap = new Map<number, { id: string; name: string; args: string }>();
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) { fullText += delta.content; callbacks.onToken(delta.content); }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (!toolCallMap.has(tc.index)) toolCallMap.set(tc.index, { id: tc.id || '', name: tc.function?.name || '', args: '' });
            const existing = toolCallMap.get(tc.index)!;
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name = tc.function.name;
            if (tc.function?.arguments) existing.args += tc.function.arguments;
          }
        }
      }
      for (const [, tc] of toolCallMap) { try { toolCalls.push({ id: tc.id, name: tc.name, arguments: JSON.parse(tc.args || '{}') }); } catch {} }
      if (toolCalls.length > 0 && callbacks.onToolCall) callbacks.onToolCall(toolCalls);
      callbacks.onComplete(fullText);
    } catch (error) { callbacks.onError(error as Error); }
  }
}
