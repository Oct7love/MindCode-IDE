import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// 文件信息接口
interface FileItem {
  name: string;
  path: string;
  relativePath: string;
}

// 搜索结果接口
interface SearchResult {
  file: string;
  relativePath: string;
  line: number;
  column: number;
  text: string;
  matchStart: number;
  matchEnd: number;
}

// 命令接口
interface Command {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  action: () => void;
}

// 命令面板模式
type PaletteMode = 'files' | 'commands' | 'search';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  workspacePath: string | null;
  onOpenFile: (path: string, name: string) => void;
  onGotoLine?: (file: string, line: number, column: number) => void;
  commands?: Command[];
  initialMode?: PaletteMode;
}

// 模糊匹配算法
function fuzzyMatch(pattern: string, str: string): { matched: boolean; score: number; indices: number[] } {
  const patternLower = pattern.toLowerCase();
  const strLower = str.toLowerCase();
  const indices: number[] = [];
  let patternIdx = 0;
  let score = 0;
  let lastMatchIdx = -1;

  for (let i = 0; i < str.length && patternIdx < pattern.length; i++) {
    if (strLower[i] === patternLower[patternIdx]) {
      indices.push(i);
      // 连续匹配得分更高
      if (lastMatchIdx === i - 1) {
        score += 2;
      } else {
        score += 1;
      }
      // 单词开头匹配得分更高
      if (i === 0 || str[i - 1] === '/' || str[i - 1] === '\\' || str[i - 1] === '.' || str[i - 1] === '-' || str[i - 1] === '_') {
        score += 3;
      }
      lastMatchIdx = i;
      patternIdx++;
    }
  }

  return {
    matched: patternIdx === pattern.length,
    score,
    indices
  };
}

// 获取文件图标颜色
function getFileColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const colors: Record<string, string> = {
    ts: '#3178c6', tsx: '#3178c6', js: '#f1e05a', jsx: '#f1e05a',
    json: '#cbcb41', css: '#563d7c', scss: '#c6538c', html: '#e34c26',
    md: '#083fa1', py: '#3572a5', go: '#00add8', rs: '#dea584',
    vue: '#41b883', svelte: '#ff3e00', java: '#b07219', c: '#555555',
    cpp: '#f34b7d', h: '#555555', rb: '#701516', php: '#4F5D95',
  };
  return colors[ext] || '#8b8b8b';
}

