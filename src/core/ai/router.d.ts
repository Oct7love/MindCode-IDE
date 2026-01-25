import { AIProvider, AIProviderType, AIProviderConfig, ChatMessage, StreamCallbacks } from '@shared/types/ai';
export interface ProviderRegistry {
    claude?: AIProviderConfig;
    openai?: AIProviderConfig;
    gemini?: AIProviderConfig;
    deepseek?: AIProviderConfig;
}
export declare class AIRouter {
    private providers;
    private defaultProvider;
    constructor(registry: ProviderRegistry);
    private initializeProviders;
    setDefaultProvider(provider: AIProviderType): void;
    getProvider(type?: AIProviderType): AIProvider | undefined;
    getAvailableProviders(): AIProviderType[];
    chat(messages: ChatMessage[], provider?: AIProviderType): Promise<string>;
    chatStream(messages: ChatMessage[], callbacks: StreamCallbacks, provider?: AIProviderType): Promise<void>;
}
//# sourceMappingURL=router.d.ts.map