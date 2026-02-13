/**
 * QuickOpen - 快速打开文件
 * Ctrl+P 快速搜索并打开文件
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";

export interface FileItem {
  path: string;
  name: string;
  dir: string;
  icon?: string;
  recent?: boolean;
}

interface QuickOpenProps {
  isOpen: boolean;
  onClose: () => void;
  files: FileItem[];
  onSelect: (file: FileItem) => void;
  recentFiles?: string[];
}

export const QuickOpen: React.FC<QuickOpenProps> = ({
  isOpen,
  onClose,
  files,
  onSelect,
  recentFiles = [],
}) => {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 重置状态
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSelectedIndex(0);
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // 文件图标
  const getIcon = (name: string): string => {
    const ext = name.split(".").pop()?.toLowerCase();
    const icons: Record<string, string> = {
      ts: "🔷",
      tsx: "⚛️",
      js: "📜",
      jsx: "⚛️",
      json: "📋",
      md: "📝",
      css: "🎨",
      html: "🌐",
      py: "🐍",
      rs: "🦀",
      go: "🐹",
      c: "©️",
      cpp: "©️",
      h: "📎",
      java: "☕",
      rb: "💎",
      php: "🐘",
      sql: "🗃️",
      sh: "📟",
      yml: "⚙️",
      yaml: "⚙️",
      xml: "📰",
      svg: "🖼️",
      png: "🖼️",
      jpg: "🖼️",
      gif: "🖼️",
    };
    return icons[ext || ""] || "📄";
  };

  // 模糊匹配评分
  const fuzzyScore = (str: string, query: string): number => {
    const lower = str.toLowerCase();
    const q = query.toLowerCase();
    if (lower === q) return 1000;
    if (lower.startsWith(q)) return 500;
    if (lower.includes(q)) return 100;
    // 简单模糊匹配
    let score = 0,
      qi = 0;
    for (let i = 0; i < lower.length && qi < q.length; i++) {
      if (lower[i] === q[qi]) {
        score += 10;
        qi++;
      }
    }
    return qi === q.length ? score : 0;
  };

  // 过滤和排序
  const filtered = useMemo(() => {
    const result = files.map((f) => ({
      ...f,
      icon: f.icon || getIcon(f.name),
      recent: recentFiles.includes(f.path),
    }));

    if (!search) {
      // 无搜索时，显示最近文件优先
      return result
        .sort((a, b) => {
          if (a.recent && !b.recent) return -1;
          if (!a.recent && b.recent) return 1;
          return a.name.localeCompare(b.name);
        })
        .slice(0, 50);
    }

    // 有搜索时，模糊匹配
    return result
      .map((f) => ({
        ...f,
        score: Math.max(fuzzyScore(f.name, search), fuzzyScore(f.path, search) * 0.5),
      }))
      .filter((f) => f.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);
  }, [files, search, recentFiles]);

  // 确保选中项可见
  useEffect(() => {
    if (selectedIndex >= filtered.length) setSelectedIndex(Math.max(0, filtered.length - 1));
    const item = listRef.current?.children[selectedIndex] as HTMLElement;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, filtered.length]);

  // 选择文件
  const selectFile = useCallback(
    (file: FileItem) => {
      onClose();
      onSelect(file);
    },
    [onClose, onSelect],
  );

  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[selectedIndex]) selectFile(filtered[selectedIndex]);
        break;
      case "Escape":
        onClose();
        break;
    }
  };

  // 跳转到行号
  const goToLine = search.match(/^:(\d+)$/);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "15vh",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "50vw",
          maxWidth: 600,
          background: "var(--color-bg-elevated)",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid var(--color-border)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        {/* 搜索框 */}
        <div style={{ padding: 12, borderBottom: "1px solid var(--color-border)" }}>
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="输入文件名搜索... (输入 : 跳转到行)"
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "var(--color-bg-base)",
              border: "1px solid var(--color-border)",
              borderRadius: 6,
              fontSize: 14,
              color: "inherit",
              outline: "none",
            }}
          />
        </div>

        {/* 文件列表 */}
        <div ref={listRef} style={{ maxHeight: 400, overflow: "auto" }}>
          {goToLine ? (
            <div
              style={{
                padding: 16,
                textAlign: "center",
                color: "var(--color-text-muted)",
                fontSize: 13,
              }}
            >
              按 Enter 跳转到第 {goToLine[1]} 行
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                padding: 16,
                textAlign: "center",
                color: "var(--color-text-muted)",
                fontSize: 13,
              }}
            >
              无匹配文件
            </div>
          ) : (
            filtered.map((file, idx) => (
              <div
                key={file.path}
                onClick={() => selectFile(file)}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 16px",
                  cursor: "pointer",
                  background: idx === selectedIndex ? "var(--color-bg-hover)" : "transparent",
                }}
              >
                <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{file.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {file.name}
                    {file.recent && (
                      <span
                        style={{ marginLeft: 8, fontSize: 10, color: "var(--color-text-muted)" }}
                      >
                        最近
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--color-text-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {file.dir}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default QuickOpen;
