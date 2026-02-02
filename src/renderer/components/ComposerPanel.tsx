/**
 * ComposerPanel - 多文件重构 UI 组件
 * 显示任务列表、进度条、Diff 预览
 */

import React, { useState, useCallback, useMemo } from 'react';
import { getComposer, type ComposerPlan, type FileEdit } from '../../core/agent';

interface ComposerPanelProps { isOpen: boolean; onClose: () => void; workspacePath?: string; }

export const ComposerPanel: React.FC<ComposerPanelProps> = ({ isOpen, onClose, workspacePath }) => {
  const [input, setInput] = useState('');
  const [plan, setPlan] = useState<ComposerPlan | null>(null);
  const [progress, setProgress] = useState<{ step: string; current: number; total: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const composer = useMemo(() => {
    const c = getComposer();
    c.setProgressCallback(setProgress);
    return c;
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!input.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await composer.analyze(input, { workspacePath });
      setPlan(result);
      if (result.edits.length > 0) setSelectedFile(result.edits[0].path);
    } catch (err: any) { setError(err.message); }
    finally { setIsLoading(false); setProgress(null); }
  }, [input, workspacePath, composer]);

  const handleExecute = useCallback(async () => {
    if (!plan) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await composer.execute(plan);
      if (!result.success) setError(result.errors.join('\n'));
      else setPlan({ ...plan, status: 'completed' });
    } catch (err: any) { setError(err.message); }
    finally { setIsLoading(false); setProgress(null); }
  }, [plan, composer]);

  const handleRollback = useCallback(async () => {
    if (!plan) return;
    setIsLoading(true);
    const success = await composer.rollback(plan);
    if (success) setPlan({ ...plan, status: 'cancelled' });
    setIsLoading(false);
  }, [plan, composer]);

  const handleClear = useCallback(() => { composer.clear(); setPlan(null); setInput(''); setSelectedFile(null); setError(null); }, [composer]);

  const selectedEdit = useMemo(() => plan?.edits.find(e => e.path === selectedFile), [plan, selectedFile]);

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ width: '90vw', maxWidth: 1200, height: '80vh', background: 'var(--color-bg-elevated, #111)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--color-border, #333)' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border, #333)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>🔧 Composer - 多文件重构</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {/* Input */}
        <div style={{ padding: 16, borderBottom: '1px solid var(--color-border, #333)' }}>
          <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="描述你想要的重构... 例如：将所有 var 改为 const，重命名 getUserData 为 fetchUser" style={{ width: '100%', height: 60, background: 'var(--color-bg-base, #0a0a0c)', border: '1px solid var(--color-border)', borderRadius: 6, padding: 10, color: 'inherit', resize: 'none', fontSize: 13 }} disabled={isLoading} />
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button onClick={handleAnalyze} disabled={isLoading || !input.trim()} style={{ padding: '8px 16px', background: 'var(--color-accent-primary, #8b5cf6)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: isLoading ? 0.5 : 1 }}>
              {isLoading && progress ? `${progress.step}...` : '分析'}
            </button>
            {plan && plan.status === 'pending' && <button onClick={handleExecute} disabled={isLoading} style={{ padding: '8px 16px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>执行 ({plan.edits.length} 文件)</button>}
            {plan?.checkpoint && <button onClick={handleRollback} disabled={isLoading} style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>回滚</button>}
            {plan && <button onClick={handleClear} style={{ padding: '8px 16px', background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer' }}>清除</button>}
          </div>
        </div>

        {/* Progress */}
        {progress && (
          <div style={{ padding: '8px 16px', background: 'var(--color-bg-base)', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
              <span>{progress.step}</span>
              <div style={{ flex: 1, height: 4, background: 'var(--color-border)', borderRadius: 2 }}>
                <div style={{ width: `${(progress.current / progress.total) * 100}%`, height: '100%', background: 'var(--color-accent-primary)', borderRadius: 2, transition: 'width 0.2s' }} />
              </div>
              <span>{progress.current}/{progress.total}</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && <div style={{ padding: '8px 16px', background: '#fef2f2', color: '#dc2626', fontSize: 12, borderBottom: '1px solid #fecaca' }}>{error}</div>}

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* File List */}
          <div style={{ width: 250, borderRight: '1px solid var(--color-border)', overflow: 'auto' }}>
            {plan?.edits.map(edit => (
              <div key={edit.path} onClick={() => setSelectedFile(edit.path)} style={{ padding: '10px 12px', cursor: 'pointer', background: selectedFile === edit.path ? 'var(--color-bg-hover, #1f1f23)' : 'transparent', borderBottom: '1px solid var(--color-border, #222)' }}>
                <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{edit.path.split(/[/\\]/).pop()}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{edit.description || edit.path}</div>
              </div>
            ))}
            {(!plan || plan.edits.length === 0) && <div style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: 12, textAlign: 'center' }}>输入需求后点击"分析"</div>}
          </div>

          {/* Preview */}
          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            {selectedEdit ? (
              <div>
                <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>{selectedEdit.path}</h3>
                <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--color-text-muted)' }}>{selectedEdit.description}</p>
                <pre style={{ margin: 0, padding: 12, background: 'var(--color-bg-base)', borderRadius: 6, fontSize: 12, overflow: 'auto', maxHeight: 400, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{selectedEdit.newContent || '(空)'}</pre>
              </div>
            ) : <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>选择文件查看预览</div>}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--color-border)', fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between' }}>
          <span>状态: {plan?.status || '未开始'}</span>
          <span>{plan ? `${plan.edits.length} 个文件待修改` : ''}</span>
        </div>
      </div>
    </div>
  );
};

export default ComposerPanel;
