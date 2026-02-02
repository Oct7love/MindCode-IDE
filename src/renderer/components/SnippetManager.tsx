/**
 * SnippetManager - 代码片段管理器
 * 创建、编辑、删除自定义代码片段
 */

import React, { useState, useEffect, useCallback } from 'react';

export interface Snippet { id: string; name: string; prefix: string; body: string; description?: string; language?: string; }

const STORAGE_KEY = 'mindcode_snippets';

interface SnippetManagerProps { isOpen: boolean; onClose: () => void; onInsert?: (body: string) => void; }

export const SnippetManager: React.FC<SnippetManagerProps> = ({ isOpen, onClose, onInsert }) => {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [selected, setSelected] = useState<Snippet | null>(null);
  const [editing, setEditing] = useState<Snippet | null>(null);
  const [search, setSearch] = useState('');

  // 加载片段
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setSnippets(JSON.parse(stored));
    else setSnippets(DEFAULT_SNIPPETS);
  }, []);

  // 保存片段
  const saveSnippets = useCallback((newSnippets: Snippet[]) => {
    setSnippets(newSnippets);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSnippets));
  }, []);

  // 创建新片段
  const createSnippet = () => {
    const newSnippet: Snippet = { id: `snippet-${Date.now()}`, name: '新代码片段', prefix: 'new', body: '', description: '' };
    setEditing(newSnippet);
  };

  // 保存编辑
  const saveEdit = () => {
    if (!editing) return;
    const exists = snippets.find(s => s.id === editing.id);
    if (exists) saveSnippets(snippets.map(s => s.id === editing.id ? editing : s));
    else saveSnippets([...snippets, editing]);
    setEditing(null);
    setSelected(editing);
  };

  // 删除片段
  const deleteSnippet = (id: string) => {
    saveSnippets(snippets.filter(s => s.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  // 过滤
  const filtered = snippets.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.prefix.toLowerCase().includes(search.toLowerCase()));

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ width: '80vw', maxWidth: 900, height: '70vh', background: 'var(--color-bg-elevated)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>📝 代码片段</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={createSnippet} style={{ padding: '6px 12px', background: 'var(--color-accent-primary)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>+ 新建</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* 列表 */}
          <div style={{ width: 250, borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 8 }}>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索片段..." style={{ width: '100%', padding: '6px 8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 12, color: 'inherit' }} />
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {filtered.map(snippet => (
                <div key={snippet.id} onClick={() => setSelected(snippet)} style={{ padding: '10px 12px', cursor: 'pointer', background: selected?.id === snippet.id ? 'var(--color-bg-hover)' : 'transparent', borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{snippet.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{snippet.prefix}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 详情/编辑 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {editing ? (
              <div style={{ padding: 16, flex: 1, overflow: 'auto' }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>名称</label>
                  <input type="text" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} style={{ width: '100%', padding: '8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'inherit', fontSize: 13 }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>前缀（触发词）</label>
                  <input type="text" value={editing.prefix} onChange={e => setEditing({ ...editing, prefix: e.target.value })} style={{ width: '100%', padding: '8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'inherit', fontSize: 13, fontFamily: 'monospace' }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>代码（使用 $1, $2 作为光标位置）</label>
                  <textarea value={editing.body} onChange={e => setEditing({ ...editing, body: e.target.value })} style={{ width: '100%', height: 200, padding: '8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'inherit', fontSize: 12, fontFamily: 'monospace', resize: 'vertical' }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveEdit} style={{ padding: '8px 16px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>保存</button>
                  <button onClick={() => setEditing(null)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: 'inherit' }}>取消</button>
                </div>
              </div>
            ) : selected ? (
              <div style={{ padding: 16, flex: 1, overflow: 'auto' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>{selected.name}</h3>
                <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--color-text-muted)' }}>前缀: <code style={{ background: 'var(--color-bg-base)', padding: '2px 6px', borderRadius: 3 }}>{selected.prefix}</code></div>
                <pre style={{ margin: 0, padding: 12, background: 'var(--color-bg-base)', borderRadius: 6, fontSize: 12, overflow: 'auto', maxHeight: 300 }}>{selected.body}</pre>
                <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                  {onInsert && <button onClick={() => onInsert(selected.body)} style={{ padding: '8px 16px', background: 'var(--color-accent-primary)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>插入</button>}
                  <button onClick={() => setEditing(selected)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: 'inherit' }}>编辑</button>
                  <button onClick={() => deleteSnippet(selected.id)} style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>删除</button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>选择片段查看详情</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// 默认代码片段
const DEFAULT_SNIPPETS: Snippet[] = [
  { id: 'react-fc', name: 'React 函数组件', prefix: 'rfc', body: 'import React from \'react\';\n\ninterface ${1:Component}Props {\n  $2\n}\n\nexport const ${1:Component}: React.FC<${1:Component}Props> = ({ $3 }) => {\n  return (\n    <div>\n      $0\n    </div>\n  );\n};\n\nexport default ${1:Component};', language: 'typescriptreact' },
  { id: 'useState', name: 'React useState', prefix: 'us', body: 'const [$1, set${1/(.*)/${1:/capitalize}/}] = useState<$2>($3);', language: 'typescriptreact' },
  { id: 'useEffect', name: 'React useEffect', prefix: 'ue', body: 'useEffect(() => {\n  $1\n  return () => {\n    $2\n  };\n}, [$3]);', language: 'typescriptreact' },
  { id: 'async-func', name: '异步函数', prefix: 'af', body: 'async function ${1:name}($2): Promise<$3> {\n  $0\n}', language: 'typescript' },
  { id: 'try-catch', name: 'Try Catch', prefix: 'tc', body: 'try {\n  $1\n} catch (error) {\n  console.error(error);\n  $2\n}', language: 'typescript' },
];

export default SnippetManager;
