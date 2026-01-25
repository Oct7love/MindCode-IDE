"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeepSeekProvider = void 0;
const openai_1 = __importDefault(require("openai"));
const base_1 = require("./base");
class DeepSeekProvider extends base_1.BaseAIProvider {
    name = 'deepseek';
    displayName = 'DeepSeek';
    models = [
        { id: 'deepseek-coder', name: 'DeepSeek Coder', contextWindow: 128000, inputPrice: 0.14, outputPrice: 0.28 },
        { id: 'deepseek-chat', name: 'DeepSeek Chat', contextWindow: 128000, inputPrice: 0.14, outputPrice: 0.28 },
    ];
    client;
    constructor(config) {
        super(config);
        // DeepSeek 使用 OpenAI 兼容接口
        this.client = new openai_1.default({
            apiKey: config.apiKey,
            baseURL: config.baseUrl || 'https://api.deepseek.com/v1'
        });
    }
    async chat(messages) {
        const response = await this.client.chat.completions.create({
            model: this.getModel(),
            max_tokens: this.getMaxTokens(),
            temperature: this.getTemperature(),
            messages: messages.map(m => ({
                role: m.role,
                content: m.content
            }))
        });
        return response.choices[0]?.message?.content || '';
    }
    async chatStream(messages, callbacks) {
        let fullText = '';
        try {
            const stream = await this.client.chat.completions.create({
                model: this.getModel(),
                max_tokens: this.getMaxTokens(),
                temperature: this.getTemperature(),
                stream: true,
                messages: messages.map(m => ({
                    role: m.role,
                    content: m.content
                }))
            });
            for await (const chunk of stream) {
                const token = chunk.choices[0]?.delta?.content || '';
                if (token) {
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
exports.DeepSeekProvider = DeepSeekProvider;
//# sourceMappingURL=deepseek.js.map