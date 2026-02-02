/**
 * BookmarkManager - 书签系统
 * 行标记、快速跳转、持久化
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';

export interface Bookmark { id: string; filePath: string; line: number; label?: string; createdAt: number; }

const STORAGE_KEY = 'mindcode_bookmarks';

interface BookmarkManagerProps {
  currentFile?: string;
  currentLine?: number;
  onNavigate: (filePath: string, line: number) => void;
}

export const BookmarkManager: React.FC<BookmarkManagerProps> = ({ currentFile, currentLine, onNavigate }) => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [filter, setFilter] = useState('');

  // 加载书签
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setBookmarks(JSON.parse(stored));
  }, []);

  // 保存书签
  const saveBookmarks = useCallback((newBookmarks: Bookmark[]) => {
    setBookmarks(newBookmarks);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newBookmarks));
  }, []);

  // 添加书签
  const addBookmark = useCallback(() => {
    if (!currentFile || !currentLine) return;
    const exists = bookmarks.find(b => b.filePath === currentFile && b.line === currentLine);
    if (exists) return;
    const newBookmark: Bookmark = { id: `bm-${Date.now()}`, filePath: currentFile, line: currentLine, createdAt: Date.now() };
    saveBookmarks([...bookmarks, newBookmark]);
  }, [currentFile, currentLine, bookmarks, saveBookmarks]);

  // 删除书签
  const removeBookmark = useCallback((id: string) => {
    saveBookmarks(bookmarks.filter(b => b.id !== id));
  }, [bookmarks, saveBookmarks]);

  // 切换书签（当前行）
  const toggleBookmark = useCallback(() => {
    if (!currentFile || !currentLine) return;
    const exists = bookmarks.find(b => b.filePath === currentFile && b.line === currentLine);
    if (exists) removeBookmark(exists.id);
    else addBookmark();
  }, [currentFile, currentLine, bookmarks, addBookmark, removeBookmark]);

  // 更新标签
  const updateLabel = useCallback((id: string, label: string) => {
    saveBookmarks(bookmarks.map(b => b.id === id ? { ...b, label } : b));
  }, [bookmarks, saveBookmarks]);

  // 清空所有
  const clearAll = useCallback(() => { saveBookmarks([]); }, [saveBookmarks]);

  // 当前文件书签
  const currentFileBookmarks = useMemo(() => bookmarks.filter(b => b.filePath === currentFile), [bookmarks, currentFile]);

  // 检查当前行是否有书签
  const isCurrentLineBookmarked = useMemo(() => 
    currentFile && currentLine ? bookmarks.some(b => b.filePath === currentFile && b.line === currentLine) : false,
  [bookmarks, currentFile, currentLine]);

  // 过滤
  const filtered = useMemo(() => {
    if (!filter) return bookmarks;
    const lower = filter.toLowerCase();
    return bookmarks.filter(b => b.filePath.toLowerCase().includes(lower) || b.label?.toLowerCase().includes(lower));
  }, [bookmarks, filter]);

  // 按文件分组
  const grouped = useMemo(() => {
    const groups: Record<string, Bookmark[]> = {};
    for (const b of filtered) {
      const file = b.filePath.split(/[/\\]/).pop() || b.filePath;
      if (!groups[file]) groups[file] = [];
      groups[file].push(b);
    }
    return groups;
  }, [filtered]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 工具栏 */}
      <div style={{ padding: 8, borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 4 }}>
        <button onClick={toggleBookmark} disabled={!currentFile} title={isCurrentLineBookmarked ? '移除书签' : '添加书签'} style={{ flex: 1, padding: '6px', background: isCurrentLineBookmarked ? '#f59e0b' : 'var(--color-bg-hover)', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 11, color: 'inherit' }}>
          {isCurrentLineBookmarked ? '★ 移除' : '☆ 添加'}
        </button>
        <button onClick={clearAll} disabled={bookmarks.length === 0} title="清空所有" style={{ padding: '6px 10px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 11, color: 'var(--color-text-muted)' }}>清空</button>
      </div>

      {/* 搜索 */}
      <div style={{ padding: 8, borderBottom: '1px solid var(--color-border)' }}>
        <input type="text" value={filter} onChange={e => setFilter(e.target.value)} placeholder="筛选书签..." style={{ width: '100%', padding: '6px 8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 12, color: 'inherit' }} />
      </div>

      {/* 书签列表 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {Object.keys(grouped).length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>无书签</div>
        ) : (
          Object.entries(grouped).map(([file, bms]) => (
            <div key={file}>
              <div style={{ padding: '6px 12px', background: 'var(--color-bg-base)', fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500 }}>{file}</div>
              {bms.sort((a, b) => a.line - b.line).map(bm => (
                <div key={bm.id} onClick={() => onNavigate(bm.filePath, bm.line)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)', background: bm.filePath === currentFile && bm.line === currentLine ? 'var(--color-bg-hover)' : 'transparent' }}>
                  <span style={{ color: '#f59e0b', fontSize: 12 }}>★</span>
                  <span style={{ flex: 1, fontSize: 12 }}>{bm.label || `第 ${bm.line} 行`}</span>
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>:{bm.line}</span>
                  <button onClick={e => { e.stopPropagation(); removeBookmark(bm.id); }} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 10, padding: 0 }}>✕</button>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// 导出书签操作 hooks
export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setBookmarks(JSON.parse(stored));
  }, []);

  const getBookmarksForFile = useCallback((filePath: string) => bookmarks.filter(b => b.filePath === filePath), [bookmarks]);
  const hasBookmark = useCallback((filePath: string, line: number) => bookmarks.some(b => b.filePath === filePath && b.line === line), [bookmarks]);

  return { bookmarks, getBookmarksForFile, hasBookmark };
}

export default BookmarkManager;
