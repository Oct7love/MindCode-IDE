import React, { useRef, useEffect, useState, useCallback } from "react";
import * as monaco from "monaco-editor";
import { useCompletion } from "../hooks/useCompletion";
import { useLSP } from "../hooks/useLSP";
import "./Editor.css";

// 获取文件语言类型
const _getLanguageByFilename = (filename: string): string => {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    css: "css",
    scss: "scss",
    less: "less",
    html: "html",
    md: "markdown",
    py: "python",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    sh: "shell",
    bash: "shell",
    yaml: "yaml",
    yml: "yaml",
    xml: "xml",
    sql: "sql",
    graphql: "graphql",
    vue: "vue",
    svelte: "svelte",
  };
  return languageMap[ext] || "plaintext";
};

interface TabInfo {
  id: string;
  filename: string;
  content: string;
  language: string;
  modified: boolean;
}

interface EditorProps {
  initialTabs?: TabInfo[];
  onTabChange?: (tab: TabInfo) => void;
  onContentChange?: (tabId: string, content: string) => void;
  onSave?: (tabId: string, content: string) => void;
  workspacePath?: string | null; // 工作区路径(LSP需要)
  onLSPStatusChange?: (status: { connected: boolean; language: string | null }) => void; // LSP状态回调
}

const Editor: React.FC<EditorProps> = ({
  initialTabs,
  onTabChange,
  onContentChange,
  onSave,
  workspacePath,
  onLSPStatusChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const completionDisposableRef = useRef<monaco.IDisposable | null>(null);

  // 代码补全 Hook
  const { enabled: _completionEnabled, registerProvider } = useCompletion();

  // LSP 语言服务器 Hook - 提供定义跳转/Hover/诊断
  const lspState = useLSP(editorRef.current, { workspacePath, enabled: !!workspacePath });

  // 通知父组件 LSP 状态变化
  useEffect(() => {
    onLSPStatusChange?.({ connected: lspState.connected, language: lspState.language });
  }, [lspState.connected, lspState.language, onLSPStatusChange]);

  const [tabs, setTabs] = useState<TabInfo[]>(
    initialTabs || [
      {
        id: "welcome",
        filename: "Welcome",
        content: `// 欢迎使用 MindCode！
//
// MindCode 是一个 AI 原生的代码编辑器
//
// 快捷键：
//   Ctrl+L  - 打开 AI 对话
//   Ctrl+K  - 内联编辑（即将支持）
//   Ctrl+P  - 快速打开文件
//   Ctrl+S  - 保存文件
//
// 开始编码吧！

function hello() {
  console.log("Hello, MindCode!");
}

hello();
`,
        language: "typescript",
        modified: false,
      },
    ],
  );

  const [activeTabId, setActiveTabId] = useState<string>(tabs[0]?.id || "");

  // 初始化 Monaco 编辑器
  useEffect(() => {
    if (!containerRef.current) return;

    // 设置 Monaco 主题
    monaco.editor.defineTheme("mindcode-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6A9955", fontStyle: "italic" },
        { token: "keyword", foreground: "569CD6" },
        { token: "string", foreground: "CE9178" },
        { token: "number", foreground: "B5CEA8" },
        { token: "type", foreground: "4EC9B0" },
        { token: "function", foreground: "DCDCAA" },
        { token: "variable", foreground: "9CDCFE" },
      ],
      colors: {
        "editor.background": "#1e1e1e",
        "editor.foreground": "#d4d4d4",
        "editor.lineHighlightBackground": "#2d2d2d",
        "editorLineNumber.foreground": "#858585",
        "editorLineNumber.activeForeground": "#c6c6c6",
        "editor.selectionBackground": "#264f78",
        "editor.inactiveSelectionBackground": "#3a3d41",
        "editorCursor.foreground": "#aeafad",
        "editorWhitespace.foreground": "#3b3b3b",
      },
    });

    const activeTab = tabs.find((t) => t.id === activeTabId);

    const editor = monaco.editor.create(containerRef.current, {
      value: activeTab?.content || "",
      language: activeTab?.language || "typescript",
      theme: "vs-dark", // 初始主题，会在主题加载后更新
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
      fontLigatures: true,
      lineNumbers: "on",
      minimap: { enabled: true, scale: 1, showSlider: "mouseover" },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      wordWrap: "off",
      folding: true,
      lineDecorationsWidth: 10,
      lineNumbersMinChars: 4,
      renderLineHighlight: "all",
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on",
      smoothScrolling: true,
      padding: { top: 8, bottom: 8 },
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        indentation: true,
      },
      suggest: {
        showKeywords: true,
        showSnippets: true,
        showClasses: true,
        showFunctions: true,
        showVariables: true,
      },
      // 启用 Inline Suggestions (代码补全)
      inlineSuggest: {
        enabled: true,
        mode: "prefix",
        showToolbar: "onHover",
      },
      quickSuggestions: {
        other: true,
        comments: false,
        strings: false,
      },
    });

    editorRef.current = editor;

    // 监听内容变化
    editor.onDidChangeModelContent(() => {
      const value = editor.getValue();
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTabId ? { ...tab, content: value, modified: true } : tab,
        ),
      );
      onContentChange?.(activeTabId, value);
    });

    // 保存快捷键 Ctrl+S
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const value = editor.getValue();
      setTabs((prev) =>
        prev.map((tab) => (tab.id === activeTabId ? { ...tab, modified: false } : tab)),
      );
      onSave?.(activeTabId, value);
    });

    // 监听主题变化
    const handleThemeChange = (event: CustomEvent<{ themeId: string; editorTheme: string }>) => {
      if (editorRef.current) {
        monaco.editor.setTheme(event.detail.editorTheme);
      }
    };
    window.addEventListener("theme-changed", handleThemeChange as EventListener);

    // 加载当前主题
    import("../utils/themes").then(({ loadTheme, getTheme }) => {
      loadTheme().then((themeId) => {
        const theme = getTheme(themeId);
        if (theme) {
          monaco.editor.setTheme(theme.editorThemeRef);
        }
      });
    });

    return () => {
      editor.dispose();
      window.removeEventListener("theme-changed", handleThemeChange as EventListener);
    };
  }, []);

  // 单独的 useEffect 来注册补全 Provider
  useEffect(() => {
    if (editorRef.current) {
      // 清理旧的 provider
      if (completionDisposableRef.current) {
        completionDisposableRef.current.dispose();
      }
      // 注册新的 provider
      completionDisposableRef.current = registerProvider(monaco);
    }

    return () => {
      if (completionDisposableRef.current) {
        completionDisposableRef.current.dispose();
        completionDisposableRef.current = null;
      }
    };
  }, [registerProvider]);

  // 切换标签时更新编辑器内容
  useEffect(() => {
    if (editorRef.current) {
      const activeTab = tabs.find((t) => t.id === activeTabId);
      if (activeTab) {
        const model = editorRef.current.getModel();
        if (model) {
          model.setValue(activeTab.content);
          monaco.editor.setModelLanguage(model, activeTab.language);
        }
        onTabChange?.(activeTab);
      }
    }
  }, [activeTabId, tabs, onTabChange]);

  // 关闭标签
  const closeTab = useCallback(
    (tabId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setTabs((prev) => {
        const newTabs = prev.filter((t) => t.id !== tabId);
        if (activeTabId === tabId && newTabs.length > 0) {
          setActiveTabId(newTabs[0].id);
        }
        return newTabs;
      });
    },
    [activeTabId],
  );

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="monaco-editor-container">
      {/* 标签栏 */}
      <div className="editor-tabs-bar">
        <div className="editor-tabs-scroll">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`editor-tab ${tab.id === activeTabId ? "active" : ""}`}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span className="tab-icon">{getFileIcon(tab.filename)}</span>
              <span className="tab-label">
                {tab.filename}
                {tab.modified && <span className="tab-modified">●</span>}
              </span>
              <button className="tab-close-btn" onClick={(e) => closeTab(tab.id, e)}>
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Monaco 编辑器区域 */}
      <div className="monaco-wrapper" ref={containerRef} />

      {/* 面包屑导航 */}
      <div className="editor-breadcrumb">
        <span className="breadcrumb-item">{activeTab?.filename}</span>
      </div>
    </div>
  );
};

// 获取文件图标颜色
function getFileIcon(filename: string): React.ReactNode {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const colorMap: Record<string, string> = {
    ts: "#3178c6",
    tsx: "#3178c6",
    js: "#f1e05a",
    jsx: "#f1e05a",
    json: "#cbcb41",
    css: "#563d7c",
    scss: "#c6538c",
    html: "#e34c26",
    md: "#083fa1",
    py: "#3572a5",
    go: "#00add8",
    rs: "#dea584",
  };
  const color = colorMap[ext] || "#8b8b8b";

  return (
    <svg viewBox="0 0 16 16" fill={color} width="14" height="14">
      <path d="M10.5 1H3.5C2.67 1 2 1.67 2 2.5v11c0 .83.67 1.5 1.5 1.5h9c.83 0 1.5-.67 1.5-1.5V4.5L10.5 1zm2.5 12.5c0 .28-.22.5-.5.5h-9c-.28 0-.5-.22-.5-.5v-11c0-.28.22-.5.5-.5H10v3h3v8.5z" />
    </svg>
  );
}

export default Editor;
