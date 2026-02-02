/**
 * SearchReplace - 搜索替换面板
 * 支持正则、大小写、全词匹配
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';

export interface SearchMatch { line: number; column: number; length: number; text: string; }
export interface SearchOptions { caseSensitive: boolean; wholeWord: boolean; regex: boolean; }

interface SearchReplaceProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  onReplace?: (matches: SearchMatch[], replacement: string, replaceAll: boolean) => void;
  onNavigate?: (line: number, column: number) => void;
}

export const SearchReplace: React.FC<SearchReplaceProps> = ({ isOpen, onClose, content, onReplace, onNavigate }) => {
  const [search, setSearch] = useState('');
  const [replace, setReplace] = useState('');
  const [options, setOptions] = useState<SearchOptions>({ caseSensitive: false, wholeWord: false, regex: false });
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 聚焦输入框
  useEffect(() => { if (isOpen) inputRef.current?.focus(); }, [isOpen]);

  // 搜索
  useEffect(() => {
    if (!search) { setMatches([]); setError(null); return; }
    try {
      const results: SearchMatch[] = [];
      let pattern: RegExp;
      if (options.regex) {
        pattern = new RegExp(search, options.caseSensitive ? 'g' : 'gi');
      } else {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordPattern = options.wholeWord ? `\\b${escaped}\\b` : escaped;
        pattern = new RegExp(wordPattern, options.caseSensitive ? 'g' : 'gi');
      }
      const lines = content.split('\n');
      lines.forEach((line, lineIdx) => {
        let match;
        while ((match = pattern.exec(line)) !== null) {
          results.push({ line: lineIdx + 1, column: match.index + 1, length: match[0].length, text: match[0] });
          if (!pattern.global) break;
        }
      });
      setMatches(results);
      setCurrentIndex(0);
      setError(null);
    } catch (e: any) { setError(e.message); setMatches([]); }
  }, [search, content, options]);

  // 导航到当前匹配
  useEffect(() => {
    if (matches.length > 0 && onNavigate) {
      const match = matches[currentIndex];
      onNavigate(match.line, match.column);
    }
  }, [currentIndex, matches, onNavigate]);

  const nextMatch = () => { if (matches.length > 0) setCurrentIndex(prev => (prev + 1) % matches.length); };
  const prevMatch = () => { if (matches.length > 0) setCurrentIndex(prev => (prev - 1 + matches.length) % matches.length); };

  const handleReplace = useCallback(() => { if (matches.length > 0 && onReplace) onReplace([matches[currentIndex]], replace, false); }, [matches, currentIndex, replace, onReplace]);
  const handleReplaceAll = useCallback(() => { if (matches.length > 0 && onReplace) onReplace(matches, replace, true); }, [matches, replace, onReplace]);

  const toggleOption = (key: keyof SearchOptions) => { setOptions(prev => ({ ...prev, [key]: !prev[key] })); };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'absolute', top: 10, right: 10, width: 350, background: 'var(--color-bg-elevated)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', border: '1px solid var(--color-border)', zIndex: 100 }}>
      {/* 搜索行 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 8, borderBottom: '1px solid var(--color-border)' }}>
        <input ref={inputRef} type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索..." style={{ flex: 1, padding: '6px 8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 12, color: 'inherit' }} onKeyDown={e => { if (e.key === 'Enter') nextMatch(); if (e.key === 'Escape') onClose(); }} />
        <button onClick={() => toggleOption('caseSensitive')} title="区分大小写" style={{ padding: '4px 8px', background: options.caseSensitive ? 'var(--color-accent-primary)' : 'transparent', border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', fontSize: 11, color: 'inherit' }}>Aa</button>
        <button onClick={() => toggleOption('wholeWord')} title="全词匹配" style={{ padding: '4px 8px', background: options.wholeWord ? 'var(--color-accent-primary)' : 'transparent', border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', fontSize: 11, color: 'inherit' }}>W</button>
        <button onClick={() => toggleOption('regex')} title="正则表达式" style={{ padding: '4px 8px', background: options.regex ? 'var(--color-accent-primary)' : 'transparent', border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', fontSize: 11, color: 'inherit' }}>.*</button>
      </div>

      {/* 替换行 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 8, borderBottom: '1px solid var(--color-border)' }}>
        <input type="text" value={replace} onChange={e => setReplace(e.target.value)} placeholder="替换为..." style={{ flex: 1, padding: '6px 8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 12, color: 'inherit' }} />
        <button onClick={handleReplace} disabled={matches.length === 0} style={{ padding: '4px 8px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', fontSize: 11, color: 'inherit', opacity: matches.length === 0 ? 0.5 : 1 }}>替换</button>
        <button onClick={handleReplaceAll} disabled={matches.length === 0} style={{ padding: '4px 8px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', fontSize: 11, color: 'inherit', opacity: matches.length === 0 ? 0.5 : 1 }}>全部</button>
      </div>

      {/* 结果/导航 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 8 }}>
        <span style={{ fontSize: 11, color: error ? '#ef4444' : 'var(--color-text-muted)' }}>
          {error ? `错误: ${error}` : matches.length > 0 ? `${currentIndex + 1} / ${matches.length} 个结果` : search ? '无结果' : '输入搜索内容'}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={prevMatch} disabled={matches.length === 0} style={{ padding: '2px 8px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', fontSize: 11, color: 'inherit' }}>↑</button>
          <button onClick={nextMatch} disabled={matches.length === 0} style={{ padding: '2px 8px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', fontSize: 11, color: 'inherit' }}>↓</button>
          <button onClick={onClose} style={{ padding: '2px 8px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', fontSize: 11, color: 'inherit' }}>✕</button>
        </div>
      </div>
    </div>
  );
};

export default SearchReplace;
