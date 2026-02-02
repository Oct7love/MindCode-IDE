/**
 * CommitHistory - Git 提交历史
 * 图形化 Log、查看提交详情
 */

import React, { useState, useEffect, useCallback } from 'react';

export interface Commit { hash: string; shortHash: string; message: string; author: string; date: string; branch?: string; }

interface CommitHistoryProps { onGitCommand?: (cmd: string) => Promise<string>; onSelectCommit?: (commit: Commit) => void; maxCount?: number; }

export const CommitHistory: React.FC<CommitHistoryProps> = ({ onGitCommand, onSelectCommit, maxCount = 50 }) => {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  // 加载提交历史
  const loadCommits = useCallback(async () => {
    if (!onGitCommand) return;
    setLoading(true);
    try {
      const result = await onGitCommand(`git log --oneline --decorate -n ${maxCount} --format="%H|%h|%s|%an|%ar|%D"`);
      const lines = result.split('\n').filter(l => l.trim());
      const parsed: Commit[] = lines.map(line => {
        const [hash, shortHash, message, author, date, refs] = line.split('|');
        const branch = refs?.match(/HEAD -> (\S+)/)?.[1] || refs?.match(/(\S+)/)?.[1];
        return { hash, shortHash, message, author, date, branch };
      });
      setCommits(parsed);
    } catch { /* ignore */ }
    setLoading(false);
  }, [onGitCommand, maxCount]);

  useEffect(() => { loadCommits(); }, [loadCommits]);

  // 查看提交详情
  const viewDetail = async (commit: Commit) => {
    if (!onGitCommand) return;
    setSelected(commit.hash);
    onSelectCommit?.(commit);
    try {
      const result = await onGitCommand(`git show ${commit.hash} --stat`);
      setDetail(result);
    } catch { setDetail('无法加载详情'); }
  };

  // 复制哈希
  const copyHash = (hash: string) => { navigator.clipboard.writeText(hash); };

  // 过滤
  const filtered = commits.filter(c => !filter || c.message.toLowerCase().includes(filter.toLowerCase()) || c.author.toLowerCase().includes(filter.toLowerCase()) || c.shortHash.includes(filter));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 工具栏 */}
      <div style={{ padding: 8, borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 4 }}>
        <input type="text" value={filter} onChange={e => setFilter(e.target.value)} placeholder="搜索提交..." style={{ flex: 1, padding: '6px 8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 11, color: 'inherit' }} />
        <button onClick={loadCommits} disabled={loading} style={{ padding: '6px 10px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 11, color: 'inherit' }}>↻</button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 提交列表 */}
        <div style={{ width: selected ? '50%' : '100%', overflow: 'auto', borderRight: selected ? '1px solid var(--color-border)' : 'none' }}>
          {loading ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>加载中...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>无提交记录</div>
          ) : (
            filtered.map((commit, idx) => (
              <div key={commit.hash} onClick={() => viewDetail(commit)} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)', background: selected === commit.hash ? 'var(--color-bg-hover)' : 'transparent' }}>
                {/* 图形线 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: idx === 0 ? '#22c55e' : 'var(--color-accent-primary)' }} />
                  {idx < filtered.length - 1 && <div style={{ width: 2, height: 24, background: 'var(--color-border)' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <code style={{ fontSize: 10, color: 'var(--color-accent-primary)', background: 'var(--color-bg-base)', padding: '1px 4px', borderRadius: 3 }}>{commit.shortHash}</code>
                    {commit.branch && <span style={{ fontSize: 9, color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)', padding: '1px 4px', borderRadius: 3 }}>{commit.branch}</span>}
                  </div>
                  <div style={{ fontSize: 12, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{commit.message}</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{commit.author} · {commit.date}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 详情面板 */}
        {selected && detail && (
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 500 }}>提交详情</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => copyHash(selected)} title="复制哈希" style={{ padding: '2px 6px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', fontSize: 10, color: 'inherit' }}>📋</button>
                <button onClick={() => { setSelected(null); setDetail(null); }} style={{ padding: '2px 6px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', fontSize: 10, color: 'inherit' }}>✕</button>
              </div>
            </div>
            <pre style={{ margin: 0, fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--color-bg-base)', padding: 8, borderRadius: 4 }}>{detail}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommitHistory;
