// AI 代码审查服务 - 安全漏洞检测、性能问题识别、代码规范检查

// ==================== 类型定义 ====================
export type IssueSeverity = 'error' | 'warning' | 'info';
export type IssueCategory = 'security' | 'performance' | 'style' | 'best-practice' | 'bug';

export interface CodeIssue {
  id: string;
  file: string;
  line: number;
  column?: number;
  severity: IssueSeverity;
  category: IssueCategory;
  title: string;
  message: string;
  code?: string; // 问题代码片段
  fix?: { description: string; replacement: string }; // 修复建议
}

export interface ReviewResult {
  issues: CodeIssue[];
  summary: { total: number; errors: number; warnings: number; infos: number };
  reviewedFiles: string[];
  timestamp: number;
}

// ==================== 安全检测规则 ====================
const SECURITY_PATTERNS: { pattern: RegExp; title: string; message: string; severity: IssueSeverity }[] = [
  { pattern: /eval\s*\(/g, title: 'eval() 使用', message: '避免使用 eval()，可能导致代码注入攻击', severity: 'error' },
  { pattern: /innerHTML\s*=/g, title: 'innerHTML 赋值', message: '直接赋值 innerHTML 可能导致 XSS 攻击，建议使用 textContent 或 DOMPurify', severity: 'warning' },
  { pattern: /dangerouslySetInnerHTML/g, title: 'dangerouslySetInnerHTML', message: 'React 中使用 dangerouslySetInnerHTML 需确保内容已消毒', severity: 'warning' },
  { pattern: /password\s*[:=]\s*['"][^'"]+['"]/gi, title: '硬编码密码', message: '检测到硬编码密码，应使用环境变量或密钥管理服务', severity: 'error' },
  { pattern: /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi, title: '硬编码 API Key', message: '检测到硬编码 API Key，应使用环境变量', severity: 'error' },
  { pattern: /secret\s*[:=]\s*['"][^'"]+['"]/gi, title: '硬编码 Secret', message: '检测到硬编码密钥，应使用环境变量', severity: 'error' },
  { pattern: /exec\s*\(\s*['"`].*\$\{/g, title: '命令注入风险', message: '字符串插值用于 exec() 可能导致命令注入', severity: 'error' },
  { pattern: /SELECT\s+\*\s+FROM.*\+\s*\w+/gi, title: 'SQL 注入风险', message: '字符串拼接 SQL 查询可能导致 SQL 注入，使用参数化查询', severity: 'error' },
  { pattern: /new\s+Function\s*\(/g, title: 'Function 构造器', message: '使用 Function 构造器类似 eval()，存在安全风险', severity: 'warning' },
  { pattern: /document\.write/g, title: 'document.write', message: 'document.write 可能导致 XSS 和性能问题', severity: 'warning' },
];

// ==================== 性能检测规则 ====================
const PERFORMANCE_PATTERNS: { pattern: RegExp; title: string; message: string; severity: IssueSeverity }[] = [
  { pattern: /for\s*\([^)]*\.length[^)]*\)/g, title: '循环中重复计算 length', message: '将 .length 缓存到变量中以提高性能', severity: 'info' },
  { pattern: /JSON\.parse\(JSON\.stringify/g, title: '深拷贝使用 JSON', message: '使用 structuredClone() 或 lodash.cloneDeep 替代', severity: 'info' },
  { pattern: /\.\s*forEach\s*\([^)]*await/g, title: 'forEach 中使用 await', message: 'forEach 不会等待 async 回调，使用 for...of 或 Promise.all', severity: 'warning' },
  { pattern: /new\s+RegExp\s*\([^)]+\)/g, title: '循环内创建 RegExp', message: '如果模式不变，在循环外创建 RegExp 对象', severity: 'info' },
  { pattern: /console\.(log|debug|info)/g, title: '生产环境 console', message: '生产环境应移除或禁用 console 输出', severity: 'info' },
  { pattern: /setTimeout\s*\(\s*['"][^'"]*['"]/g, title: 'setTimeout 字符串参数', message: 'setTimeout 使用字符串参数类似 eval()，使用函数代替', severity: 'warning' },
];

// ==================== 代码风格规则 ====================
const STYLE_PATTERNS: { pattern: RegExp; title: string; message: string; severity: IssueSeverity }[] = [
  { pattern: /var\s+\w+/g, title: '使用 var', message: '推荐使用 const 或 let 替代 var', severity: 'info' },
  { pattern: /==(?!=)/g, title: '使用 == 比较', message: '推荐使用 === 进行严格相等比较', severity: 'info' },
  { pattern: /!=(?!=)/g, title: '使用 != 比较', message: '推荐使用 !== 进行严格不等比较', severity: 'info' },
  { pattern: /function\s*\([^)]*\)\s*\{[^}]{200,}/g, title: '函数过长', message: '函数超过 200 字符，考虑拆分为更小的函数', severity: 'info' },
  { pattern: /TODO|FIXME|HACK|XXX/g, title: '待办注释', message: '检测到 TODO/FIXME 注释，记得处理', severity: 'info' },
];

// ==================== 代码审查器 ====================
class CodeReviewService {
  // 审查单个文件
  reviewFile(filePath: string, content: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = content.split('\n');

    const checkPatterns = (patterns: typeof SECURITY_PATTERNS, category: IssueCategory) => {
      for (const { pattern, title, message, severity } of patterns) {
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;
        while ((match = regex.exec(content)) !== null) {
          const beforeMatch = content.slice(0, match.index);
          const line = beforeMatch.split('\n').length;
          const column = match.index - beforeMatch.lastIndexOf('\n');
          issues.push({
            id: `${filePath}:${line}:${column}:${title}`,
            file: filePath, line, column, severity, category, title, message,
            code: lines[line - 1]?.trim().slice(0, 100),
          });
        }
      }
    };

    checkPatterns(SECURITY_PATTERNS, 'security');
    checkPatterns(PERFORMANCE_PATTERNS, 'performance');
    checkPatterns(STYLE_PATTERNS, 'style');

    return issues;
  }

  // 审查多个文件
  reviewFiles(files: { path: string; content: string }[]): ReviewResult {
    const allIssues: CodeIssue[] = [];
    const reviewedFiles: string[] = [];

    for (const file of files) {
      reviewedFiles.push(file.path);
      allIssues.push(...this.reviewFile(file.path, file.content));
    }

    return {
      issues: allIssues,
      summary: {
        total: allIssues.length,
        errors: allIssues.filter(i => i.severity === 'error').length,
        warnings: allIssues.filter(i => i.severity === 'warning').length,
        infos: allIssues.filter(i => i.severity === 'info').length,
      },
      reviewedFiles,
      timestamp: Date.now(),
    };
  }

  // 获取修复建议 (调用 AI)
  async getFixSuggestion(issue: CodeIssue, context: string): Promise<string> {
    // TODO: 调用 AI 获取智能修复建议
    const fixes: Record<string, string> = {
      'eval() 使用': '使用 JSON.parse() 或安全的解析方法替代',
      'innerHTML 赋值': '使用 textContent 或 DOMPurify.sanitize(html)',
      '硬编码密码': '使用 process.env.PASSWORD 或密钥管理服务',
      '使用 var': '将 var 改为 const（不可变）或 let（可变）',
      '使用 == 比较': '将 == 改为 ===',
    };
    return fixes[issue.title] || '请手动检查并修复此问题';
  }
}

export const codeReviewService = new CodeReviewService();
export default codeReviewService;
