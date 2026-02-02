/**
 * StatusBarEnhanced - 增强状态栏
 */

import React, { useState, useEffect } from 'react';

export interface StatusBarItem { id: string; content: React.ReactNode; position: 'left' | 'right'; priority?: number; tooltip?: string; onClick?: () => void; }
export interface StatusBarProps { items?: StatusBarItem[]; language?: string; encoding?: string; lineEnding?: string; indentation?: string; cursorPosition?: { line: number; column: number }; selection?: { lines: number; chars: number }; gitBranch?: string; gitStatus?: { changed: number; staged: number }; problems?: { errors: number; warnings: number }; }

export const StatusBar: React.FC<StatusBarProps> = ({ items = [], language = 'Plain Text', encoding = 'UTF-8', lineEnding = 'LF', indentation = 'Spaces: 2', cursorPosition, selection, gitBranch, gitStatus, problems }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => { const id = setInterval(() => setTime(new Date()), 60000); return () => clearInterval(id); }, []);

  const leftItems = items.filter(i => i.position === 'left').sort((a, b) => (b.priority || 0) - (a.priority || 0));
  const rightItems = items.filter(i => i.position === 'right').sort((a, b) => (b.priority || 0) - (a.priority || 0));

  const ItemWrapper: React.FC<{ item: StatusBarItem }> = ({ item }) => (
    <div title={item.tooltip} onClick={item.onClick} className={`px-2 py-0.5 text-xs ${item.onClick ? 'cursor-pointer hover:bg-[var(--color-bg-hover)]' : ''}`}>{item.content}</div>
  );

  return (
    <div className="h-[var(--size-statusbar)] bg-[var(--color-accent-primary)] text-white flex items-center justify-between px-2 select-none text-xs">
      <div className="flex items-center gap-1">
        {/* Git 状态 */}
        {gitBranch && (
          <div className="flex items-center gap-1 px-2 py-0.5 hover:bg-white/10 cursor-pointer rounded" title="Git 分支">
            <span>⎇</span>
            <span>{gitBranch}</span>
            {gitStatus && (gitStatus.changed > 0 || gitStatus.staged > 0) && (
              <span className="text-yellow-300">({gitStatus.staged > 0 ? `+${gitStatus.staged}` : ''}{gitStatus.changed > 0 ? ` ~${gitStatus.changed}` : ''})</span>
            )}
          </div>
        )}

        {/* 问题计数 */}
        {problems && (problems.errors > 0 || problems.warnings > 0) && (
          <div className="flex items-center gap-2 px-2 py-0.5 hover:bg-white/10 cursor-pointer rounded" title="问题">
            {problems.errors > 0 && <span className="flex items-center gap-0.5"><span>✕</span>{problems.errors}</span>}
            {problems.warnings > 0 && <span className="flex items-center gap-0.5"><span>⚠</span>{problems.warnings}</span>}
          </div>
        )}

        {/* 自定义左侧项目 */}
        {leftItems.map(item => <ItemWrapper key={item.id} item={item} />)}
      </div>

      <div className="flex items-center gap-1">
        {/* 自定义右侧项目 */}
        {rightItems.map(item => <ItemWrapper key={item.id} item={item} />)}

        {/* 光标位置 */}
        {cursorPosition && (
          <div className="px-2 py-0.5 hover:bg-white/10 cursor-pointer rounded" title="光标位置">
            Ln {cursorPosition.line}, Col {cursorPosition.column}
            {selection && selection.chars > 0 && <span className="ml-1 text-white/70">({selection.lines > 1 ? `${selection.lines} lines, ` : ''}{selection.chars} selected)</span>}
          </div>
        )}

        {/* 缩进 */}
        <div className="px-2 py-0.5 hover:bg-white/10 cursor-pointer rounded" title="缩进设置">{indentation}</div>

        {/* 编码 */}
        <div className="px-2 py-0.5 hover:bg-white/10 cursor-pointer rounded" title="文件编码">{encoding}</div>

        {/* 换行符 */}
        <div className="px-2 py-0.5 hover:bg-white/10 cursor-pointer rounded" title="换行符">{lineEnding}</div>

        {/* 语言 */}
        <div className="px-2 py-0.5 hover:bg-white/10 cursor-pointer rounded" title="语言模式">{language}</div>

        {/* 时间 */}
        <div className="px-2 py-0.5 text-white/70" title="当前时间">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    </div>
  );
};

// 状态栏 Hook
interface StatusBarState { items: StatusBarItem[]; addItem: (item: StatusBarItem) => void; removeItem: (id: string) => void; updateItem: (id: string, updates: Partial<StatusBarItem>) => void; }

export const useStatusBar = (): StatusBarState => {
  const [items, setItems] = useState<StatusBarItem[]>([]);
  const addItem = (item: StatusBarItem) => setItems(prev => [...prev.filter(i => i.id !== item.id), item]);
  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));
  const updateItem = (id: string, updates: Partial<StatusBarItem>) => setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  return { items, addItem, removeItem, updateItem };
};

// 进度指示器
export const StatusBarProgress: React.FC<{ active: boolean; message?: string }> = ({ active, message }) => {
  if (!active) return null;
  return (
    <div className="flex items-center gap-2 px-2 py-0.5">
      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      {message && <span className="text-white/80">{message}</span>}
    </div>
  );
};

export default StatusBar;
