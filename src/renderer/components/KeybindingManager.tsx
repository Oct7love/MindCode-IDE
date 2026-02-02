/**
 * KeybindingManager - 快捷键管理器
 * 查看、自定义快捷键绑定
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';

export interface Keybinding { id: string; command: string; keys: string; when?: string; category: string; description: string; }

const STORAGE_KEY = 'mindcode_keybindings';

const DEFAULT_KEYBINDINGS: Keybinding[] = [
  // 文件
  { id: 'file.new', command: 'file.new', keys: 'Ctrl+N', category: '文件', description: '新建文件' },
  { id: 'file.open', command: 'file.open', keys: 'Ctrl+O', category: '文件', description: '打开文件' },
  { id: 'file.save', command: 'file.save', keys: 'Ctrl+S', category: '文件', description: '保存文件' },
  { id: 'file.saveAll', command: 'file.saveAll', keys: 'Ctrl+Shift+S', category: '文件', description: '保存所有' },
  { id: 'file.close', command: 'file.close', keys: 'Ctrl+W', category: '文件', description: '关闭文件' },
  // 编辑
  { id: 'edit.undo', command: 'edit.undo', keys: 'Ctrl+Z', category: '编辑', description: '撤销' },
  { id: 'edit.redo', command: 'edit.redo', keys: 'Ctrl+Y', category: '编辑', description: '重做' },
  { id: 'edit.cut', command: 'edit.cut', keys: 'Ctrl+X', category: '编辑', description: '剪切' },
  { id: 'edit.copy', command: 'edit.copy', keys: 'Ctrl+C', category: '编辑', description: '复制' },
  { id: 'edit.paste', command: 'edit.paste', keys: 'Ctrl+V', category: '编辑', description: '粘贴' },
  { id: 'edit.find', command: 'edit.find', keys: 'Ctrl+F', category: '编辑', description: '查找' },
  { id: 'edit.replace', command: 'edit.replace', keys: 'Ctrl+H', category: '编辑', description: '替换' },
  { id: 'edit.selectAll', command: 'edit.selectAll', keys: 'Ctrl+A', category: '编辑', description: '全选' },
  { id: 'edit.comment', command: 'edit.comment', keys: 'Ctrl+/', category: '编辑', description: '切换注释' },
  { id: 'edit.format', command: 'edit.format', keys: 'Shift+Alt+F', category: '编辑', description: '格式化' },
  // 导航
  { id: 'nav.quickOpen', command: 'nav.quickOpen', keys: 'Ctrl+P', category: '导航', description: '快速打开文件' },
  { id: 'nav.command', command: 'nav.command', keys: 'Ctrl+Shift+P', category: '导航', description: '命令面板' },
  { id: 'nav.symbol', command: 'nav.symbol', keys: 'Ctrl+Shift+O', category: '导航', description: '跳转到符号' },
  { id: 'nav.line', command: 'nav.line', keys: 'Ctrl+G', category: '导航', description: '跳转到行' },
  { id: 'nav.definition', command: 'nav.definition', keys: 'F12', category: '导航', description: '跳转到定义' },
  { id: 'nav.references', command: 'nav.references', keys: 'Shift+F12', category: '导航', description: '查找引用' },
  // 视图
  { id: 'view.sidebar', command: 'view.sidebar', keys: 'Ctrl+B', category: '视图', description: '切换侧边栏' },
  { id: 'view.terminal', command: 'view.terminal', keys: 'Ctrl+`', category: '视图', description: '切换终端' },
  { id: 'view.problems', command: 'view.problems', keys: 'Ctrl+Shift+M', category: '视图', description: '问题面板' },
  { id: 'view.explorer', command: 'view.explorer', keys: 'Ctrl+Shift+E', category: '视图', description: '文件资源管理器' },
  { id: 'view.search', command: 'view.search', keys: 'Ctrl+Shift+F', category: '视图', description: '全局搜索' },
  { id: 'view.git', command: 'view.git', keys: 'Ctrl+Shift+G', category: '视图', description: 'Git 面板' },
  // AI
  { id: 'ai.chat', command: 'ai.chat', keys: 'Ctrl+L', category: 'AI', description: '打开 AI 对话' },
  { id: 'ai.inline', command: 'ai.inline', keys: 'Ctrl+I', category: 'AI', description: '内联编辑' },
  { id: 'ai.composer', command: 'ai.composer', keys: 'Ctrl+Shift+I', category: 'AI', description: 'Composer' },
  { id: 'ai.explain', command: 'ai.explain', keys: 'Ctrl+Shift+E', category: 'AI', description: '解释代码', when: 'editorHasSelection' },
];

interface KeybindingManagerProps { isOpen: boolean; onClose: () => void; }

export const KeybindingManager: React.FC<KeybindingManagerProps> = ({ isOpen, onClose }) => {
  const [keybindings, setKeybindings] = useState<Keybinding[]>(DEFAULT_KEYBINDINGS);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ id: string; keys: string } | null>(null);
  const [recording, setRecording] = useState(false);

  // 加载自定义绑定
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const custom = JSON.parse(saved) as Record<string, string>;
      setKeybindings(DEFAULT_KEYBINDINGS.map(kb => custom[kb.id] ? { ...kb, keys: custom[kb.id] } : kb));
    }
  }, []);

  // 保存自定义绑定
  const saveKeybinding = useCallback((id: string, keys: string) => {
    setKeybindings(prev => prev.map(kb => kb.id === id ? { ...kb, keys } : kb));
    const saved = localStorage.getItem(STORAGE_KEY);
    const custom = saved ? JSON.parse(saved) : {};
    custom[id] = keys;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
    setEditing(null);
    setRecording(false);
  }, []);

  // 重置为默认
  const resetKeybinding = useCallback((id: string) => {
    const def = DEFAULT_KEYBINDINGS.find(kb => kb.id === id);
    if (def) {
      saveKeybinding(id, def.keys);
    }
  }, [saveKeybinding]);

  // 录制按键
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!recording || !editing) return;
    e.preventDefault();
    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    if (e.metaKey) parts.push('Meta');
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
    }
    if (parts.length > 0 && !['Control', 'Shift', 'Alt', 'Meta'].includes(parts[parts.length - 1])) {
      setEditing({ ...editing, keys: parts.join('+') });
    }
  }, [recording, editing]);

  // 过滤
  const filtered = useMemo(() => {
    if (!search) return keybindings;
    const lower = search.toLowerCase();
    return keybindings.filter(kb => kb.description.toLowerCase().includes(lower) || kb.keys.toLowerCase().includes(lower) || kb.category.toLowerCase().includes(lower));
  }, [keybindings, search]);

  // 按分类分组
  const categories = useMemo(() => [...new Set(filtered.map(kb => kb.category))], [filtered]);

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ width: '70vw', maxWidth: 800, height: '70vh', background: 'var(--color-bg-elevated)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>⌨️ 快捷键</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {/* 搜索 */}
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索快捷键..." autoFocus style={{ width: '100%', padding: '8px 12px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 13, color: 'inherit' }} />
        </div>

        {/* 列表 */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {categories.map(category => (
            <div key={category}>
              <div style={{ padding: '8px 16px', background: 'var(--color-bg-base)', fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500, position: 'sticky', top: 0 }}>{category}</div>
              {filtered.filter(kb => kb.category === category).map(kb => (
                <div key={kb.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ flex: 1, fontSize: 13 }}>{kb.description}</span>
                  {editing?.id === kb.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="text" value={editing.keys} readOnly placeholder="按下快捷键..." onKeyDown={handleKeyDown} onFocus={() => setRecording(true)} onBlur={() => setRecording(false)} style={{ width: 120, padding: '4px 8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-accent-primary)', borderRadius: 4, fontSize: 11, color: 'inherit', textAlign: 'center' }} autoFocus />
                      <button onClick={() => saveKeybinding(kb.id, editing.keys)} style={{ padding: '4px 8px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 10 }}>保存</button>
                      <button onClick={() => setEditing(null)} style={{ padding: '4px 8px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 10, color: 'inherit' }}>取消</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <code style={{ padding: '4px 8px', background: 'var(--color-bg-base)', borderRadius: 4, fontSize: 11, minWidth: 80, textAlign: 'center' }}>{kb.keys}</code>
                      <button onClick={() => setEditing({ id: kb.id, keys: kb.keys })} title="编辑" style={{ padding: '4px 6px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 10, color: 'inherit' }}>✏️</button>
                      <button onClick={() => resetKeybinding(kb.id)} title="重置" style={{ padding: '4px 6px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 10, color: 'var(--color-text-muted)' }}>↺</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 快捷键 Hook
export function useKeybindings(handlers: Record<string, () => void>) {
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const custom = saved ? JSON.parse(saved) : {};
    const bindings = DEFAULT_KEYBINDINGS.map(kb => custom[kb.id] ? { ...kb, keys: custom[kb.id] } : kb);

    const handleKeyDown = (e: KeyboardEvent) => {
      const parts: string[] = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.shiftKey) parts.push('Shift');
      if (e.altKey) parts.push('Alt');
      if (e.metaKey) parts.push('Meta');
      if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
      }
      const pressed = parts.join('+');
      const binding = bindings.find(kb => kb.keys === pressed);
      if (binding && handlers[binding.command]) { e.preventDefault(); handlers[binding.command](); }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}

export default KeybindingManager;