// 高亮显示匹配字符
const HighlightedText: React.FC<{ text: string; indices: number[] }> = ({ text, indices }) => {
  if (indices.length === 0) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let lastIdx = 0;

  indices.forEach((idx, i) => {
    if (idx > lastIdx) {
      parts.push(<span key={`normal-${i}`}>{text.slice(lastIdx, idx)}</span>);
    }
    parts.push(<span key={`match-${i}`} className="palette-match">{text[idx]}</span>);
    lastIdx = idx + 1;
  });

  if (lastIdx < text.length) {
    parts.push(<span key="end">{text.slice(lastIdx)}</span>);
  }

  return <>{parts}</>;
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  workspacePath,
  onOpenFile,
  onGotoLine,
  commands = [],
  initialMode = 'files'
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<PaletteMode>(initialMode);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 重置状态
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setMode(initialMode);
      setSearchResults([]);
      inputRef.current?.focus();
    }
  }, [isOpen, initialMode]);

  // 加载文件列表
  useEffect(() => {
    if (isOpen && workspacePath && mode === 'files') {
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
  }, [isOpen, workspacePath, mode]);

  // 处理搜索模式的查询（去除 > 前缀）
  const actualQuery = useMemo(() => {
    if (query.startsWith('>')) {
      return query.slice(1).trim();
    }
    if (query.startsWith('#')) {
      return query.slice(1).trim();
    }
    return query;
  }, [query]);

  // 检测模式切换
  useEffect(() => {
    if (query.startsWith('>')) {
      setMode('commands');
    } else if (query.startsWith('#')) {
      setMode('search');
    } else if (mode !== 'files' && !query.startsWith('>') && !query.startsWith('#')) {
      setMode('files');
    }
  }, [query, mode]);

  // 执行内容搜索
  useEffect(() => {
    if (mode === 'search' && actualQuery.length >= 2 && workspacePath) {
      setLoading(true);
      const timer = setTimeout(() => {
        window.mindcode?.fs.searchInFiles({
          workspacePath,
          query: actualQuery,
          maxResults: 50
        }).then(result => {
          if (result.success && result.data) {
            setSearchResults(result.data);
          }
          setLoading(false);
        }).catch(() => {
          setLoading(false);
        });
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [mode, actualQuery, workspacePath]);

  // 过滤文件列表
  const filteredFiles = useMemo(() => {
    if (!actualQuery || mode !== 'files') return files.slice(0, 50);

    return files
      .map(file => ({
        ...file,
        match: fuzzyMatch(actualQuery, file.relativePath)
      }))
      .filter(f => f.match.matched)
      .sort((a, b) => b.match.score - a.match.score)
      .slice(0, 50);
  }, [files, actualQuery, mode]);

  // 过滤命令列表
  const filteredCommands = useMemo(() => {
    if (mode !== 'commands') return [];
    if (!actualQuery) return commands.slice(0, 20);

    return commands
      .map(cmd => ({
        ...cmd,
        match: fuzzyMatch(actualQuery, cmd.label)
      }))
      .filter(c => c.match.matched)
      .sort((a, b) => b.match.score - a.match.score)
      .slice(0, 20);
  }, [commands, actualQuery, mode]);

  // 当前显示的项目数
  const itemCount = mode === 'files'
    ? filteredFiles.length
    : mode === 'commands'
      ? filteredCommands.length
      : searchResults.length;

  // 重置选中索引
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, mode]);

  // 滚动到选中项
  useEffect(() => {
    if (listRef.current) {
      const selectedItem = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // 执行选中项
  const executeSelected = useCallback(() => {
    if (mode === 'files' && filteredFiles[selectedIndex]) {
      const file = filteredFiles[selectedIndex];
      onOpenFile(file.path, file.name);
      onClose();
    } else if (mode === 'commands' && filteredCommands[selectedIndex]) {
      filteredCommands[selectedIndex].action();
      onClose();
    } else if (mode === 'search' && searchResults[selectedIndex]) {
      const result = searchResults[selectedIndex];
      if (onGotoLine) {
        onGotoLine(result.file, result.line, result.column);
      } else {
        onOpenFile(result.file, result.relativePath.split('/').pop() || '');
      }
      onClose();
    }
  }, [mode, filteredFiles, filteredCommands, searchResults, selectedIndex, onOpenFile, onGotoLine, onClose]);

  // 键盘事件处理
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, itemCount - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        executeSelected();
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case 'Tab':
        e.preventDefault();
        // Tab 切换模式
        if (mode === 'files') {
          setQuery('>');
        } else if (mode === 'commands') {
          setQuery('#');
        } else {
          setQuery('');
        }
        break;
    }
  }, [itemCount, executeSelected, onClose, mode]);

  if (!isOpen) return null;

  return (
    <div className="palette-overlay" onClick={onClose}>
      <div className="palette-container" onClick={e => e.stopPropagation()}>
        <div className="palette-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="palette-input"
            placeholder={
              mode === 'commands'
                ? '输入命令名称...'
                : mode === 'search'
                  ? '搜索文件内容...'
                  : '输入文件名搜索... (> 命令, # 搜索内容)'
            }
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {loading && <div className="palette-loading" />}
        </div>

        <div className="palette-list" ref={listRef}>
          {mode === 'files' && filteredFiles.map((file, idx) => (
            <div
              key={file.path}
              className={`palette-item${idx === selectedIndex ? ' selected' : ''}`}
              onClick={() => {
                onOpenFile(file.path, file.name);
                onClose();
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <span className="palette-item-icon">
                <svg viewBox="0 0 16 16" fill={getFileColor(file.name)} width="16" height="16">
                  <path d="M10.5 1H3.5C2.67 1 2 1.67 2 2.5v11c0 .83.67 1.5 1.5 1.5h9c.83 0 1.5-.67 1.5-1.5V4.5L10.5 1zm2.5 12.5c0 .28-.22.5-.5.5h-9c-.28 0-.5-.22-.5-.5v-11c0-.28.22-.5.5-.5H10v3h3v8.5z"/>
                </svg>
              </span>
              <span className="palette-item-label">
                {'match' in file ? (
                  <HighlightedText text={file.name} indices={(file as any).match.indices.filter((i: number) => i >= file.relativePath.length - file.name.length).map((i: number) => i - (file.relativePath.length - file.name.length))} />
                ) : file.name}
              </span>
              <span className="palette-item-path">
                {'match' in file ? (
                  <HighlightedText text={file.relativePath} indices={(file as any).match.indices} />
                ) : file.relativePath}
              </span>
            </div>
          ))}

          {mode === 'commands' && filteredCommands.map((cmd, idx) => (
            <div
              key={cmd.id}
              className={`palette-item${idx === selectedIndex ? ' selected' : ''}`}
              onClick={() => {
                cmd.action();
                onClose();
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <span className="palette-item-icon">
                <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
                  <path d="M5.9 7.8L8 5.7l.7.7-2.8 2.8-.7.7L2.1 7l.7-.7 3.1 1.5z"/>
                  <path d="M8.4 12H14v1H8.4v-1z"/>
                </svg>
              </span>
              <span className="palette-item-label">
                {'match' in cmd ? (
                  <HighlightedText text={cmd.label} indices={(cmd as any).match.indices} />
                ) : cmd.label}
              </span>
              {cmd.shortcut && (
                <span className="palette-item-shortcut">{cmd.shortcut}</span>
              )}
              {cmd.description && (
                <span className="palette-item-desc">{cmd.description}</span>
              )}
            </div>
          ))}

          {mode === 'search' && searchResults.map((result, idx) => (
            <div
              key={`${result.file}-${result.line}-${result.column}`}
              className={`palette-item${idx === selectedIndex ? ' selected' : ''}`}
              onClick={() => {
                if (onGotoLine) {
                  onGotoLine(result.file, result.line, result.column);
                } else {
                  onOpenFile(result.file, result.relativePath.split('/').pop() || '');
                }
                onClose();
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <span className="palette-item-icon">
                <svg viewBox="0 0 16 16" fill={getFileColor(result.relativePath)} width="16" height="16">
                  <path d="M10.5 1H3.5C2.67 1 2 1.67 2 2.5v11c0 .83.67 1.5 1.5 1.5h9c.83 0 1.5-.67 1.5-1.5V4.5L10.5 1zm2.5 12.5c0 .28-.22.5-.5.5h-9c-.28 0-.5-.22-.5-.5v-11c0-.28.22-.5.5-.5H10v3h3v8.5z"/>
                </svg>
              </span>
              <span className="palette-item-label">{result.relativePath}</span>
              <span className="palette-item-line">:{result.line}</span>
              <span className="palette-item-preview">{result.text}</span>
            </div>
          ))}

          {itemCount === 0 && !loading && (
            <div className="palette-empty">
              {mode === 'search' && actualQuery.length < 2
                ? '输入至少 2 个字符开始搜索'
                : '没有找到匹配项'}
            </div>
          )}
        </div>

        <div className="palette-footer">
          <span className="palette-hint">
            <kbd>↑↓</kbd> 导航
            <kbd>Enter</kbd> 选择
            <kbd>Esc</kbd> 关闭
            <kbd>Tab</kbd> 切换模式
          </span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
