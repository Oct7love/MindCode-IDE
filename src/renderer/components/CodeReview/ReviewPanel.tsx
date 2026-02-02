import React, { useState, useEffect, useCallback } from 'react';
import { codeReviewService, CodeIssue, ReviewResult } from '../../../core/review/codeReviewService';
import './ReviewPanel.css';

interface ReviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  files?: { path: string; content: string }[]; // 待审查文件
  onNavigateToIssue?: (file: string, line: number) => void; // 跳转到问题位置
}

// 严重程度图标
const SeverityIcon: React.FC<{ severity: 'error' | 'warning' | 'info' }> = ({ severity }) => {
  const icons = { error: '🔴', warning: '🟡', info: '🔵' };
  return <span className="severity-icon">{icons[severity]}</span>;
};

// 分类图标
const CategoryIcon: React.FC<{ category: string }> = ({ category }) => {
  const icons: Record<string, string> = { security: '🔒', performance: '⚡', style: '🎨', 'best-practice': '✅', bug: '🐛' };
  return <span className="category-icon">{icons[category] || '📋'}</span>;
};

export const ReviewPanel: React.FC<ReviewPanelProps> = ({ isOpen, onClose, files, onNavigateToIssue }) => {
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // 执行审查
  const runReview = useCallback(async () => {
    if (!files || files.length === 0) return;
    setIsReviewing(true);
    // 异步执行审查 (避免阻塞 UI)
    await new Promise(r => setTimeout(r, 100));
    const reviewResult = codeReviewService.reviewFiles(files);
    setResult(reviewResult);
    setIsReviewing(false);
  }, [files]);

  // 自动审查
  useEffect(() => { if (isOpen && files) runReview(); }, [isOpen, files, runReview]);

  // 过滤问题
  const filteredIssues = result?.issues.filter(issue => {
    if (filter !== 'all' && issue.severity !== filter) return false;
    if (categoryFilter !== 'all' && issue.category !== categoryFilter) return false;
    return true;
  }) || [];

  // 点击问题跳转
  const handleIssueClick = (issue: CodeIssue) => { onNavigateToIssue?.(issue.file, issue.line); };

  if (!isOpen) return null;

  return (
    <div className="review-panel-overlay" onClick={onClose}>
      <div className="review-panel" onClick={e => e.stopPropagation()}>
        <div className="review-header">
          <h2>🔍 代码审查</h2>
          <button className="review-close-btn" onClick={onClose}>×</button>
        </div>

        {/* 摘要 */}
        {result && (
          <div className="review-summary">
            <div className="summary-item error"><span className="count">{result.summary.errors}</span><span className="label">错误</span></div>
            <div className="summary-item warning"><span className="count">{result.summary.warnings}</span><span className="label">警告</span></div>
            <div className="summary-item info"><span className="count">{result.summary.infos}</span><span className="label">提示</span></div>
            <div className="summary-item total"><span className="count">{result.reviewedFiles.length}</span><span className="label">文件</span></div>
          </div>
        )}

        {/* 过滤器 */}
        <div className="review-filters">
          <select value={filter} onChange={e => setFilter(e.target.value as any)}>
            <option value="all">全部严重程度</option>
            <option value="error">🔴 错误</option>
            <option value="warning">🟡 警告</option>
            <option value="info">🔵 提示</option>
          </select>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="all">全部类别</option>
            <option value="security">🔒 安全</option>
            <option value="performance">⚡ 性能</option>
            <option value="style">🎨 风格</option>
            <option value="best-practice">✅ 最佳实践</option>
          </select>
          <button className="refresh-btn" onClick={runReview} disabled={isReviewing}>{isReviewing ? '审查中...' : '🔄 重新审查'}</button>
        </div>

        {/* 问题列表 */}
        <div className="review-issues">
          {isReviewing && <div className="review-loading">正在审查代码...</div>}
          {!isReviewing && filteredIssues.length === 0 && <div className="review-empty">✅ 没有发现问题</div>}
          {filteredIssues.map(issue => (
            <div key={issue.id} className={`issue-item ${issue.severity}`} onClick={() => handleIssueClick(issue)}>
              <div className="issue-header">
                <SeverityIcon severity={issue.severity} />
                <CategoryIcon category={issue.category} />
                <span className="issue-title">{issue.title}</span>
                <span className="issue-location">{issue.file.split('/').pop()}:{issue.line}</span>
              </div>
              <div className="issue-message">{issue.message}</div>
              {issue.code && <div className="issue-code"><code>{issue.code}</code></div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReviewPanel;
