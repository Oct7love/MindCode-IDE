"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiProvider = void 0;
const generative_ai_1 = require("@google/generative-ai");
const base_1 = require("./base");
class GeminiProvider extends base_1.BaseAIProvider {
    name = 'gemini';
    displayName = 'Gemini (Google)';
    models = [
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 1000000, inputPrice: 1.25, outputPrice: 5 },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000, inputPrice: 0.075, outputPrice: 0.3 },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1000000, inputPrice: 0.1, outputPrice: 0.4 },
    ];
    client;
    constructor(config) {
        super(config);
        this.client = new generative_ai_1.GoogleGenerativeAI(config.apiKey);
    }
    async chat(messages) {
        const model = this.client.getGenerativeModel({ model: this.getModel() });
        const systemMessage = messages.find(m => m.role === 'system');
        const chatMessages = messages.filter(m => m.role !== 'system');
        const history = chatMessages.slice(0, -1).map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));
        const chat = model.startChat({
            history: history,
            systemInstruction: systemMessage?.content
        });
        const lastMessage = chatMessages[chatMessages.length - 1];
        const result = await chat.sendMessage(lastMessage.content);
        return result.response.text();
    }
    async chatStream(messages, callbacks) {
        const model = this.client.getGenerativeModel({ model: this.getModel() });
        const systemMessage = messages.find(m => m.role === 'system');
        const chatMessages = messages.filter(m => m.role !== 'system');
        const history = chatMessages.slice(0, -1).map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));
        const chat = model.startChat({
            history: history,
            systemInstruction: systemMessage?.content
        });
        let fullText = '';
        try {
            const lastMessage = chatMessages[chatMessages.length - 1];
            const result = await chat.sendMessageStream(lastMessage.content);
            for await (const chunk of result.stream) {
                const token = chunk.text();
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
exports.GeminiProvider = GeminiProvider;
//# sourceMappingURL=gemini.js.map