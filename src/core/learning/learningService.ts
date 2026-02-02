// 智能学习服务 - 收集用户编码习惯，个性化补全偏好

// ==================== 类型定义 ====================
export interface CodingPattern {
  id: string;
  pattern: string; // 代码模式 (如 "const ${name} = async () => {")
  frequency: number; // 使用频率
  context: string; // 使用场景 (如 "typescript", "react-component")
  lastUsed: number; // 最后使用时间
}

export interface TermEntry {
  term: string; // 术语
  type: 'variable' | 'function' | 'class' | 'type' | 'constant';
  frequency: number;
  files: string[]; // 出现的文件
}

export interface UserPreferences {
  indentStyle: 'spaces' | 'tabs';
  indentSize: number;
  quoteStyle: 'single' | 'double';
  semicolons: boolean;
  trailingComma: boolean;
  bracketSpacing: boolean;
  arrowParens: 'always' | 'avoid';
}

export interface LearningStats {
  totalPatterns: number;
  totalTerms: number;
  sessionsRecorded: number;
  lastUpdated: number;
}

// ==================== 智能学习服务 ====================
class LearningService {
  private patterns: Map<string, CodingPattern> = new Map();
  private terms: Map<string, TermEntry> = new Map();
  private preferences: UserPreferences = {
    indentStyle: 'spaces', indentSize: 2, quoteStyle: 'single', semicolons: true,
    trailingComma: true, bracketSpacing: true, arrowParens: 'avoid'
  };
  private sessionCount = 0;

  constructor() { this.load(); }

  // 记录代码输入模式
  recordPattern(code: string, context: string): void {
    const normalized = this.normalizePattern(code);
    const existing = this.patterns.get(normalized);
    if (existing) { existing.frequency++; existing.lastUsed = Date.now(); }
    else this.patterns.set(normalized, { id: normalized, pattern: code, frequency: 1, context, lastUsed: Date.now() });
    this.scheduleAutosave();
  }

  // 记录术语使用
  recordTerm(term: string, type: TermEntry['type'], file: string): void {
    const key = `${type}:${term}`;
    const existing = this.terms.get(key);
    if (existing) { existing.frequency++; if (!existing.files.includes(file)) existing.files.push(file); }
    else this.terms.set(key, { term, type, frequency: 1, files: [file] });
  }

  // 分析代码风格偏好
  analyzeStylePreferences(code: string): Partial<UserPreferences> {
    const prefs: Partial<UserPreferences> = {};
    if (/^\t/m.test(code)) prefs.indentStyle = 'tabs';
    else if (/^  /m.test(code)) { prefs.indentStyle = 'spaces'; prefs.indentSize = 2; }
    else if (/^    /m.test(code)) { prefs.indentStyle = 'spaces'; prefs.indentSize = 4; }
    if (/'[^']*'/g.test(code) && !/"[^"]*"/g.test(code)) prefs.quoteStyle = 'single';
    else if (/"[^"]*"/g.test(code)) prefs.quoteStyle = 'double';
    if (/;\s*$/m.test(code)) prefs.semicolons = true;
    else if (/[^;]\s*$/m.test(code)) prefs.semicolons = false;
    if (/,\s*\n\s*[}\]]/g.test(code)) prefs.trailingComma = true;
    return prefs;
  }

  // 更新偏好
  updatePreferences(prefs: Partial<UserPreferences>): void {
    Object.assign(this.preferences, prefs);
    this.save();
  }

  // 获取热门模式 (用于补全建议)
  getHotPatterns(context?: string, limit = 10): CodingPattern[] {
    let patterns = [...this.patterns.values()];
    if (context) patterns = patterns.filter(p => p.context === context);
    return patterns.sort((a, b) => {
      const scoreA = a.frequency * (1 + 1 / (Date.now() - a.lastUsed + 1));
      const scoreB = b.frequency * (1 + 1 / (Date.now() - b.lastUsed + 1));
      return scoreB - scoreA;
    }).slice(0, limit);
  }

  // 获取项目术语 (用于补全)
  getProjectTerms(type?: TermEntry['type'], limit = 20): TermEntry[] {
    let terms = [...this.terms.values()];
    if (type) terms = terms.filter(t => t.type === type);
    return terms.sort((a, b) => b.frequency - a.frequency).slice(0, limit);
  }

  // 获取当前偏好
  getPreferences(): UserPreferences { return { ...this.preferences }; }

  // 获取统计
  getStats(): LearningStats {
    return { totalPatterns: this.patterns.size, totalTerms: this.terms.size, sessionsRecorded: this.sessionCount, lastUpdated: Date.now() };
  }

  // 归一化模式 (移除具体变量名)
  private normalizePattern(code: string): string {
    return code.replace(/['"][^'"]*['"]/g, 'STR').replace(/\b\d+\b/g, 'NUM').replace(/\b[a-z][a-zA-Z0-9]*\b/g, 'VAR').slice(0, 100);
  }

  // 自动保存 (防抖)
  private saveTimeout: any = null;
  private scheduleAutosave(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.save(), 5000);
  }

  // 持久化
  private save(): void {
    try {
      const data = { patterns: [...this.patterns.values()], terms: [...this.terms.values()], preferences: this.preferences, sessionCount: this.sessionCount + 1 };
      localStorage.setItem('mindcode.learning', JSON.stringify(data));
    } catch { /* 忽略存储错误 */ }
  }

  private load(): void {
    try {
      const saved = localStorage.getItem('mindcode.learning');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.patterns) for (const p of data.patterns) this.patterns.set(p.id, p);
        if (data.terms) for (const t of data.terms) this.terms.set(`${t.type}:${t.term}`, t);
        if (data.preferences) Object.assign(this.preferences, data.preferences);
        if (data.sessionCount) this.sessionCount = data.sessionCount;
      }
    } catch { /* 忽略解析错误 */ }
  }

  // 清空学习数据
  clear(): void { this.patterns.clear(); this.terms.clear(); this.sessionCount = 0; localStorage.removeItem('mindcode.learning'); }
}

export const learningService = new LearningService();
export default learningService;
