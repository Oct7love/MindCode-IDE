/**
 * MindCode - 上下文选择器组件
 * 实现 @ 引用文件、文件夹、代码库等上下文
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// 上下文类型
export type ContextType = 'file' | 'folder' | 'codebase' | 'selection' | 'terminal';

// 上下文项接口
export interface ContextItem {
  type: ContextType;
  label: string;
  path?: string;
  content?: string;
  icon?: React.ReactNode;
}

// 文件项接口
interface FileItem {
  name: string;
  path: string;
  relativePath: string;
}

interface ContextPickerProps {
  isOpen: boolean;
  query: string;
  position: { top: number; left: number };
  workspacePath: string | null;
  currentFile?: { path: string; content: string };
  selectedText?: string;
  onSelect: (context: ContextItem) => void;
  onClose: () => void;
}

// 获取文件图标颜色
function getFileColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const colors: Record<string, string> = {
    ts: '#3178c6', tsx: '#3178c6', js: '#f1e05a', jsx: '#f1e05a',
    json: '#cbcb41', css: '#563d7c', scss: '#c6538c', html: '#e34c26',
    md: '#083fa1', py: '#3572a5', go: '#00add8', rs: '#dea584',
  };
  return colors[ext] || '#8b8b8b';
}

// 模糊匹配
function fuzzyMatch(pattern: string, str: string): boolean {
  const patternLower = pattern.toLowerCase();
  const strLower = str.toLowerCase();
  let patternIdx = 0;

  for (let i = 0; i < str.length && patternIdx < pattern.length; i++) {
    if (strLower[i] === patternLower[patternIdx]) {
      patternIdx++;
    }
  }

  return patternIdx === pattern.length;
}

export const ContextPicker: React.FC<ContextPickerProps> = ({
  isOpen,
  query,
  position,
  workspacePath,
  currentFile,
  selectedText,
  onSelect,
  onClose
}) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // 加载文件列表
  useEffect(() => {
    if (isOpen && workspacePath) {
      setLoading(true);
      window.mindcode?.fs.getAllFiles(workspacePath).then(result => {
        if (result.success && result.data) {
          setFiles(result.data);
        }
        setLoading(false);
      }).catch(() => {
        setLoading(false);
      });
    }
  }, [isOpen, workspacePath]);

  // 重置选中索引
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // 预设上下文选项
  const presetContexts = useMemo((): ContextItem[] => {
    const items: ContextItem[] = [];

    // @codebase - 整个代码库
    items.push({
      type: 'codebase',
      label: 'Codebase',
      icon: (
        <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
          <path d="M14.5 3H7.71l-.85-.85L6.51 2h-5l-.5.5v11l.5.5h13l.5-.5v-10L14.5 3zm-.51 8.49V13h-12V3h4.29l.85.85.36.15H14v7.49z"/>
        </svg>
      )
    });

    // @selection - 当前选中
    if (selectedText) {
      items.push({
        type: 'selection',
        label: 'Selection',
        content: selectedText,
        icon: (
          <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
            <path d="M11.5 1H4.5L4 1.5V2h.707L4 2.707V5h1V3.414l.146-.146 5.44 5.44-.146.146H9v1h1.293l.707.707V11h-1v1h.5l.5-.5V9.707l1.5-1.5v-.414L7.207 2.5 8 1.793V1h3.5z"/>
          </svg>
        )
      });
    }

    // @file - 当前文件
    if (currentFile) {
      items.push({
        type: 'file',
        label: 'Current File',
        path: currentFile.path,
        content: currentFile.content,
        icon: (
          <svg viewBox="0 0 16 16" fill="#3178c6" width="16" height="16">
            <path d="M10.5 1H3.5C2.67 1 2 1.67 2 2.5v11c0 .83.67 1.5 1.5 1.5h9c.83 0 1.5-.67 1.5-1.5V4.5L10.5 1z"/>
          </svg>
        )
      });
    }

    return items;
  }, [selectedText, currentFile]);

  // 过滤文件列表
  const filteredItems = useMemo(() => {
    const searchQuery = query.replace(/^@/, '').trim().toLowerCase();

    // 首先显示预设选项
    let filtered = presetContexts.filter(ctx =>
      !searchQuery || ctx.label.toLowerCase().includes(searchQuery)
    );

    // 然后显示匹配的文件
    if (searchQuery) {
      const matchedFiles = files
        .filter(f => fuzzyMatch(searchQuery, f.relativePath))
        .slice(0, 10)
        .map(f => ({
          type: 'file' as ContextType,
          label: f.name,
          path: f.path,
          icon: (
            <svg viewBox="0 0 16 16" fill={getFileColor(f.name)} width="16" height="16">
              <path d="M10.5 1H3.5C2.67 1 2 1.67 2 2.5v11c0 .83.67 1.5 1.5 1.5h9c.83 0 1.5-.67 1.5-1.5V4.5L10.5 1z"/>
            </svg>
          )
        }));
      filtered = [...filtered, ...matchedFiles];
    }

    return filtered.slice(0, 12);
  }, [query, presetContexts, files]);

  // 滚动到选中项
  useEffect(() => {
    if (listRef.current) {
      const selectedItem = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // 键盘事件
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredItems[selectedIndex]) {
            onSelect(filteredItems[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredItems, onSelect, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="context-picker"
      style={{
        position: 'absolute',
        bottom: position.top,
        left: position.left,
        zIndex: 1000
      }}
      onClick={e => e.stopPropagation()}
    >
      <div className="context-picker-container">
        <div className="context-picker-header">
          <span className="context-picker-title">引用上下文</span>
          <span className="context-picker-hint">输入筛选</span>
        </div>

        <div className="context-picker-list" ref={listRef}>
          {loading && (
            <div className="context-picker-loading">
              <div className="context-picker-spinner" />
              <span>加载中...</span>
            </div>
          )}

          {!loading && filteredItems.map((item, idx) => (
            <div
              key={`${item.type}-${item.path || item.label}-${idx}`}
              className={`context-picker-item${idx === selectedIndex ? ' selected' : ''}`}
              onClick={() => onSelect(item)}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <span className="context-picker-item-icon">{item.icon}</span>
              <span className="context-picker-item-label">@{item.label}</span>
              {item.path && (
                <span className="context-picker-item-path">
                  {item.path.split(/[/\\]/).slice(-2).join('/')}
                </span>
              )}
            </div>
          ))}

          {!loading && filteredItems.length === 0 && (
            <div className="context-picker-empty">没有匹配的上下文</div>
          )}
        </div>

        <div className="context-picker-footer">
          <span><kbd>↑↓</kbd> 导航</span>
          <span><kbd>Enter</kbd> 选择</span>
          <span><kbd>Esc</kbd> 关闭</span>
        </div>
      </div>
    </div>
  );
};

export default ContextPicker;
