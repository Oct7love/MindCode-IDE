"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIRouter = void 0;
const providers_1 = require("./providers");
class AIRouter {
    providers = new Map();
    defaultProvider = 'claude';
    constructor(registry) {
        this.initializeProviders(registry);
    }
    initializeProviders(registry) {
        if (registry.claude) {
            this.providers.set('claude', new providers_1.ClaudeProvider(registry.claude));
        }
        if (registry.openai) {
            this.providers.set('openai', new providers_1.OpenAIProvider(registry.openai));
        }
        if (registry.gemini) {
            this.providers.set('gemini', new providers_1.GeminiProvider(registry.gemini));
        }
        if (registry.deepseek) {
            this.providers.set('deepseek', new providers_1.DeepSeekProvider(registry.deepseek));
        }
    }
    setDefaultProvider(provider) {
        if (this.providers.has(provider)) {
            this.defaultProvider = provider;
        }
    }
    getProvider(type) {
        return this.providers.get(type || this.defaultProvider);
    }
    getAvailableProviders() {
        return Array.from(this.providers.keys());
    }
    async chat(messages, provider) {
        const p = this.getProvider(provider);
        if (!p)
            throw new Error(`Provider ${provider || this.defaultProvider} not configured`);
        return p.chat(messages);
    }
    async chatStream(messages, callbacks, provider) {
        const p = this.getProvider(provider);
        if (!p)
            throw new Error(`Provider ${provider || this.defaultProvider} not configured`);
        return p.chatStream(messages, callbacks);
    }
}
exports.AIRouter = AIRouter;
//# sourceMappingURL=router.js.map