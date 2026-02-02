/**
 * BranchManager - Git 分支管理器
 * 可视化分支、创建、切换、合并、删除
 */

import React, { useState, useEffect, useCallback } from 'react';

export interface Branch { name: string; current: boolean; remote?: boolean; ahead?: number; behind?: number; lastCommit?: string; }

interface BranchManagerProps { onGitCommand?: (cmd: string) => Promise<string>; onRefresh?: () => void; }

export const BranchManager: React.FC<BranchManagerProps> = ({ onGitCommand, onRefresh }) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 加载分支
  const loadBranches = useCallback(async () => {
    if (!onGitCommand) return;
    setLoading(true);
    setError(null);
    try {
      const result = await onGitCommand('git branch -a -v');
      const lines = result.split('\n').filter(l => l.trim());
      const parsed: Branch[] = lines.map(line => {
        const current = line.startsWith('*');
        const cleaned = line.replace(/^\*?\s+/, '');
        const parts = cleaned.split(/\s+/);
        const name = parts[0].replace('remotes/', '');
        const remote = parts[0].startsWith('remotes/');
        const lastCommit = parts.slice(2).join(' ').slice(0, 50);
        return { name, current, remote, lastCommit };
      });
      setBranches(parsed);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [onGitCommand]);

  useEffect(() => { loadBranches(); }, [loadBranches]);

  // 切换分支
  const checkout = async (branch: Branch) => {
    if (!onGitCommand || branch.current) return;
    try {
      await onGitCommand(`git checkout ${branch.name.replace('origin/', '')}`);
      await loadBranches();
      onRefresh?.();
    } catch (err: any) { setError(err.message); }
  };

  // 创建分支
  const createBranch = async () => {
    if (!onGitCommand || !newBranchName.trim()) return;
    try {
      await onGitCommand(`git checkout -b ${newBranchName.trim()}`);
      setNewBranchName('');
      setShowCreate(false);
      await loadBranches();
      onRefresh?.();
    } catch (err: any) { setError(err.message); }
  };

  // 删除分支
  const deleteBranch = async (branch: Branch) => {
    if (!onGitCommand || branch.current) return;
    if (!confirm(`确定删除分支 ${branch.name}？`)) return;
    try {
      await onGitCommand(`git branch -d ${branch.name}`);
      await loadBranches();
    } catch (err: any) { setError(err.message); }
  };

  // 合并分支
  const mergeBranch = async (branch: Branch) => {
    if (!onGitCommand || branch.current) return;
    try {
      await onGitCommand(`git merge ${branch.name}`);
      await loadBranches();
      onRefresh?.();
    } catch (err: any) { setError(err.message); }
  };

  // 过滤
  const filtered = branches.filter(b => !filter || b.name.toLowerCase().includes(filter.toLowerCase()));
  const localBranches = filtered.filter(b => !b.remote);
  const remoteBranches = filtered.filter(b => b.remote);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 工具栏 */}
      <div style={{ padding: 8, borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 4 }}>
        <input type="text" value={filter} onChange={e => setFilter(e.target.value)} placeholder="筛选分支..." style={{ flex: 1, padding: '6px 8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 11, color: 'inherit' }} />
        <button onClick={() => setShowCreate(!showCreate)} style={{ padding: '6px 10px', background: 'var(--color-accent-primary)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>+ 新建</button>
        <button onClick={loadBranches} disabled={loading} style={{ padding: '6px 10px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 11, color: 'inherit' }}>↻</button>
      </div>

      {/* 创建分支 */}
      {showCreate && (
        <div style={{ padding: 8, borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-base)', display: 'flex', gap: 4 }}>
          <input type="text" value={newBranchName} onChange={e => setNewBranchName(e.target.value)} placeholder="分支名称..." autoFocus style={{ flex: 1, padding: '6px 8px', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 11, color: 'inherit' }} onKeyDown={e => e.key === 'Enter' && createBranch()} />
          <button onClick={createBranch} style={{ padding: '6px 10px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>创建</button>
        </div>
      )}

      {/* 错误提示 */}
      {error && <div style={{ padding: 8, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: 11 }}>{error}</div>}

      {/* 分支列表 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>加载中...</div>
        ) : (
          <>
            {/* 本地分支 */}
            <div style={{ padding: '6px 12px', background: 'var(--color-bg-base)', fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 500 }}>本地分支 ({localBranches.length})</div>
            {localBranches.map(branch => (
              <div key={branch.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--color-border)', background: branch.current ? 'var(--color-bg-hover)' : 'transparent' }}>
                <span style={{ color: branch.current ? '#22c55e' : 'var(--color-text-muted)', fontSize: 12 }}>{branch.current ? '●' : '○'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: branch.current ? 500 : 400 }}>{branch.name}</div>
                  {branch.lastCommit && <div style={{ fontSize: 10, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{branch.lastCommit}</div>}
                </div>
                {!branch.current && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => checkout(branch)} title="切换" style={{ padding: '2px 6px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', fontSize: 10, color: 'inherit' }}>⎘</button>
                    <button onClick={() => mergeBranch(branch)} title="合并到当前分支" style={{ padding: '2px 6px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', fontSize: 10, color: 'inherit' }}>⤵</button>
                    <button onClick={() => deleteBranch(branch)} title="删除" style={{ padding: '2px 6px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', fontSize: 10, color: '#ef4444' }}>✕</button>
                  </div>
                )}
              </div>
            ))}

            {/* 远程分支 */}
            {remoteBranches.length > 0 && (
              <>
                <div style={{ padding: '6px 12px', background: 'var(--color-bg-base)', fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 500, marginTop: 8 }}>远程分支 ({remoteBranches.length})</div>
                {remoteBranches.map(branch => (
                  <div key={branch.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--color-border)', opacity: 0.7 }}>
                    <span style={{ color: '#3b82f6', fontSize: 12 }}>☁</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12 }}>{branch.name}</div>
                    </div>
                    <button onClick={() => checkout(branch)} title="检出" style={{ padding: '2px 6px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', fontSize: 10, color: 'inherit' }}>⎘</button>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BranchManager;
