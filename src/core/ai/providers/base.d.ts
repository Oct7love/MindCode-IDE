import { AIProvider, ChatMessage, StreamCallbacks, ModelInfo, AIProviderConfig } from '@shared/types/ai';
export declare abstract class BaseAIProvider implements AIProvider {
    abstract name: 'claude' | 'openai' | 'gemini' | 'deepseek';
    abstract displayName: string;
    abstract models: ModelInfo[];
    protected config: AIProviderConfig;
    constructor(config: AIProviderConfig);
    abstract chat(messages: ChatMessage[]): Promise<string>;
    abstract chatStream(messages: ChatMessage[], callbacks: StreamCallbacks): Promise<void>;
    countTokens(text: string): number;
    protected getModel(): string;
    protected getMaxTokens(): number;
    protected getTemperature(): number;
}
//# sourceMappingURL=base.d.ts.map