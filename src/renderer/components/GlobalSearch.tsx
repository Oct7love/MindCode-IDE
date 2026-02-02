/**
 * GlobalSearch - 全局搜索面板
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';

interface SearchResult { file: string; line: number; column: number; content: string; matchStart: number; matchEnd: number; }
interface GlobalSearchProps { workspacePath: string; onOpenFile: (path: string, line?: number, column?: number) => void; onSearch: (query: string, options: SearchOptions) => Promise<SearchResult[]>; }
interface SearchOptions { caseSensitive: boolean; wholeWord: boolean; regex: boolean; include: string; exclude: string; }

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ onOpenFile, onSearch }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<SearchOptions>({ caseSensitive: false, wholeWord: false, regex: false, include: '', exclude: 'node_modules,dist,.git' });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const search = useCallback(async () => {
    if (!query.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await onSearch(query, options);
      setResults(res);
      const files = new Set(res.map(r => r.file));
      setExpanded(files);
    } catch (e) { console.error('[GlobalSearch]', e); }
    finally { setLoading(false); }
  }, [query, options, onSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') search(); };

  const groupedResults = results.reduce((acc, r) => {
    if (!acc[r.file]) acc[r.file] = [];
    acc[r.file].push(r);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  const toggleFile = (file: string) => {
    const next = new Set(expanded);
    next.has(file) ? next.delete(file) : next.add(file);
    setExpanded(next);
  };

  const highlightMatch = (content: string, start: number, end: number) => (
    <span>{content.slice(0, start)}<mark className="bg-[var(--color-warning)] text-black px-0.5 rounded">{content.slice(start, end)}</mark>{content.slice(end)}</span>
  );

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
      <div className="p-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2 mb-2">
          <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown} placeholder="搜索..." className="flex-1 px-3 py-1.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded text-sm focus:border-[var(--color-accent-primary)] outline-none" />
          <button onClick={search} disabled={loading} className="px-3 py-1.5 bg-[var(--color-accent-primary)] text-white rounded text-sm hover:opacity-90 disabled:opacity-50">{loading ? '...' : '搜索'}</button>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={options.caseSensitive} onChange={e => setOptions({ ...options, caseSensitive: e.target.checked })} className="w-3 h-3" /><span>区分大小写</span></label>
          <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={options.wholeWord} onChange={e => setOptions({ ...options, wholeWord: e.target.checked })} className="w-3 h-3" /><span>全字匹配</span></label>
          <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={options.regex} onChange={e => setOptions({ ...options, regex: e.target.checked })} className="w-3 h-3" /><span>正则</span></label>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs">
          <input type="text" value={options.include} onChange={e => setOptions({ ...options, include: e.target.value })} placeholder="包含文件 (*.ts,*.tsx)" className="flex-1 px-2 py-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded" />
          <input type="text" value={options.exclude} onChange={e => setOptions({ ...options, exclude: e.target.value })} placeholder="排除文件" className="flex-1 px-2 py-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded" />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {results.length === 0 && !loading && query && <div className="p-4 text-center text-[var(--color-text-muted)] text-sm">未找到结果</div>}
        {Object.entries(groupedResults).map(([file, matches]) => (
          <div key={file} className="border-b border-[var(--color-border)]">
            <div onClick={() => toggleFile(file)} className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--color-bg-hover)] cursor-pointer">
              <span className="text-xs">{expanded.has(file) ? '▼' : '▶'}</span>
              <span className="flex-1 text-sm text-[var(--color-accent-primary)] truncate">{file.split('/').pop()}</span>
              <span className="text-xs text-[var(--color-text-muted)]">{matches.length}</span>
            </div>
            {expanded.has(file) && matches.map((m, i) => (
              <div key={i} onClick={() => onOpenFile(file, m.line, m.column)} className="flex items-center gap-2 px-6 py-1 hover:bg-[var(--color-bg-hover)] cursor-pointer text-xs">
                <span className="text-[var(--color-text-muted)] w-8 text-right">{m.line}</span>
                <span className="text-[var(--color-text-secondary)] truncate font-mono">{highlightMatch(m.content.trim(), m.matchStart, m.matchEnd)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      {results.length > 0 && <div className="px-3 py-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">{results.length} 个结果，{Object.keys(groupedResults).length} 个文件</div>}
    </div>
  );
};

export default GlobalSearch;
