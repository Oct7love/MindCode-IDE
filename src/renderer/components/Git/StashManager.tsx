/**
 * StashManager - Git Stash 管理
 * 暂存列表、应用、删除、查看
 */

import React, { useState, useEffect, useCallback } from 'react';

export interface Stash { index: number; name: string; branch: string; message: string; }

interface StashManagerProps { onGitCommand?: (cmd: string) => Promise<string>; onRefresh?: () => void; }

export const StashManager: React.FC<StashManagerProps> = ({ onGitCommand, onRefresh }) => {
  const [stashes, setStashes] = useState<Stash[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载 stash 列表
  const loadStashes = useCallback(async () => {
    if (!onGitCommand) return;
    setLoading(true);
    try {
      const result = await onGitCommand('git stash list');
      const lines = result.split('\n').filter(l => l.trim());
      const parsed: Stash[] = lines.map((line, idx) => {
        const match = line.match(/stash@\{(\d+)\}: On (\S+): (.+)/);
        if (match) return { index: parseInt(match[1]), name: `stash@{${match[1]}}`, branch: match[2], message: match[3] };
        const match2 = line.match(/stash@\{(\d+)\}: (.+)/);
        if (match2) return { index: parseInt(match2[1]), name: `stash@{${match2[1]}}`, branch: '', message: match2[2] };
        return { index: idx, name: `stash@{${idx}}`, branch: '', message: line };
      });
      setStashes(parsed);
    } catch { setStashes([]); }
    setLoading(false);
  }, [onGitCommand]);

  useEffect(() => { loadStashes(); }, [loadStashes]);

  // 创建 stash
  const createStash = async () => {
    if (!onGitCommand) return;
    setError(null);
    try {
      const cmd = message.trim() ? `git stash push -m "${message.trim()}"` : 'git stash';
      await onGitCommand(cmd);
      setMessage('');
      setShowCreate(false);
      await loadStashes();
      onRefresh?.();
    } catch (err: any) { setError(err.message); }
  };

  // 应用 stash
  const applyStash = async (stash: Stash, pop = false) => {
    if (!onGitCommand) return;
    setError(null);
    try {
      await onGitCommand(`git stash ${pop ? 'pop' : 'apply'} ${stash.name}`);
      await loadStashes();
      onRefresh?.();
    } catch (err: any) { setError(err.message); }
  };

  // 删除 stash
  const dropStash = async (stash: Stash) => {
    if (!onGitCommand) return;
    if (!confirm(`确定删除 ${stash.name}？`)) return;
    setError(null);
    try {
      await onGitCommand(`git stash drop ${stash.name}`);
      await loadStashes();
    } catch (err: any) { setError(err.message); }
  };

  // 查看 stash 详情
  const viewDetail = async (stash: Stash) => {
    if (!onGitCommand) return;
    setSelected(stash.index);
    try {
      const result = await onGitCommand(`git stash show -p ${stash.name}`);
      setDetail(result);
    } catch { setDetail('无法加载详情'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 工具栏 */}
      <div style={{ padding: 8, borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 4 }}>
        <button onClick={() => setShowCreate(!showCreate)} style={{ flex: 1, padding: '6px', background: 'var(--color-accent-primary)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>+ 暂存更改</button>
        <button onClick={loadStashes} disabled={loading} style={{ padding: '6px 10px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 11, color: 'inherit' }}>↻</button>
      </div>

      {/* 创建 stash */}
      {showCreate && (
        <div style={{ padding: 8, borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-base)', display: 'flex', gap: 4 }}>
          <input type="text" value={message} onChange={e => setMessage(e.target.value)} placeholder="暂存消息（可选）..." style={{ flex: 1, padding: '6px 8px', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 11, color: 'inherit' }} onKeyDown={e => e.key === 'Enter' && createStash()} />
          <button onClick={createStash} style={{ padding: '6px 10px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>暂存</button>
        </div>
      )}

      {/* 错误提示 */}
      {error && <div style={{ padding: 8, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: 11 }}>{error}</div>}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Stash 列表 */}
        <div style={{ width: selected !== null ? '50%' : '100%', overflow: 'auto', borderRight: selected !== null ? '1px solid var(--color-border)' : 'none' }}>
          {loading ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>加载中...</div>
          ) : stashes.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>📦</div>
              <div style={{ fontSize: 12 }}>暂无暂存</div>
            </div>
          ) : (
            stashes.map(stash => (
              <div key={stash.index} onClick={() => viewDetail(stash)} style={{ padding: '12px', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', background: selected === stash.index ? 'var(--color-bg-hover)' : 'transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <code style={{ fontSize: 10, color: 'var(--color-accent-primary)', background: 'var(--color-bg-base)', padding: '1px 4px', borderRadius: 3 }}>{stash.name}</code>
                  {stash.branch && <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>on {stash.branch}</span>}
                </div>
                <div style={{ fontSize: 12, marginBottom: 8 }}>{stash.message}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={e => { e.stopPropagation(); applyStash(stash, true); }} style={{ padding: '4px 8px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 10 }}>弹出</button>
                  <button onClick={e => { e.stopPropagation(); applyStash(stash, false); }} style={{ padding: '4px 8px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', fontSize: 10, color: 'inherit' }}>应用</button>
                  <button onClick={e => { e.stopPropagation(); dropStash(stash); }} style={{ padding: '4px 8px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', fontSize: 10, color: '#ef4444' }}>删除</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 详情 */}
        {selected !== null && detail && (
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 500 }}>差异详情</span>
              <button onClick={() => { setSelected(null); setDetail(null); }} style={{ padding: '2px 6px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', fontSize: 10, color: 'inherit' }}>✕</button>
            </div>
            <pre style={{ margin: 0, fontSize: 10, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--color-bg-base)', padding: 8, borderRadius: 4 }}>{detail}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default StashManager;
