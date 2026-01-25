import { BaseAIProvider } from './base';
import { ChatMessage, StreamCallbacks, ModelInfo, AIProviderConfig } from '@shared/types/ai';
export declare class GeminiProvider extends BaseAIProvider {
    name: "gemini";
    displayName: string;
    models: ModelInfo[];
    private client;
    constructor(config: AIProviderConfig);
    chat(messages: ChatMessage[]): Promise<string>;
    chatStream(messages: ChatMessage[], callbacks: StreamCallbacks): Promise<void>;
}
//# sourceMappingURL=gemini.d.ts.map