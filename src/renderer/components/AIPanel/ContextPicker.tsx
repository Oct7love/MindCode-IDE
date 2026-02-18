import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAIStore, useFileStore } from "../../stores";
import "./ContextPicker.css";

type PickerMode =
  | "file"
  | "selection"
  | "folder"
  | "symbol"
  | "codebase"
  | "web"
  | "docs"
  | "git"
  | "menu";

interface ContextPickerProps {
  isOpen: boolean;
  onClose: () => void;
  position?: { x: number; y: number };
  inputRef?: React.RefObject<HTMLTextAreaElement>;
}

export const ContextPicker: React.FC<ContextPickerProps> = ({
  isOpen,
  onClose,
  position,
  inputRef: _inputRef,
}) => {
  const { addContext } = useAIStore();
  const { fileTree, workspaceRoot, getActiveFile } = useFileStore();
  const [mode, setMode] = useState<PickerMode>("menu");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<
    { id: string; label: string; type: PickerMode; data: any }[]
  >([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const menuItems = [
    { type: "file" as const, label: "@file - 选择文件", icon: "📄" },
    { type: "selection" as const, label: "@selection - 当前选区", icon: "✂️" },
    { type: "folder" as const, label: "@folder - 选择目录", icon: "📁" },
    { type: "symbol" as const, label: "@symbol - 搜索符号", icon: "🔣" },
    { type: "codebase" as const, label: "@codebase - 语义搜索", icon: "🔍" },
    { type: "web" as const, label: "@web - 网络搜索", icon: "🌐" },
    { type: "docs" as const, label: "@docs - 文档搜索", icon: "📚" },
    { type: "git" as const, label: "@git - Git历史", icon: "🔀" },
  ];

  useEffect(() => {
    // 聚焦搜索框
    if (isOpen && searchRef.current) setTimeout(() => searchRef.current?.focus(), 50);
    if (!isOpen) {
      setMode("menu");
      setSearch("");
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    // 点击外部关闭
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) onClose();
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  const searchFiles = useCallback(
    async (query: string) => {
      // 搜索文件
      if (!workspaceRoot || !query) return setResults([]);
      try {
        const response = await window.mindcode?.fs?.getAllFiles?.(workspaceRoot);
        const allFiles = response?.data || [];
        const matches = allFiles
          .filter((f: any) => {
            const filePath = typeof f === "string" ? f : f.path;
            return filePath.toLowerCase().includes(query.toLowerCase());
          })
          .slice(0, 10);
        setResults(
          matches.map((f: any) => {
            const filePath = typeof f === "string" ? f : f.path;
            const fileName = filePath.split(/[/\\]/).pop() || filePath;
            return {
              id: filePath,
              label: fileName,
              type: "file" as const,
              data: { path: filePath },
            };
          }),
        );
      } catch {
        setResults([]);
      }
    },
    [workspaceRoot],
  );

  const searchFolders = useCallback(
    async (query: string) => {
      // 搜索目录
      if (!workspaceRoot) return setResults([]);
      const flattenFolders = (nodes: typeof fileTree, path = ""): string[] =>
        nodes.flatMap((n) =>
          n.type === "folder"
            ? [path + n.name, ...flattenFolders(n.children || [], path + n.name + "/")]
            : [],
        );
      const folders = flattenFolders(fileTree);
      const matches = folders
        .filter((f) => f.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 10);
      setResults(
        matches.map((f) => ({
          id: f,
          label: f,
          type: "folder" as const,
          data: { path: workspaceRoot + "/" + f },
        })),
      );
    },
    [workspaceRoot, fileTree],
  );

  const searchSymbols = useCallback(
    async (query: string) => {
      // 搜索符号
      if (!workspaceRoot || !query) return setResults([]);
      try {
        const res = await window.mindcode?.index?.searchSymbols?.(query, 10);
        if (res?.success && res.data) {
          setResults(
            res.data.map((s: any) => ({
              id: s.id || s.name,
              label: `${s.kind || ""} ${s.name} (${s.filePath?.split(/[/\\]/).pop()}:${s.startLine})`,
              type: "symbol" as const,
              data: {
                path: s.filePath,
                content: s.signature || s.name,
                range: { start: s.startLine, end: s.endLine },
              },
            })),
          );
        }
      } catch {
        setResults([]);
      }
    },
    [workspaceRoot],
  );

  const searchCodebase = useCallback(
    async (query: string) => {
      // @codebase 语义搜索
      if (!workspaceRoot || !query) return setResults([]);
      setLoading(true);
      try {
        const res = await window.mindcode?.index?.getRelatedCode?.(query, 10);
        if (res?.success && res.data) {
          setResults(
            res.data.map((r: any, i: number) => ({
              id: `code-${i}`,
              label: `${r.filePath?.split(/[/\\]/).pop()} (相关度: ${Math.round(r.relevance * 100)}%)`,
              type: "codebase" as const,
              data: { path: r.filePath, content: r.code, relevance: r.relevance },
            })),
          );
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [workspaceRoot],
  );

  const searchWeb = useCallback(async (query: string) => {
    // @web 网络搜索（模拟）
    if (!query) return setResults([]);
    setLoading(true);
    // 实际实现需要调用搜索 API，这里添加占位
    const webResults = [
      {
        id: "web-1",
        label: `搜索: "${query}" (需要配置搜索API)`,
        type: "web" as const,
        data: { query, content: `网络搜索: ${query}` },
      },
    ];
    setResults(webResults);
    setLoading(false);
  }, []);

  const searchDocs = useCallback(
    async (query: string) => {
      // @docs 文档搜索
      if (!workspaceRoot || !query) return setResults([]);
      setLoading(true);
      try {
        // 搜索 .md 文件
        const res = await window.mindcode?.fs?.searchInFiles?.({
          workspacePath: workspaceRoot,
          query,
          maxResults: 10,
        });
        if (res?.success && res.data) {
          const mdFiles = res.data.filter((r: any) => r.file.endsWith(".md"));
          setResults(
            mdFiles.map((r: any) => ({
              id: r.file + ":" + r.line,
              label: `${r.relativePath}:${r.line}`,
              type: "docs" as const,
              data: { path: r.file, content: r.text, line: r.line },
            })),
          );
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [workspaceRoot],
  );

  const searchGit = useCallback(
    async (query: string) => {
      // @git Git历史
      if (!workspaceRoot) return setResults([]);
      setLoading(true);
      try {
        const res = await window.mindcode?.git?.log?.(workspaceRoot, 20);
        if (res?.success && res.data) {
          const filtered = query
            ? res.data.filter(
                (c: any) =>
                  c.message.toLowerCase().includes(query.toLowerCase()) ||
                  c.author.toLowerCase().includes(query.toLowerCase()),
              )
            : res.data;
          setResults(
            filtered.slice(0, 10).map((c: any) => ({
              id: c.hash,
              label: `${c.shortHash} - ${c.message.slice(0, 50)}`,
              type: "git" as const,
              data: {
                hash: c.hash,
                message: c.message,
                author: c.author,
                date: c.date,
                content: `提交: ${c.shortHash}\n作者: ${c.author}\n日期: ${c.date}\n\n${c.message}`,
              },
            })),
          );
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [workspaceRoot],
  );

  useEffect(() => {
    // 搜索防抖
    const timer = setTimeout(
      () => {
        if (mode === "file") searchFiles(search);
        else if (mode === "folder") searchFolders(search);
        else if (mode === "symbol") searchSymbols(search);
        else if (mode === "codebase") searchCodebase(search);
        else if (mode === "web") searchWeb(search);
        else if (mode === "docs") searchDocs(search);
        else if (mode === "git") searchGit(search);
      },
      mode === "codebase" || mode === "web" ? 500 : 200,
    ); // 语义搜索需要更长延迟
    return () => clearTimeout(timer);
  }, [
    search,
    mode,
    searchFiles,
    searchFolders,
    searchSymbols,
    searchCodebase,
    searchWeb,
    searchDocs,
    searchGit,
  ]);

  const handleSelect = async (item: (typeof results)[0] | (typeof menuItems)[0]) => {
    // 选择项目
    if ("type" in item && item.type !== "selection") {
      if (mode === "menu") return setMode(item.type);
    }
    if (item.type === "selection") {
      // 添加当前选区
      const activeFile = getActiveFile();
      if (activeFile && window.getSelection) {
        const selectionObj = window.getSelection();
        const selectionText = selectionObj?.toString() || "";
        if (selectionText) {
          addContext({
            id: `sel-${Date.now()}`,
            type: "selection",
            label: `选区 (${activeFile.name})`,
            data: { path: activeFile.path, content: selectionText },
          });
          onClose();
        }
      }
      return;
    }
    if ("data" in item) {
      // 添加上下文
      let content = item.data?.content || "";
      if (item.type === "file" && item.data.path && !content) {
        try {
          const res = await window.mindcode?.fs?.readFile?.(item.data.path);
          content = res?.success && res.data ? res.data : "";
        } catch {}
      } else if (item.type === "folder" && item.data.path && !content) {
        try {
          const res = await window.mindcode?.fs?.readDir?.(item.data.path);
          content =
            res?.success && res.data
              ? res.data
                  .map((f: any) => `${f.type === "folder" ? "📁" : "📄"} ${f.name}`)
                  .join("\n")
              : "";
        } catch {}
      }
      const iconMap: Record<string, string> = {
        file: "📄",
        folder: "📁",
        symbol: "🔣",
        codebase: "🔍",
        web: "🌐",
        docs: "📚",
        git: "🔀",
      };
      addContext({
        id: `ctx-${Date.now()}`,
        type: item.type as any,
        label: `${iconMap[item.type] || ""} ${item.label}`,
        data: { ...item.data, content },
      });
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 键盘导航
    const items = mode === "menu" ? menuItems : results;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[selectedIndex]) handleSelect(items[selectedIndex] as any);
    } else if (e.key === "Escape") {
      e.preventDefault();
      mode === "menu" ? onClose() : setMode("menu");
    } else if (e.key === "Backspace" && !search && mode !== "menu") setMode("menu");
  };

  if (!isOpen) return null;

  const style: React.CSSProperties = position
    ? { position: "fixed", left: position.x, top: position.y }
    : {};

  return (
    <div ref={pickerRef} className="context-picker" style={style}>
      <div className="context-picker-header">
        {mode !== "menu" && (
          <button className="context-picker-back" onClick={() => setMode("menu")}>
            ←
          </button>
        )}
        <input
          ref={searchRef}
          className="context-picker-search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder={mode === "menu" ? "选择上下文类型..." : `搜索${mode}...`}
        />
      </div>
      <div className="context-picker-list">
        {mode === "menu" ? (
          menuItems.map((item, i) => (
            <div
              key={item.type}
              className={`context-picker-item ${i === selectedIndex ? "selected" : ""}`}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span className="context-picker-icon">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))
        ) : loading ? (
          <div className="context-picker-loading">🔄 搜索中...</div>
        ) : results.length > 0 ? (
          results.map((item, i) => {
            const iconMap: Record<string, string> = {
              file: "📄",
              folder: "📁",
              symbol: "🔣",
              codebase: "🔍",
              web: "🌐",
              docs: "📚",
              git: "🔀",
            };
            return (
              <div
                key={item.id}
                className={`context-picker-item ${i === selectedIndex ? "selected" : ""}`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className="context-picker-icon">{iconMap[item.type] || "📄"}</span>
                <span className="context-picker-label">{item.label}</span>
              </div>
            );
          })
        ) : search ? (
          <div className="context-picker-empty">未找到匹配项</div>
        ) : (
          <div className="context-picker-empty">
            {mode === "codebase"
              ? "输入查询语义搜索代码"
              : mode === "web"
                ? "输入关键词搜索网络"
                : mode === "docs"
                  ? "搜索项目文档"
                  : mode === "git"
                    ? "搜索提交历史"
                    : "输入关键词搜索"}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContextPicker;
