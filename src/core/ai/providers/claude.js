"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeProvider = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const base_1 = require("./base");
class ClaudeProvider extends base_1.BaseAIProvider {
    name = 'claude';
    displayName = 'Claude (Anthropic)';
    models = [
        { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextWindow: 200000, inputPrice: 3, outputPrice: 15 },
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextWindow: 200000, inputPrice: 3, outputPrice: 15 },
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', contextWindow: 200000, inputPrice: 15, outputPrice: 75 },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', contextWindow: 200000, inputPrice: 0.25, outputPrice: 1.25 },
    ];
    client;
    constructor(config) {
        super(config);
        this.client = new sdk_1.default({
            apiKey: config.apiKey,
            baseURL: config.baseUrl
        });
    }
    async chat(messages) {
        const systemMessage = messages.find(m => m.role === 'system');
        const chatMessages = messages.filter(m => m.role !== 'system');
        const response = await this.client.messages.create({
            model: this.getModel(),
            max_tokens: this.getMaxTokens(),
            system: systemMessage?.content,
            messages: chatMessages.map(m => ({
                role: m.role,
                content: m.content
            }))
        });
        const textBlock = response.content.find(block => block.type === 'text');
        return textBlock ? textBlock.text : '';
    }
    async chatStream(messages, callbacks) {
        const systemMessage = messages.find(m => m.role === 'system');
        const chatMessages = messages.filter(m => m.role !== 'system');
        let fullText = '';
        try {
            const stream = this.client.messages.stream({
                model: this.getModel(),
                max_tokens: this.getMaxTokens(),
                system: systemMessage?.content,
                messages: chatMessages.map(m => ({
                    role: m.role,
                    content: m.content
                }))
            });
            for await (const event of stream) {
                if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                    const token = event.delta.text;
                    fullText += token;
                    callbacks.onToken(token);
                }
            }
            callbacks.onComplete(fullText);
        }
        catch (error) {
            callbacks.onError(error);
        }
    }
}
exports.ClaudeProvider = ClaudeProvider;
//# sourceMappingURL=claude.js.map