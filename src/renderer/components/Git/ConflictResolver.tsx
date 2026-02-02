/**
 * ConflictResolver - 冲突解决器
 * 可视化合并冲突、选择解决方案
 */

import React, { useState, useMemo } from 'react';

export interface ConflictBlock { id: string; ours: string; theirs: string; base?: string; startLine: number; endLine: number; resolved?: 'ours' | 'theirs' | 'both' | 'custom'; customContent?: string; }

interface ConflictResolverProps { content: string; fileName: string; onResolve: (resolvedContent: string) => void; onCancel: () => void; }

export const ConflictResolver: React.FC<ConflictResolverProps> = ({ content, fileName, onResolve, onCancel }) => {
  const [conflicts, setConflicts] = useState<ConflictBlock[]>(() => parseConflicts(content));
  const [activeConflict, setActiveConflict] = useState<string | null>(conflicts[0]?.id || null);

  // 解析冲突块
  function parseConflicts(text: string): ConflictBlock[] {
    const blocks: ConflictBlock[] = [];
    const lines = text.split('\n');
    let inConflict = false, ours = '', theirs = '', startLine = 0, id = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('<<<<<<<')) { inConflict = true; startLine = i + 1; ours = ''; theirs = ''; }
      else if (line.startsWith('=======') && inConflict) { /* switch to theirs */ }
      else if (line.startsWith('>>>>>>>') && inConflict) {
        blocks.push({ id: `conflict-${id++}`, ours: ours.trim(), theirs: theirs.trim(), startLine, endLine: i + 1 });
        inConflict = false;
      } else if (inConflict) {
        if (!lines.slice(startLine - 1, i).some(l => l.startsWith('======='))) ours += line + '\n';
        else theirs += line + '\n';
      }
    }
    return blocks;
  }

  // 选择解决方案
  const resolveConflict = (id: string, resolution: ConflictBlock['resolved'], customContent?: string) => {
    setConflicts(prev => prev.map(c => c.id === id ? { ...c, resolved: resolution, customContent } : c));
  };

  // 检查是否全部解决
  const allResolved = conflicts.every(c => c.resolved);

  // 生成解决后的内容
  const generateResolved = useMemo(() => {
    let result = content;
    // 从后往前替换，避免行号偏移
    const sorted = [...conflicts].sort((a, b) => b.startLine - a.startLine);
    for (const conflict of sorted) {
      if (!conflict.resolved) continue;
      let replacement = '';
      switch (conflict.resolved) {
        case 'ours': replacement = conflict.ours; break;
        case 'theirs': replacement = conflict.theirs; break;
        case 'both': replacement = conflict.ours + '\n' + conflict.theirs; break;
        case 'custom': replacement = conflict.customContent || ''; break;
      }
      // 找到冲突标记并替换
      const pattern = new RegExp(`<<<<<<<[^\\n]*\\n[\\s\\S]*?>>>>>>>[^\\n]*\\n?`);
      result = result.replace(pattern, replacement + '\n');
    }
    return result;
  }, [content, conflicts]);

  // 当前冲突
  const current = conflicts.find(c => c.id === activeConflict);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ width: '90vw', maxWidth: 1200, height: '80vh', background: 'var(--color-bg-elevated)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>⚔️ 解决冲突</h2>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{fileName} · {conflicts.length} 个冲突</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onCancel} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: 'inherit' }}>取消</button>
            <button onClick={() => onResolve(generateResolved)} disabled={!allResolved} style={{ padding: '8px 16px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, opacity: allResolved ? 1 : 0.5 }}>完成解决</button>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* 冲突列表 */}
          <div style={{ width: 200, borderRight: '1px solid var(--color-border)', overflow: 'auto' }}>
            {conflicts.map((conflict, idx) => (
              <div key={conflict.id} onClick={() => setActiveConflict(conflict.id)} style={{ padding: '12px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)', background: activeConflict === conflict.id ? 'var(--color-bg-hover)' : 'transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: conflict.resolved ? '#22c55e' : '#f59e0b' }}>{conflict.resolved ? '✓' : '!'}</span>
                  <span style={{ fontSize: 12 }}>冲突 #{idx + 1}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>行 {conflict.startLine}-{conflict.endLine}</div>
              </div>
            ))}
          </div>

          {/* 冲突详情 */}
          {current && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* 操作按钮 */}
              <div style={{ padding: 12, borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => resolveConflict(current.id, 'ours')} style={{ padding: '8px 16px', background: current.resolved === 'ours' ? '#3b82f6' : 'var(--color-bg-base)', color: current.resolved === 'ours' ? '#fff' : 'inherit', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>接受当前 (Ours)</button>
                <button onClick={() => resolveConflict(current.id, 'theirs')} style={{ padding: '8px 16px', background: current.resolved === 'theirs' ? '#22c55e' : 'var(--color-bg-base)', color: current.resolved === 'theirs' ? '#fff' : 'inherit', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>接受传入 (Theirs)</button>
                <button onClick={() => resolveConflict(current.id, 'both')} style={{ padding: '8px 16px', background: current.resolved === 'both' ? '#f59e0b' : 'var(--color-bg-base)', color: current.resolved === 'both' ? '#fff' : 'inherit', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>保留两者</button>
              </div>

              {/* 对比视图 */}
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Ours */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--color-border)' }}>
                  <div style={{ padding: '8px 12px', background: 'rgba(59, 130, 246, 0.1)', fontSize: 11, color: '#3b82f6', fontWeight: 500 }}>当前更改 (Ours)</div>
                  <pre style={{ flex: 1, margin: 0, padding: 12, overflow: 'auto', fontSize: 11, fontFamily: 'monospace', background: 'var(--color-bg-base)' }}>{current.ours}</pre>
                </div>
                {/* Theirs */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '8px 12px', background: 'rgba(34, 197, 94, 0.1)', fontSize: 11, color: '#22c55e', fontWeight: 500 }}>传入更改 (Theirs)</div>
                  <pre style={{ flex: 1, margin: 0, padding: 12, overflow: 'auto', fontSize: 11, fontFamily: 'monospace', background: 'var(--color-bg-base)' }}>{current.theirs}</pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConflictResolver;
