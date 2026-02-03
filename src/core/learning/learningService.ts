/**
 * 智能学习系统 - 记录用户习惯、项目术语、团队风格
 * 用于优化 AI 补全和建议
 */

// ==================== 类型定义 ====================

export interface CodingPattern { pattern: string; frequency: number; lastUsed: number; context: string; } // 编码模式
export interface ProjectTerm { term: string; definition?: string; frequency: number; files: string[]; } // 项目术语
export interface CodeStyle { rule: string; value: string; examples: string[]; } // 代码风格

export interface UserProfile {
  patterns: CodingPattern[]; // 常用编码模式
  terms: ProjectTerm[]; // 项目特定术语
  styles: CodeStyle[]; // 代码风格偏好
  completionAccepted: number; // 补全接受次数
  completionRejected: number; // 补全拒绝次数
  lastUpdated: number;
}

// ==================== 学习服务 ====================

class LearningService {
  private storageKey = 'mindcode-learning-profile';
  private profile: UserProfile = { patterns: [], terms: [], styles: [], completionAccepted: 0, completionRejected: 0, lastUpdated: Date.now() };
  private maxPatterns = 100;
  private maxTerms = 200;

  constructor() { this.load(); }

  /** 加载用户画像 */
  private load(): void {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) this.profile = { ...this.profile, ...JSON.parse(data) };
    } catch {}
  }

  /** 保存用户画像 */
  private save(): void {
    this.profile.lastUpdated = Date.now();
    try { localStorage.setItem(this.storageKey, JSON.stringify(this.profile)); } catch {}
  }

  /** 记录编码模式 */
  recordPattern(code: string, context: string): void {
    const pattern = this.extractPattern(code);
    if (!pattern || pattern.length < 5) return;
    const existing = this.profile.patterns.find(p => p.pattern === pattern);
    if (existing) { existing.frequency++; existing.lastUsed = Date.now(); }
    else {
      this.profile.patterns.push({ pattern, frequency: 1, lastUsed: Date.now(), context });
      if (this.profile.patterns.length > this.maxPatterns) {
        this.profile.patterns.sort((a, b) => b.frequency - a.frequency);
        this.profile.patterns = this.profile.patterns.slice(0, this.maxPatterns);
      }
    }
    this.save();
  }

  /** 提取模式（简化：取代码骨架） */
  private extractPattern(code: string): string {
    return code.replace(/['"`][^'"`]*['"`]/g, '""') // 字符串常量
      .replace(/\b\d+\b/g, 'N') // 数字常量
      .replace(/\s+/g, ' ').trim().slice(0, 100);
  }

  /** 记录项目术语 */
  recordTerm(term: string, file: string): void {
    if (!term || term.length < 2 || /^[a-z]$/.test(term)) return; // 忽略单字符
    const existing = this.profile.terms.find(t => t.term.toLowerCase() === term.toLowerCase());
    if (existing) { existing.frequency++; if (!existing.files.includes(file)) existing.files.push(file); }
    else {
      this.profile.terms.push({ term, frequency: 1, files: [file] });
      if (this.profile.terms.length > this.maxTerms) {
        this.profile.terms.sort((a, b) => b.frequency - a.frequency);
        this.profile.terms = this.profile.terms.slice(0, this.maxTerms);
      }
    }
    this.save();
  }

  /** 从代码中提取术语 */
  extractTermsFromCode(code: string, file: string): void {
    const identifiers = code.match(/\b[A-Z][a-zA-Z0-9]{2,}\b/g) || []; // PascalCase
    const camelCase = code.match(/\b[a-z][a-zA-Z0-9]{3,}\b/g) || []; // camelCase
    [...new Set([...identifiers, ...camelCase])].forEach(t => this.recordTerm(t, file));
  }

  /** 记录代码风格 */
  recordStyle(rule: string, value: string, example: string): void {
    const existing = this.profile.styles.find(s => s.rule === rule);
    if (existing) { existing.value = value; if (!existing.examples.includes(example)) existing.examples.push(example.slice(0, 100)); }
    else { this.profile.styles.push({ rule, value, examples: [example.slice(0, 100)] }); }
    this.save();
  }

  /** 记录补全接受 */
  recordCompletionAccepted(code: string, context: string): void {
    this.profile.completionAccepted++;
    this.recordPattern(code, context);
    this.save();
  }

  /** 记录补全拒绝 */
  recordCompletionRejected(): void { this.profile.completionRejected++; this.save(); }

  /** 获取用户画像 */
  getProfile(): UserProfile { return { ...this.profile }; }

  /** 获取补全接受率 */
  getAcceptanceRate(): number {
    const total = this.profile.completionAccepted + this.profile.completionRejected;
    return total > 0 ? this.profile.completionAccepted / total : 0;
  }

  /** 获取常用模式 (用于增强补全) */
  getTopPatterns(limit = 20): CodingPattern[] {
    return [...this.profile.patterns].sort((a, b) => b.frequency - a.frequency).slice(0, limit);
  }

  /** 获取项目术语 (用于增强补全) */
  getTopTerms(limit = 50): ProjectTerm[] {
    return [...this.profile.terms].sort((a, b) => b.frequency - a.frequency).slice(0, limit);
  }

  /** 生成 AI 系统提示补充（基于学习数据） */
  generatePromptEnhancement(): string {
    const terms = this.getTopTerms(30).map(t => t.term).join(', ');
    const patterns = this.getTopPatterns(10).map(p => p.pattern).join('\n');
    const styles = this.profile.styles.map(s => `${s.rule}: ${s.value}`).join('; ');
    if (!terms && !patterns && !styles) return '';
    return `
用户偏好：
${terms ? `- 项目术语: ${terms}` : ''}
${styles ? `- 代码风格: ${styles}` : ''}
请根据用户的编码习惯生成更符合其风格的代码。`;
  }

  /** 清除学习数据 */
  clear(): void {
    this.profile = { patterns: [], terms: [], styles: [], completionAccepted: 0, completionRejected: 0, lastUpdated: Date.now() };
    localStorage.removeItem(this.storageKey);
  }
}

export const learningService = new LearningService();
export default learningService;
