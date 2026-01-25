import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAIStore, useFileStore, ContextItem } from '../../stores';
import './ContextPicker.css';

type PickerMode = 'file' | 'selection' | 'folder' | 'symbol' | 'menu';

interface ContextPickerProps {
  isOpen: boolean;
  onClose: () => void;
  position?: { x: number; y: number };
  inputRef?: React.RefObject<HTMLTextAreaElement>;
}

export const ContextPicker: React.FC<ContextPickerProps> = ({ isOpen, onClose, position, inputRef }) => {
  const { addContext } = useAIStore();
  const { fileTree, workspaceRoot, getActiveFile } = useFileStore();
  const [mode, setMode] = useState<PickerMode>('menu');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<{ id: string; label: string; type: PickerMode; data: any }[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const menuItems = [
    { type: 'file' as const, label: '@file - 选择文件', icon: '📄' },
    { type: 'selection' as const, label: '@selection - 当前选区', icon: '✂️' },
    { type: 'folder' as const, label: '@folder - 选择目录', icon: '📁' },
    { type: 'symbol' as const, label: '@symbol - 搜索符号', icon: '🔣' },
  ];

  useEffect(() => { // 聚焦搜索框
    if (isOpen && searchRef.current) setTimeout(() => searchRef.current?.focus(), 50);
    if (!isOpen) { setMode('menu'); setSearch(''); setResults([]); }
  }, [isOpen]);

  useEffect(() => { // 点击外部关闭
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) onClose();
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const searchFiles = useCallback(async (query: string) => { // 搜索文件
    if (!workspaceRoot || !query) return setResults([]);
    try {
      const allFiles = await window.mindcode?.fs?.getAllFiles?.(workspaceRoot);
      const matches = (allFiles || []).filter((f: string) => f.toLowerCase().includes(query.toLowerCase())).slice(0, 10);
      setResults(matches.map((f: string) => ({ id: f, label: f.split(/[/\\]/).pop() || f, type: 'file' as const, data: { path: f } })));
    } catch { setResults([]); }
  }, [workspaceRoot]);

  const searchFolders = useCallback(async (query: string) => { // 搜索目录
    if (!workspaceRoot) return setResults([]);
    const flattenFolders = (nodes: typeof fileTree, path = ''): string[] => nodes.flatMap(n => n.type === 'folder' ? [path + n.name, ...flattenFolders(n.children || [], path + n.name + '/')] : []);
    const folders = flattenFolders(fileTree);
    const matches = folders.filter(f => f.toLowerCase().includes(query.toLowerCase())).slice(0, 10);
    setResults(matches.map(f => ({ id: f, label: f, type: 'folder' as const, data: { path: workspaceRoot + '/' + f } })));
  }, [workspaceRoot, fileTree]);

  const searchSymbols = useCallback(async (query: string) => { // 搜索符号（简化实现）
    if (!workspaceRoot || !query) return setResults([]);
    try {
      const searchResult = await window.mindcode?.fs?.searchInFiles?.(workspaceRoot, `(function|class|const|let|var|interface|type)\\s+${query}`);
      const matches = (searchResult || []).slice(0, 10);
      setResults(matches.map((m: any) => ({ id: m.path + ':' + m.line, label: `${m.match} (${m.path.split(/[/\\]/).pop()}:${m.line})`, type: 'symbol' as const, data: { path: m.path, content: m.match, range: { start: m.line, end: m.line } } })));
    } catch { setResults([]); }
  }, [workspaceRoot]);

  useEffect(() => { // 搜索防抖
    const timer = setTimeout(() => {
      if (mode === 'file') searchFiles(search);
      else if (mode === 'folder') searchFolders(search);
      else if (mode === 'symbol') searchSymbols(search);
    }, 200);
    return () => clearTimeout(timer);
  }, [search, mode, searchFiles, searchFolders, searchSymbols]);

  const handleSelect = async (item: typeof results[0] | typeof menuItems[0]) => { // 选择项目
    if ('type' in item && item.type !== 'selection') {
      if (mode === 'menu') return setMode(item.type);
    }
    if (item.type === 'selection') { // 添加当前选区
      const activeFile = getActiveFile();
      if (activeFile && window.getSelection) {
        const selection = window.getSelection()?.toString() || '';
        if (selection) {
          addContext({ id: `sel-${Date.now()}`, type: 'selection', label: `选区 (${activeFile.name})`, data: { path: activeFile.path, content: selection } });
          onClose();
        }
      }
      return;
    }
    if ('data' in item) { // 添加文件/目录/符号上下文
      let content = '';
      if (item.type === 'file' && item.data.path) {
        try { content = await window.mindcode?.fs?.readFile?.(item.data.path) || ''; } catch {}
      }
      addContext({ id: `ctx-${Date.now()}`, type: item.type as any, label: item.label, data: { ...item.data, content } });
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { // 键盘导航
    const items = mode === 'menu' ? menuItems : results;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[selectedIndex]) handleSelect(items[selectedIndex] as any); }
    else if (e.key === 'Escape') { e.preventDefault(); mode === 'menu' ? onClose() : setMode('menu'); }
    else if (e.key === 'Backspace' && !search && mode !== 'menu') setMode('menu');
  };

  if (!isOpen) return null;

  const style: React.CSSProperties = position ? { position: 'fixed', left: position.x, top: position.y } : {};

  return (
    <div ref={pickerRef} className="context-picker" style={style}>
      <div className="context-picker-header">
        {mode !== 'menu' && <button className="context-picker-back" onClick={() => setMode('menu')}>←</button>}
        <input ref={searchRef} className="context-picker-search" value={search} onChange={e => { setSearch(e.target.value); setSelectedIndex(0); }} onKeyDown={handleKeyDown} placeholder={mode === 'menu' ? '选择上下文类型...' : `搜索${mode}...`} />
      </div>
      <div className="context-picker-list">
        {mode === 'menu' ? (
          menuItems.map((item, i) => (
            <div key={item.type} className={`context-picker-item ${i === selectedIndex ? 'selected' : ''}`} onClick={() => handleSelect(item)} onMouseEnter={() => setSelectedIndex(i)}>
              <span className="context-picker-icon">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))
        ) : results.length > 0 ? (
          results.map((item, i) => (
            <div key={item.id} className={`context-picker-item ${i === selectedIndex ? 'selected' : ''}`} onClick={() => handleSelect(item)} onMouseEnter={() => setSelectedIndex(i)}>
              <span className="context-picker-icon">{mode === 'file' ? '📄' : mode === 'folder' ? '📁' : '🔣'}</span>
              <span className="context-picker-label">{item.label}</span>
            </div>
          ))
        ) : search ? (
          <div className="context-picker-empty">未找到匹配项</div>
        ) : (
          <div className="context-picker-empty">输入关键词搜索</div>
        )}
      </div>
    </div>
  );
};

export default ContextPicker;
