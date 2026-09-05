/**
 * CommandPalette - 命令面板
 * Ctrl+Shift+P 快速执行命令
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

export interface Command { id: string; label: string; category?: string; keybinding?: string; icon?: string; handler: () => void; }

interface CommandPaletteProps { isOpen: boolean; onClose: () => void; commands: Command[]; }

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, commands }) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 重置状态
  useEffect(() => { if (isOpen) { setSearch(''); setSelectedIndex(0); inputRef.current?.focus(); } }, [isOpen]);

  // 过滤命令
  const filtered = useMemo(() => {
    if (!search) return commands;
    const lower = search.toLowerCase();
    return commands.filter(cmd => cmd.label.toLowerCase().includes(lower) || cmd.category?.toLowerCase().includes(lower) || cmd.id.toLowerCase().includes(lower))
      .sort((a, b) => { // 优先完全匹配
        const aStart = a.label.toLowerCase().startsWith(lower) ? 0 : 1;
        const bStart = b.label.toLowerCase().startsWith(lower) ? 0 : 1;
        return aStart - bStart;
      });
  }, [commands, search]);

  // 确保选中项可见
  useEffect(() => {
    if (selectedIndex >= filtered.length) setSelectedIndex(Math.max(0, filtered.length - 1));
    const item = listRef.current?.children[selectedIndex] as HTMLElement;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, filtered.length]);

  // 执行命令
  const executeCommand = useCallback((cmd: Command) => {
    onClose();
    setTimeout(() => cmd.handler(), 50);
  }, [onClose]);

  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); break;
      case 'ArrowUp': e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); break;
      case 'Enter': e.preventDefault(); if (filtered[selectedIndex]) executeCommand(filtered[selectedIndex]); break;
      case 'Escape': onClose(); break;
    }
  };

  if (!isOpen) return null;

  return (
    <div data-testid="command-palette" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '15vh', zIndex: 1000 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '50vw', maxWidth: 600, background: 'var(--color-bg-elevated)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        {/* 搜索框 */}
        <div style={{ padding: 12, borderBottom: '1px solid var(--color-border)' }}>
          <input ref={inputRef} type="text" value={search} onChange={e => { setSearch(e.target.value); setSelectedIndex(0); }} onKeyDown={handleKeyDown} placeholder="> 输入命令..." style={{ width: '100%', padding: '10px 12px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 14, color: 'inherit', outline: 'none' }} />
        </div>

        {/* 命令列表 */}
        <div ref={listRef} style={{ maxHeight: 400, overflow: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>无匹配命令</div>
          ) : (
            filtered.map((cmd, idx) => (
              <div key={cmd.id} onClick={() => executeCommand(cmd)} onMouseEnter={() => setSelectedIndex(idx)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', background: idx === selectedIndex ? 'var(--color-bg-hover)' : 'transparent' }}>
                {cmd.icon && <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{cmd.icon}</span>}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>{cmd.label}</div>
                  {cmd.category && <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{cmd.category}</div>}
                </div>
                {cmd.keybinding && <code style={{ padding: '2px 6px', background: 'var(--color-bg-base)', borderRadius: 3, fontSize: 10, color: 'var(--color-text-muted)' }}>{cmd.keybinding}</code>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// 默认命令生成器
export function createDefaultCommands(handlers: Partial<Record<string, () => void>>): Command[] {
  return [
    { id: 'file.new', label: '新建文件', category: '文件', keybinding: 'Ctrl+N', icon: '📄', handler: handlers['file.new'] || (() => {}) },
    { id: 'file.open', label: '打开文件', category: '文件', keybinding: 'Ctrl+O', icon: '📂', handler: handlers['file.open'] || (() => {}) },
    { id: 'file.save', label: '保存', category: '文件', keybinding: 'Ctrl+S', icon: '💾', handler: handlers['file.save'] || (() => {}) },
    { id: 'view.sidebar', label: '切换侧边栏', category: '视图', keybinding: 'Ctrl+B', icon: '📋', handler: handlers['view.sidebar'] || (() => {}) },
    { id: 'view.terminal', label: '切换终端', category: '视图', keybinding: 'Ctrl+`', icon: '💻', handler: handlers['view.terminal'] || (() => {}) },
    { id: 'view.theme', label: '更换主题', category: '视图', icon: '🎨', handler: handlers['view.theme'] || (() => {}) },
    { id: 'view.keybindings', label: '键盘快捷方式', category: '视图', icon: '⌨️', handler: handlers['view.keybindings'] || (() => {}) },
    { id: 'view.settings', label: '打开设置', category: '视图', keybinding: 'Ctrl+,', icon: '⚙️', handler: handlers['view.settings'] || (() => {}) },
    { id: 'edit.find', label: '查找', category: '编辑', keybinding: 'Ctrl+F', icon: '🔍', handler: handlers['edit.find'] || (() => {}) },
    { id: 'edit.replace', label: '替换', category: '编辑', keybinding: 'Ctrl+H', icon: '🔄', handler: handlers['edit.replace'] || (() => {}) },
    { id: 'edit.format', label: '格式化文档', category: '编辑', keybinding: 'Shift+Alt+F', icon: '✨', handler: handlers['edit.format'] || (() => {}) },
    { id: 'ai.chat', label: 'AI 对话', category: 'AI', keybinding: 'Ctrl+L', icon: '🤖', handler: handlers['ai.chat'] || (() => {}) },
    { id: 'ai.composer', label: 'Composer', category: 'AI', keybinding: 'Ctrl+Shift+I', icon: '🎼', handler: handlers['ai.composer'] || (() => {}) },
    { id: 'git.commit', label: 'Git: 提交', category: 'Git', icon: '📝', handler: handlers['git.commit'] || (() => {}) },
    { id: 'git.push', label: 'Git: 推送', category: 'Git', icon: '⬆️', handler: handlers['git.push'] || (() => {}) },
    { id: 'git.pull', label: 'Git: 拉取', category: 'Git', icon: '⬇️', handler: handlers['git.pull'] || (() => {}) },
  ];
}

export default CommandPalette;
