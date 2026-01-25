import React, { useState } from 'react';
import { useAIStore } from '../../stores';
import './DebugView.css';

interface FixOption { id: string; title: string; description: string; diff?: string; }
interface DebugIssue { title: string; description: string; observations: string[]; hypotheses: { id: string; text: string }[]; verificationSteps: { id: string; text: string; completed: boolean }[]; fixOptions: FixOption[]; }

export const DebugView: React.FC = () => {
  const { debugInfo, setDebugInfo, model, addContext } = useAIStore();
  const [showLogs, setShowLogs] = useState(false);
  const [showStack, setShowStack] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [issue, setIssue] = useState<DebugIssue | null>(null);

  const analyzeError = async (errorText: string) => { // AI 分析错误
    setIsAnalyzing(true);
    const prompt = `分析以下错误并提供调试建议，返回 JSON 格式:
{ "title": "错误标题", "description": "错误描述", "observations": ["观察1"], "hypotheses": [{"id":"1","text":"假设1"}], "verificationSteps": [{"id":"1","text":"验证步骤","completed":false}], "fixOptions": [{"id":"1","title":"修复标题","description":"描述","diff":"代码差异"}] }

错误内容:
${errorText}`;
    if (window.mindcode?.ai?.chat) {
      try {
        const res = await window.mindcode.ai.chat(model, [{ role: 'user', content: prompt }]);
        const jsonMatch = res.data?.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setIssue(parsed);
          setDebugInfo({ title: parsed.title, description: parsed.description, observations: parsed.observations });
        }
      } catch (e) { console.error('Debug analysis error:', e); }
    }
    setIsAnalyzing(false);
  };

  const applyFix = async (fix: FixOption) => { // 应用修复
    if (fix.diff) navigator.clipboard.writeText(fix.diff.replace(/^[-+]\s*/gm, ''));
    // TODO: 实际应用到编辑器
  };

  const captureFromTerminal = () => { // 从终端捕获错误
    addContext({ id: `error-${Date.now()}`, type: 'error', label: '终端错误', data: { content: debugInfo?.description || '' } });
  };

  if (!issue && !debugInfo) {
    return (
      <div className="ai-empty-state">
        <div className="ai-empty-state-icon"><svg viewBox="0 0 48 48" fill="currentColor"><path d="M24 4C12.96 4 4 12.96 4 24s8.96 20 20 20 20-8.96 20-20S35.04 4 24 4zm2 30h-4v-4h4v4zm0-8h-4V14h4v12z"/></svg></div>
        <div className="ai-empty-state-text">{isAnalyzing ? '正在分析错误...' : '没有检测到错误'}</div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="ai-plan-btn" onClick={captureFromTerminal}>从终端捕获</button>
          <button className="ai-plan-btn primary" onClick={() => analyzeError('示例错误: TypeError')} disabled={isAnalyzing}>手动输入错误</button>
        </div>
      </div>
    );
  }

  const displayIssue = issue || { title: debugInfo?.title || '', description: debugInfo?.description || '', observations: debugInfo?.observations || [], hypotheses: [], verificationSteps: [], fixOptions: [] };

  return (
    <div className="ai-debug-view">
      <div className="ai-debug-issue-card">
        <div className="ai-debug-issue-title">🐛 {displayIssue.title}</div>
        <div className="ai-debug-issue-description">{displayIssue.description}</div>
      </div>

      {displayIssue.observations.length > 0 && (
        <div className="ai-debug-section">
          <div className="ai-debug-section-title">📊 观察</div>
          <div className="ai-debug-section-content"><ul style={{ margin: 0, paddingLeft: '20px' }}>{displayIssue.observations.map((obs, i) => <li key={i}>{obs}</li>)}</ul></div>
        </div>
      )}

      {displayIssue.hypotheses.length > 0 && (
        <div className="ai-debug-section">
          <div className="ai-debug-section-title">💡 假设</div>
          <div className="ai-debug-section-content">{displayIssue.hypotheses.map(h => <div key={h.id} style={{ marginBottom: 'var(--space-2)' }}><span style={{ color: 'var(--accent-primary)', marginRight: 'var(--space-2)' }}>[H{h.id}]</span>{h.text}</div>)}</div>
        </div>
      )}

      {displayIssue.verificationSteps.length > 0 && (
        <div className="ai-debug-section">
          <div className="ai-debug-section-title">🔍 验证步骤</div>
          <div className="ai-debug-section-content">{displayIssue.verificationSteps.map(step => <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}><input type="checkbox" checked={step.completed} onChange={() => setIssue(issue ? { ...issue, verificationSteps: issue.verificationSteps.map(s => s.id === step.id ? { ...s, completed: !s.completed } : s) } : null)} /><span>{step.text}</span></div>)}</div>
        </div>
      )}

      {displayIssue.fixOptions.length > 0 && (
        <div className="ai-debug-section">
          <div className="ai-debug-section-title">🔧 修复选项</div>
          {displayIssue.fixOptions.map(option => (
            <div key={option.id} className="ai-debug-fix-option">
              <div className="ai-debug-fix-option-title">{option.title}</div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>{option.description}</div>
              {option.diff && <pre style={{ background: 'rgba(0, 0, 0, 0.3)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-code)', marginBottom: 'var(--space-2)', overflow: 'auto' }}>{option.diff}</pre>}
              <div className="ai-debug-fix-actions">
                <button className="ai-debug-fix-btn" onClick={() => navigator.clipboard.writeText(option.diff || '')}>复制</button>
                <button className="ai-debug-fix-btn primary" onClick={() => applyFix(option)}>应用</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
        <button className="ai-debug-fix-btn" onClick={() => setShowLogs(!showLogs)}>{showLogs ? '隐藏' : '查看'}日志</button>
        <button className="ai-debug-fix-btn" onClick={() => setShowStack(!showStack)}>{showStack ? '隐藏' : '查看'}堆栈</button>
        <button className="ai-debug-fix-btn" onClick={() => { setIssue(null); setDebugInfo(null); }}>清除</button>
        <button className="ai-debug-fix-btn primary" onClick={() => analyzeError(displayIssue.description)} disabled={isAnalyzing}>重新分析</button>
      </div>

      {showLogs && (
        <div className="ai-debug-section" style={{ marginTop: 'var(--space-4)' }}>
          <div className="ai-debug-section-title">📋 日志</div>
          <pre style={{ background: 'rgba(0, 0, 0, 0.3)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-code)', maxHeight: '200px', overflow: 'auto' }}>{`[${new Date().toISOString()}] ERROR: ${displayIssue.title}\n${displayIssue.description}`}</pre>
        </div>
      )}
    </div>
  );
};
