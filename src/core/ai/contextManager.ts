/**
 * Context Manager - AI 上下文管理
 */

export interface ContextItem { type: 'file' | 'selection' | 'symbol' | 'error' | 'terminal' | 'search' | 'custom'; content: string; path?: string; range?: { start: number; end: number }; priority: number; tokens?: number; }
export interface ContextWindow { items: ContextItem[]; totalTokens: number; maxTokens: number; }
export interface ContextStrategy { maxTokens: number; priorityWeights: Record<ContextItem['type'], number>; reservedForResponse: number; }

const DEFAULT_STRATEGY: ContextStrategy = { maxTokens: 100000, priorityWeights: { file: 1.0, selection: 1.5, symbol: 1.2, error: 1.3, terminal: 0.8, search: 0.9, custom: 1.0 }, reservedForResponse: 4000 };

class ContextManager {
  private items: ContextItem[] = [];
  private strategy: ContextStrategy = DEFAULT_STRATEGY;
  private tokenEstimator: (text: string) => number = text => Math.ceil(text.length / 4);

  setStrategy(strategy: Partial<ContextStrategy>): void { this.strategy = { ...this.strategy, ...strategy }; }
  setTokenEstimator(fn: (text: string) => number): void { this.tokenEstimator = fn; }

  addContext(item: Omit<ContextItem, 'tokens'>): void { this.items.push({ ...item, tokens: this.tokenEstimator(item.content) }); }
  addFile(path: string, content: string, priority = 1.0): void { this.addContext({ type: 'file', path, content, priority }); }
  addSelection(content: string, path?: string, range?: { start: number; end: number }): void { this.addContext({ type: 'selection', content, path, range, priority: 1.5 }); }
  addSymbol(name: string, content: string, path?: string): void { this.addContext({ type: 'symbol', content: `// ${name}\n${content}`, path, priority: 1.2 }); }
  addError(error: string, path?: string): void { this.addContext({ type: 'error', content: error, path, priority: 1.3 }); }
  addTerminal(output: string): void { this.addContext({ type: 'terminal', content: output, priority: 0.8 }); }
  addSearchResult(query: string, results: string): void { this.addContext({ type: 'search', content: `Search: ${query}\n${results}`, priority: 0.9 }); }
  addCustom(content: string, priority = 1.0): void { this.addContext({ type: 'custom', content, priority }); }

  clear(): void { this.items = []; }
  removeByType(type: ContextItem['type']): void { this.items = this.items.filter(i => i.type !== type); }
  removeByPath(path: string): void { this.items = this.items.filter(i => i.path !== path); }

  buildWindow(): ContextWindow {
    const maxAvailable = this.strategy.maxTokens - this.strategy.reservedForResponse;
    const scored = this.items.map(item => ({ item, score: item.priority * (this.strategy.priorityWeights[item.type] || 1.0) })).sort((a, b) => b.score - a.score);

    const selected: ContextItem[] = [];
    let totalTokens = 0;
    for (const { item } of scored) {
      const tokens = item.tokens || this.tokenEstimator(item.content);
      if (totalTokens + tokens <= maxAvailable) { selected.push(item); totalTokens += tokens; }
    }
    return { items: selected, totalTokens, maxTokens: this.strategy.maxTokens };
  }

  formatForPrompt(): string {
    const window = this.buildWindow();
    const sections: string[] = [];
    const groupedByType = window.items.reduce((acc, item) => { (acc[item.type] ||= []).push(item); return acc; }, {} as Record<string, ContextItem[]>);

    if (groupedByType.file) sections.push(`## 相关文件\n${groupedByType.file.map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')}`);
    if (groupedByType.selection) sections.push(`## 选中代码\n${groupedByType.selection.map(s => `\`\`\`\n${s.content}\n\`\`\``).join('\n')}`);
    if (groupedByType.symbol) sections.push(`## 相关符号\n${groupedByType.symbol.map(s => s.content).join('\n\n')}`);
    if (groupedByType.error) sections.push(`## 错误信息\n${groupedByType.error.map(e => `- ${e.content}`).join('\n')}`);
    if (groupedByType.terminal) sections.push(`## 终端输出\n\`\`\`\n${groupedByType.terminal.map(t => t.content).join('\n')}\n\`\`\``);
    if (groupedByType.search) sections.push(`## 搜索结果\n${groupedByType.search.map(s => s.content).join('\n')}`);
    if (groupedByType.custom) sections.push(`## 附加信息\n${groupedByType.custom.map(c => c.content).join('\n')}`);

    return sections.join('\n\n');
  }

  getStats(): { itemCount: number; totalTokens: number; byType: Record<string, number> } {
    const window = this.buildWindow();
    const byType = window.items.reduce((acc, item) => { acc[item.type] = (acc[item.type] || 0) + (item.tokens || 0); return acc; }, {} as Record<string, number>);
    return { itemCount: window.items.length, totalTokens: window.totalTokens, byType };
  }
}

export const contextManager = new ContextManager();
export default contextManager;
