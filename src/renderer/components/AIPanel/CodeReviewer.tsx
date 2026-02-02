/**
 * CodeReviewer - 代码审查助手
 * AI 驱动的代码质量分析
 */

import React, { useState, useCallback } from 'react';

export interface ReviewIssue { id: string; type: 'error' | 'warning' | 'info' | 'suggestion'; line?: number; message: string; code?: string; suggestion?: string; }
export interface ReviewResult { issues: ReviewIssue[]; summary: string; score: number; timestamp: number; }

interface CodeReviewerProps { code: string; language: string; fileName?: string; onReview?: (prompt: string) => Promise<string>; onNavigate?: (line: number) => void; }

const REVIEW_PROMPTS = {
  full: '请全面审查以下代码，包括：\n1. 代码质量和可读性\n2. 潜在的 bug 和错误\n3. 性能问题\n4. 安全隐患\n5. 最佳实践建议\n\n请以 JSON 格式返回结果：\n{"issues": [{"type": "error|warning|info|suggestion", "line": number, "message": "问题描述", "suggestion": "改进建议"}], "summary": "总结", "score": 0-100}',
  security: '请检查以下代码的安全问题，包括：注入攻击、XSS、敏感信息泄露、权限问题等。',
  performance: '请分析以下代码的性能问题，包括：时间复杂度、内存泄漏、不必要的计算、可优化点等。',
  style: '请检查代码风格和最佳实践，包括：命名规范、代码结构、注释质量、模块化等。',
};

export const CodeReviewer: React.FC<CodeReviewerProps> = ({ code, language, fileName, onReview, onNavigate }) => {
  const [reviewing, setReviewing] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [reviewType, setReviewType] = useState<keyof typeof REVIEW_PROMPTS>('full');
  const [error, setError] = useState<string | null>(null);

  // 执行审查
  const handleReview = useCallback(async () => {
    if (!onReview || !code) return;
    setReviewing(true);
    setError(null);
    
    try {
      const prompt = `${REVIEW_PROMPTS[reviewType]}\n\n文件: ${fileName || 'unknown'}\n语言: ${language}\n\n\`\`\`${language}\n${code}\n\`\`\``;
      const response = await onReview(prompt);
      
      // 尝试解析 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setResult({ ...parsed, timestamp: Date.now() });
      } else {
        // 如果没有 JSON，创建简单结果
        setResult({ issues: [{ id: '1', type: 'info', message: response }], summary: '审查完成', score: 75, timestamp: Date.now() });
      }
    } catch (err: any) {
      setError(err.message || '审查失败');
    } finally {
      setReviewing(false);
    }
  }, [code, language, fileName, onReview, reviewType]);

  // 问题类型图标和颜色
  const getIssueStyle = (type: ReviewIssue['type']) => {
    const styles = { error: { icon: '❌', color: '#ef4444' }, warning: { icon: '⚠️', color: '#f59e0b' }, info: { icon: 'ℹ️', color: '#3b82f6' }, suggestion: { icon: '💡', color: '#22c55e' } };
    return styles[type];
  };

  // 分数颜色
  const scoreColor = result ? (result.score >= 80 ? '#22c55e' : result.score >= 60 ? '#f59e0b' : '#ef4444') : 'inherit';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 工具栏 */}
      <div style={{ padding: 8, borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 4, alignItems: 'center' }}>
        <select value={reviewType} onChange={e => setReviewType(e.target.value as any)} style={{ flex: 1, padding: '6px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'inherit', fontSize: 11 }}>
          <option value="full">全面审查</option>
          <option value="security">安全检查</option>
          <option value="performance">性能分析</option>
          <option value="style">代码风格</option>
        </select>
        <button onClick={handleReview} disabled={reviewing || !code} style={{ padding: '6px 12px', background: 'var(--color-accent-primary)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, opacity: reviewing || !code ? 0.5 : 1 }}>
          {reviewing ? '分析中...' : '开始审查'}
        </button>
      </div>

      {/* 结果 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {error && (
          <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: 12 }}>错误: {error}</div>
        )}

        {result && (
          <>
            {/* 评分摘要 */}
            <div style={{ padding: 16, borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', border: `3px solid ${scoreColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 'bold', color: scoreColor }}>{result.score}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>代码质量评分</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{result.summary}</div>
              </div>
            </div>

            {/* 问题统计 */}
            <div style={{ padding: '8px 16px', background: 'var(--color-bg-base)', display: 'flex', gap: 16, fontSize: 11 }}>
              {['error', 'warning', 'info', 'suggestion'].map(type => {
                const count = result.issues.filter(i => i.type === type).length;
                const style = getIssueStyle(type as any);
                return <span key={type} style={{ color: style.color }}>{style.icon} {count}</span>;
              })}
            </div>

            {/* 问题列表 */}
            {result.issues.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>🎉 未发现问题</div>
            ) : (
              result.issues.map((issue, idx) => {
                const style = getIssueStyle(issue.type);
                return (
                  <div key={issue.id || idx} onClick={() => issue.line && onNavigate?.(issue.line)} style={{ padding: 12, borderBottom: '1px solid var(--color-border)', cursor: issue.line ? 'pointer' : 'default' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ color: style.color }}>{style.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, marginBottom: 4 }}>{issue.message}</div>
                        {issue.line && <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>第 {issue.line} 行</div>}
                        {issue.suggestion && (
                          <div style={{ marginTop: 8, padding: 8, background: 'var(--color-bg-base)', borderRadius: 4, fontSize: 11 }}>
                            <strong>建议:</strong> {issue.suggestion}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {!result && !error && !reviewing && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            <div style={{ fontSize: 13 }}>点击"开始审查"分析代码质量</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeReviewer;
