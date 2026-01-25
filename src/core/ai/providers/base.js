"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAIProvider = void 0;
class BaseAIProvider {
    config;
    constructor(config) {
        this.config = config;
    }
    countTokens(text) {
        // 简单估算：平均 4 字符 = 1 token（英文），中文约 1.5 字符 = 1 token
        const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
        const otherChars = text.length - chineseChars;
        return Math.ceil(chineseChars / 1.5 + otherChars / 4);
    }
    getModel() {
        return this.config.model || this.models[0].id;
    }
    getMaxTokens() {
        return this.config.maxTokens || 4096;
    }
    getTemperature() {
        return this.config.temperature ?? 0.7;
    }
}
exports.BaseAIProvider = BaseAIProvider;
//# sourceMappingURL=base.js.map