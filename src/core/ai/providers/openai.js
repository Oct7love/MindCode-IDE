"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIProvider = void 0;
const openai_1 = __importDefault(require("openai"));
const base_1 = require("./base");
class OpenAIProvider extends base_1.BaseAIProvider {
    name = 'openai';
    displayName = 'OpenAI';
    models = [
        { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, inputPrice: 2.5, outputPrice: 10 },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, inputPrice: 0.15, outputPrice: 0.6 },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', contextWindow: 128000, inputPrice: 10, outputPrice: 30 },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', contextWindow: 16385, inputPrice: 0.5, outputPrice: 1.5 },
    ];
    client;
    constructor(config) {
        super(config);
        this.client = new openai_1.default({
            apiKey: config.apiKey,
            baseURL: config.baseUrl
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
exports.OpenAIProvider = OpenAIProvider;
//# sourceMappingURL=openai.js.map