import Anthropic from '@anthropic-ai/sdk';
import { BaseAIProvider } from './base';
import { ChatMessage, StreamCallbacks, ModelInfo, AIProviderConfig, ToolSchema, ToolCallbacks, ToolCallInfo } from '@shared/types/ai';

export class GLMProvider extends BaseAIProvider { // 智谱 GLM - 使用 Anthropic 兼容协议
  name = 'glm' as const;
  displayName = '智谱 GLM';
  models: ModelInfo[] = [
    { id: 'glm-4.7', name: 'GLM-4.7', contextWindow: 200000, inputPrice: 0.05, outputPrice: 0.05 },
    { id: 'glm-4.7-flashx', name: 'GLM-4.7 FlashX', contextWindow: 200000, inputPrice: 0, outputPrice: 0 },
  ];
  private client: Anthropic;

  constructor(config: AIProviderConfig) {
    super(config);
    this.client = new Anthropic({ apiKey: config.apiKey, baseURL: config.baseUrl || 'https://open.bigmodel.cn/api/anthropic' });
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const systemMsg = messages.find(m => m.role === 'system')?.content;
    const chatMsgs = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    const response = await this.client.messages.create({ model: this.getModel(), max_tokens: this.getMaxTokens(), system: systemMsg, messages: chatMsgs });
    return response.content[0]?.type === 'text' ? response.content[0].text : '';
  }

  async chatStream(messages: ChatMessage[], callbacks: StreamCallbacks): Promise<void> {
    let fullText = '';
    try {
      const systemMsg = messages.find(m => m.role === 'system')?.content;
      const chatMsgs = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      const stream = this.client.messages.stream({ model: this.getModel(), max_tokens: this.getMaxTokens(), system: systemMsg, messages: chatMsgs });
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') { fullText += event.delta.text; callbacks.onToken(event.delta.text); }
      }
      callbacks.onComplete(fullText);
    } catch (error) { callbacks.onError(error as Error); }
  }

  async chatWithTools(messages: ChatMessage[], tools: ToolSchema[], callbacks: ToolCallbacks): Promise<void> { // 支持工具调用
    let fullText = '';
    const toolCalls: ToolCallInfo[] = [];
    try {
      const systemMsg = messages.find(m => m.role === 'system')?.content;
      const chatMsgs = messages.filter(m => m.role !== 'system' && m.role !== 'tool').map(m => {
        if (m.toolCalls?.length) return { role: 'assistant' as const, content: m.toolCalls.map(tc => ({ type: 'tool_use' as const, id: tc.id, name: tc.name, input: tc.arguments })) };
        return { role: m.role as 'user' | 'assistant', content: m.content };
      });
      // 处理 tool 结果消息
      const toolResults = messages.filter(m => m.role === 'tool').map(m => ({ type: 'tool_result' as const, tool_use_id: m.toolCallId!, content: m.content }));
      if (toolResults.length > 0) chatMsgs.push({ role: 'user', content: toolResults as any });
      const glmTools = tools.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters }));
      const stream = this.client.messages.stream({ model: this.getModel(), max_tokens: this.getMaxTokens(), system: systemMsg, messages: chatMsgs, tools: glmTools });
      let currentToolUse: { id: string; name: string; input: string } | null = null;
      for await (const event of stream) {
        if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
          currentToolUse = { id: event.content_block.id, name: event.content_block.name, input: '' };
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') { fullText += event.delta.text; callbacks.onToken(event.delta.text); }
          else if (event.delta.type === 'input_json_delta' && currentToolUse) { currentToolUse.input += event.delta.partial_json; }
        } else if (event.type === 'content_block_stop' && currentToolUse) {
          try { toolCalls.push({ id: currentToolUse.id, name: currentToolUse.name, arguments: JSON.parse(currentToolUse.input || '{}') }); } catch {}
          currentToolUse = null;
        }
      }
      if (toolCalls.length > 0 && callbacks.onToolCall) callbacks.onToolCall(toolCalls);
      callbacks.onComplete(fullText);
    } catch (error) { callbacks.onError(error as Error); }
  }
}
