/**
 * EnvManager - 环境变量管理器
 * .env 文件编辑、变量管理
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';

export interface EnvVariable { key: string; value: string; source: string; isSecret?: boolean; }

interface EnvManagerProps { workspacePath?: string; onReadFile?: (path: string) => Promise<string>; onWriteFile?: (path: string, content: string) => Promise<void>; }

export const EnvManager: React.FC<EnvManagerProps> = ({ workspacePath, onReadFile, onWriteFile }) => {
  const [variables, setVariables] = useState<EnvVariable[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<{ key: string; value: string } | null>(null);
  const [newVar, setNewVar] = useState<{ key: string; value: string } | null>(null);
  const [filter, setFilter] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);

  // 敏感关键词
  const SENSITIVE_KEYS = ['SECRET', 'KEY', 'TOKEN', 'PASSWORD', 'PASS', 'PWD', 'CREDENTIAL', 'AUTH', 'PRIVATE'];

  // 加载环境变量
  const loadEnv = useCallback(async () => {
    if (!onReadFile || !workspacePath) return;
    setLoading(true);
    const envFiles = ['.env', '.env.local', '.env.development', '.env.production'];
    const allVars: EnvVariable[] = [];

    for (const file of envFiles) {
      try {
        const content = await onReadFile(`${workspacePath}/${file}`);
        const parsed = parseEnv(content);
        for (const [key, value] of Object.entries(parsed)) {
          const isSecret = SENSITIVE_KEYS.some(s => key.toUpperCase().includes(s));
          allVars.push({ key, value, source: file, isSecret });
        }
      } catch { /* file not found */ }
    }
    setVariables(allVars);
    setLoading(false);
  }, [onReadFile, workspacePath]);

  useEffect(() => { loadEnv(); }, [loadEnv]);

  // 解析 .env 文件
  function parseEnv(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) result[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
    }
    return result;
  }

  // 保存变量
  const saveVariable = useCallback(async (key: string, value: string, source: string) => {
    if (!onReadFile || !onWriteFile || !workspacePath) return;
    try {
      let content = '';
      try { content = await onReadFile(`${workspacePath}/${source}`); } catch { /* new file */ }
      const lines = content.split('\n');
      let found = false;
      const newLines = lines.map(line => {
        if (line.trim().startsWith(`${key}=`)) { found = true; return `${key}=${value}`; }
        return line;
      });
      if (!found) newLines.push(`${key}=${value}`);
      await onWriteFile(`${workspacePath}/${source}`, newLines.join('\n'));
      await loadEnv();
      setEditing(null);
    } catch { /* error */ }
  }, [onReadFile, onWriteFile, workspacePath, loadEnv]);

  // 删除变量
  const deleteVariable = useCallback(async (variable: EnvVariable) => {
    if (!onReadFile || !onWriteFile || !workspacePath) return;
    if (!confirm(`确定删除 ${variable.key}？`)) return;
    try {
      const content = await onReadFile(`${workspacePath}/${variable.source}`);
      const lines = content.split('\n').filter(l => !l.trim().startsWith(`${variable.key}=`));
      await onWriteFile(`${workspacePath}/${variable.source}`, lines.join('\n'));
      await loadEnv();
    } catch { /* error */ }
  }, [onReadFile, onWriteFile, workspacePath, loadEnv]);

  // 添加新变量
  const addVariable = useCallback(async () => {
    if (!newVar?.key.trim()) return;
    await saveVariable(newVar.key.trim(), newVar.value, '.env');
    setNewVar(null);
  }, [newVar, saveVariable]);

  // 过滤
  const filtered = useMemo(() => {
    if (!filter) return variables;
    const lower = filter.toLowerCase();
    return variables.filter(v => v.key.toLowerCase().includes(lower) || v.value.toLowerCase().includes(lower));
  }, [variables, filter]);

  // 按文件分组
  const grouped = useMemo(() => {
    const groups: Record<string, EnvVariable[]> = {};
    for (const v of filtered) {
      if (!groups[v.source]) groups[v.source] = [];
      groups[v.source].push(v);
    }
    return groups;
  }, [filtered]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 工具栏 */}
      <div style={{ padding: 8, borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 4 }}>
        <input type="text" value={filter} onChange={e => setFilter(e.target.value)} placeholder="搜索变量..." style={{ flex: 1, padding: '6px 8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 11, color: 'inherit' }} />
        <button onClick={() => setNewVar({ key: '', value: '' })} style={{ padding: '6px 10px', background: 'var(--color-accent-primary)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>+ 添加</button>
        <button onClick={() => setShowSecrets(!showSecrets)} title={showSecrets ? '隐藏敏感值' : '显示敏感值'} style={{ padding: '6px 10px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 11, color: 'inherit' }}>{showSecrets ? '🔓' : '🔒'}</button>
        <button onClick={loadEnv} disabled={loading} style={{ padding: '6px 10px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 11, color: 'inherit' }}>↻</button>
      </div>

      {/* 新建变量 */}
      {newVar && (
        <div style={{ padding: 8, borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-base)', display: 'flex', gap: 4 }}>
          <input type="text" value={newVar.key} onChange={e => setNewVar({ ...newVar, key: e.target.value })} placeholder="KEY" style={{ width: 120, padding: '6px 8px', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 11, color: 'inherit', fontFamily: 'monospace' }} />
          <input type="text" value={newVar.value} onChange={e => setNewVar({ ...newVar, value: e.target.value })} placeholder="value" style={{ flex: 1, padding: '6px 8px', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 11, color: 'inherit', fontFamily: 'monospace' }} />
          <button onClick={addVariable} style={{ padding: '6px 10px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>保存</button>
          <button onClick={() => setNewVar(null)} style={{ padding: '6px 10px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 11, color: 'inherit' }}>取消</button>
        </div>
      )}

      {/* 变量列表 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>加载中...</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🔐</div>
            <div style={{ fontSize: 12 }}>无环境变量</div>
          </div>
        ) : (
          Object.entries(grouped).map(([source, vars]) => (
            <div key={source}>
              <div style={{ padding: '6px 12px', background: 'var(--color-bg-base)', fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 500 }}>{source}</div>
              {vars.map(v => (
                <div key={`${v.source}-${v.key}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--color-border)' }}>
                  {editing?.key === v.key ? (
                    <>
                      <code style={{ width: 120, fontSize: 11, color: '#569cd6' }}>{v.key}</code>
                      <input type="text" value={editing.value} onChange={e => setEditing({ ...editing, value: e.target.value })} style={{ flex: 1, padding: '4px 6px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 3, fontSize: 11, color: 'inherit', fontFamily: 'monospace' }} autoFocus />
                      <button onClick={() => saveVariable(v.key, editing.value, v.source)} style={{ padding: '2px 8px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 10 }}>保存</button>
                      <button onClick={() => setEditing(null)} style={{ padding: '2px 8px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', fontSize: 10, color: 'inherit' }}>取消</button>
                    </>
                  ) : (
                    <>
                      <code style={{ width: 120, fontSize: 11, color: '#569cd6', flexShrink: 0 }}>{v.key}</code>
                      <span style={{ flex: 1, fontSize: 11, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.isSecret && !showSecrets ? '••••••••' : v.value}
                      </span>
                      {v.isSecret && <span style={{ color: '#f59e0b', fontSize: 10 }}>🔑</span>}
                      <button onClick={() => setEditing({ key: v.key, value: v.value })} style={{ padding: '2px 6px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', fontSize: 10, color: 'inherit' }}>✏️</button>
                      <button onClick={() => deleteVariable(v)} style={{ padding: '2px 6px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', fontSize: 10, color: '#ef4444' }}>✕</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default EnvManager;
