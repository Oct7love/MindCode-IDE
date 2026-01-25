/**
 * MindCode - Monaco 代码编辑器组件
 * 基于 Monaco Editor 的专业代码编辑器
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as monaco from 'monaco-editor';
import { InlineEditWidget } from './InlineEditWidget';

// 配置 Monaco Worker - 使用 Vite 兼容的静态导入方式
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

self.MonacoEnvironment = {
  getWorker: function (_moduleId: string, label: string) {
    switch (label) {
      case 'json':
        return new jsonWorker();
      case 'css':
      case 'scss':
      case 'less':
        return new cssWorker();
      case 'html':
      case 'handlebars':
      case 'razor':
        return new htmlWorker();
      case 'typescript':
      case 'javascript':
        return new tsWorker();
      default:
        return new editorWorker();
    }
  },
};

// 定义 MindCode 主题
monaco.editor.defineTheme('mindcode-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'C586C0' },
    { token: 'string', foreground: 'CE9178' },
    { token: 'number', foreground: 'B5CEA8' },
    { token: 'regexp', foreground: 'D16969' },
    { token: 'type', foreground: '4EC9B0' },
    { token: 'class', foreground: '4EC9B0' },
    { token: 'function', foreground: 'DCDCAA' },
    { token: 'variable', foreground: '9CDCFE' },
    { token: 'variable.predefined', foreground: '4FC1FF' },
    { token: 'constant', foreground: '4FC1FF' },
    { token: 'parameter', foreground: '9CDCFE' },
    { token: 'property', foreground: '9CDCFE' },
    { token: 'punctuation', foreground: 'D4D4D4' },
    { token: 'operator', foreground: 'D4D4D4' },
    { token: 'tag', foreground: '569CD6' },
    { token: 'attribute.name', foreground: '9CDCFE' },
    { token: 'attribute.value', foreground: 'CE9178' },
  ],
  colors: {
    'editor.background': '#0D0D0D',
    'editor.foreground': '#E5E5E5',
    'editor.lineHighlightBackground': '#1A1A1A',
    'editor.lineHighlightBorder': '#1A1A1A',
    'editor.selectionBackground': '#264F78',
    'editor.selectionHighlightBackground': '#264F7855',
    'editor.inactiveSelectionBackground': '#264F7855',
    'editorCursor.foreground': '#AEAFAD',
    'editorWhitespace.foreground': '#333333',
    'editorIndentGuide.background': '#333333',
    'editorIndentGuide.activeBackground': '#525252',
    'editorLineNumber.foreground': '#525252',
    'editorLineNumber.activeForeground': '#A3A3A3',
    'editorGutter.background': '#0D0D0D',
    'editor.findMatchBackground': '#515C6A',
    'editor.findMatchHighlightBackground': '#314365',
    'editorBracketMatch.background': '#0064001A',
    'editorBracketMatch.border': '#888888',
    'editorOverviewRuler.border': '#1A1A1A',
    'editorWidget.background': '#1A1A1A',
    'editorWidget.border': '#262626',
    'editorSuggestWidget.background': '#1A1A1A',
    'editorSuggestWidget.border': '#262626',
    'editorSuggestWidget.selectedBackground': '#094771',
    'editorHoverWidget.background': '#1A1A1A',
    'editorHoverWidget.border': '#262626',
    'peekView.border': '#6366F1',
    'peekViewEditor.background': '#141414',
    'peekViewResult.background': '#1A1A1A',
    'peekViewTitle.background': '#1A1A1A',
    'scrollbar.shadow': '#00000000',
    'scrollbarSlider.background': '#79797966',
    'scrollbarSlider.hoverBackground': '#646464B3',
    'scrollbarSlider.activeBackground': '#BFBFBF66',
  },
});

// 获取语言 ID
const getLanguageFromPath = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    md: 'markdown',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    rb: 'ruby',
    php: 'php',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    yml: 'yaml',
    yaml: 'yaml',
    xml: 'xml',
    svg: 'xml',
    vue: 'vue',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    dart: 'dart',
    lua: 'lua',
    r: 'r',
    perl: 'perl',
    dockerfile: 'dockerfile',
  };
  return languageMap[ext] || 'plaintext';
};

interface EditorFile {
  path: string;
  content: string;
  language?: string;
}

interface CodeEditorProps {
  file?: EditorFile;
  onContentChange?: (content: string) => void;
  onSave?: (content: string) => void;
  readOnly?: boolean;
  minimap?: boolean;
  lineNumbers?: 'on' | 'off' | 'relative';
  wordWrap?: 'on' | 'off' | 'wordWrapColumn' | 'bounded';
  fontSize?: number;
  enableGhostText?: boolean; // 启用 Ghost Text 补全
  completionModel?: string; // 补全使用的模型
  onAIEdit?: (prompt: string, code: string, callbacks: {
    onToken: (token: string) => void;
    onComplete: (result: string) => void;
    onError: (error: string) => void;
  }) => void;
}

// AI 代码补全提供者
let inlineCompletionDisposable: monaco.IDisposable | null = null;
let lastCompletionRequest: AbortController | null = null;
const completionCache = new Map<string, string>();

const createInlineCompletionProvider = (model: string): monaco.languages.InlineCompletionsProvider => ({
  provideInlineCompletions: async (monacoModel, position, context, token) => {
    const textUntilPosition = monacoModel.getValueInRange({ startLineNumber: Math.max(1, position.lineNumber - 20), startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column });
    const textAfterPosition = monacoModel.getValueInRange({ startLineNumber: position.lineNumber, startColumn: position.column, endLineNumber: Math.min(monacoModel.getLineCount(), position.lineNumber + 5), endColumn: 1000 });
    
    if (!textUntilPosition.trim() || textUntilPosition.endsWith(' ') && !textUntilPosition.trim().endsWith('.')) return { items: [] }; // 空行或只有空格不触发
    
    const cacheKey = `${monacoModel.uri.toString()}:${position.lineNumber}:${position.column}:${textUntilPosition.slice(-50)}`;
    if (completionCache.has(cacheKey)) return { items: [{ insertText: completionCache.get(cacheKey)!, range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column) }] };
    
    if (lastCompletionRequest) lastCompletionRequest.abort();
    lastCompletionRequest = new AbortController();
    
    if (!window.mindcode?.ai?.chat) return { items: [] };
    
    try {
      const prompt = `你是代码补全助手。只返回补全的代码，不要解释。补全以下代码：\n\n${textUntilPosition}`;
      const response = await window.mindcode.ai.chat(model, [{ role: 'user', content: prompt }]);
      if (token.isCancellationRequested || !response.success) return { items: [] };
      
      let completion = response.data || '';
      completion = completion.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim(); // 移除代码块标记
      if (completion.startsWith(textUntilPosition.slice(-20))) completion = completion.slice(textUntilPosition.slice(-20).length); // 移除重复前缀
      
      if (completion && completion.length > 0 && completion.length < 500) {
        completionCache.set(cacheKey, completion);
        if (completionCache.size > 100) completionCache.delete(completionCache.keys().next().value); // LRU 清理
        return { items: [{ insertText: completion, range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column) }] };
      }
    } catch (e) { /* 忽略错误 */ }
    return { items: [] };
  },
  freeInlineCompletions: () => {},
});

export const CodeEditor: React.FC<CodeEditorProps> = ({
  file,
  onContentChange,
  onSave,
  readOnly = false,
  minimap = true,
  lineNumbers = 'on',
  wordWrap = 'off',
  fontSize = 14,
  enableGhostText = true,
  completionModel = 'gemini-2.5-flash-lite', // 使用 Gemini 2.5 Flash Lite 做代码补全
  onAIEdit,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [isReady, setIsReady] = useState(false);

  // 内联编辑状态
  const [showInlineEdit, setShowInlineEdit] = useState(false);
  const [inlineEditPosition, setInlineEditPosition] = useState({ top: 0, left: 0 });
  const [selectedCode, setSelectedCode] = useState('');
  const [selectionRange, setSelectionRange] = useState<monaco.Range | null>(null);

  // 注册 Ghost Text 补全提供者
  useEffect(() => {
    if (!enableGhostText) return;
    inlineCompletionDisposable?.dispose();
    inlineCompletionDisposable = monaco.languages.registerInlineCompletionsProvider('*', createInlineCompletionProvider(completionModel));
    return () => { inlineCompletionDisposable?.dispose(); inlineCompletionDisposable = null; };
  }, [enableGhostText, completionModel]);

  // 初始化编辑器
  useEffect(() => {
    if (!containerRef.current) return;

    const editor = monaco.editor.create(containerRef.current, {
      value: file?.content || '',
      language: file?.language || getLanguageFromPath(file?.path || ''),
      theme: 'mindcode-dark',
      readOnly,
      minimap: { enabled: minimap },
      lineNumbers,
      wordWrap,
      fontSize,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace",
      fontLigatures: true,
      renderWhitespace: 'selection',
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      automaticLayout: true,
      padding: { top: 16, bottom: 16 },
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        indentation: true,
        highlightActiveIndentation: true,
      },
      suggest: {
        showKeywords: true,
        showSnippets: true,
        showClasses: true,
        showFunctions: true,
        showVariables: true,
        showConstants: true,
      },
      quickSuggestions: {
        other: true,
        comments: false,
        strings: false,
      },
      inlineSuggest: { // Ghost Text 配置
        enabled: true,
        mode: 'subwordSmart',
      },
      tabCompletion: 'on', // Tab 接受补全
    });

    editorRef.current = editor;
    setIsReady(true);

    // 监听主题变化
    const handleThemeChange = (event: CustomEvent<{ themeId: string; editorTheme: string }>) => {
      if (editorRef.current) {
        monaco.editor.setTheme(event.detail.editorTheme);
      }
    };
    window.addEventListener('theme-changed', handleThemeChange as EventListener);

    // 内容变化监听
    const disposable = editor.onDidChangeModelContent(() => {
      const content = editor.getValue();
      onContentChange?.(content);
    });

    // 保存快捷键
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const content = editor.getValue();
      onSave?.(content);
    });

    // Ctrl+K - 内联编辑
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      const selection = editor.getSelection();
      if (!selection || selection.isEmpty()) {
        // 没有选中内容，选中当前行
        const position = editor.getPosition();
        if (position) {
          const lineNumber = position.lineNumber;
          const lineContent = editor.getModel()?.getLineContent(lineNumber) || '';
          setSelectedCode(lineContent);
          setSelectionRange(new monaco.Range(lineNumber, 1, lineNumber, lineContent.length + 1));

          // 计算位置
          const coords = editor.getScrolledVisiblePosition(position);
          if (coords) {
            const editorRect = containerRef.current?.getBoundingClientRect();
            if (editorRect) {
              setInlineEditPosition({
                top: coords.top + coords.height + 10,
                left: Math.min(coords.left, editorRect.width - 440)
              });
            }
          }
          setShowInlineEdit(true);
        }
      } else {
        // 有选中内容
        const model = editor.getModel();
        if (model) {
          const selectedText = model.getValueInRange(selection);
          setSelectedCode(selectedText);
          setSelectionRange(selection);

          // 计算位置
          const coords = editor.getScrolledVisiblePosition(selection.getStartPosition());
          if (coords) {
            const editorRect = containerRef.current?.getBoundingClientRect();
            if (editorRect) {
              setInlineEditPosition({
                top: coords.top + coords.height + 10,
                left: Math.min(coords.left, editorRect.width - 440)
              });
            }
          }
          setShowInlineEdit(true);
        }
      }
    });

    return () => {
      disposable.dispose();
      editor.dispose();
      window.removeEventListener('theme-changed', handleThemeChange as EventListener);
    };
  }, []);

  // 更新文件内容
  useEffect(() => {
    if (!editorRef.current || !file) return;

    const currentModel = editorRef.current.getModel();
    const language = file.language || getLanguageFromPath(file.path);

    if (currentModel) {
      // 更新内容
      if (currentModel.getValue() !== file.content) {
        currentModel.setValue(file.content);
      }
      // 更新语言
      monaco.editor.setModelLanguage(currentModel, language);
    }
  }, [file?.path, file?.content]);

  // 更新编辑器选项
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.updateOptions({
      readOnly,
      minimap: { enabled: minimap },
      lineNumbers,
      wordWrap,
      fontSize,
    });
  }, [readOnly, minimap, lineNumbers, wordWrap, fontSize]);

  // 处理内联编辑应用
  const handleApplyInlineEdit = useCallback((newCode: string) => {
    if (!editorRef.current || !selectionRange) return;

    const model = editorRef.current.getModel();
    if (model) {
      // 执行编辑操作
      editorRef.current.executeEdits('inline-edit', [{
        range: selectionRange,
        text: newCode,
        forceMoveMarkers: true
      }]);

      // 触发内容变化回调
      onContentChange?.(editorRef.current.getValue());
    }

    setShowInlineEdit(false);
    setSelectedCode('');
    setSelectionRange(null);

    // 聚焦回编辑器
    editorRef.current.focus();
  }, [selectionRange, onContentChange]);

  // 处理 AI 编辑请求
  const handleAIChat = useCallback((prompt: string, code: string, callbacks: {
    onToken: (token: string) => void;
    onComplete: (result: string) => void;
    onError: (error: string) => void;
  }) => {
    if (onAIEdit) {
      onAIEdit(prompt, code, callbacks);
    } else if (window.mindcode?.ai?.chatStream) {
      window.mindcode.ai.chatStream('claude-sonnet-4-5', [{ role: 'user', content: prompt }], callbacks); // 内联编辑使用 Claude 4.5 Sonnet
    } else {
      setTimeout(() => callbacks.onComplete(code + '\n// AI 编辑示例'), 500); // 开发模式 fallback
    }
  }, [onAIEdit]);

  // 获取当前语言
  const currentLanguage = file?.language || getLanguageFromPath(file?.path || '');

  return (
    <div className="code-editor-container">
      <div ref={containerRef} className="code-editor" />
      {!isReady && (
        <div className="code-editor-loading">
          <div className="loading-spinner" />
          <span>Loading editor...</span>
        </div>
      )}

      {/* 内联编辑组件 */}
      <InlineEditWidget
        isOpen={showInlineEdit}
        position={inlineEditPosition}
        selectedCode={selectedCode}
        language={currentLanguage}
        onClose={() => {
          setShowInlineEdit(false);
          editorRef.current?.focus();
        }}
        onApply={handleApplyInlineEdit}
        onAIChat={handleAIChat}
      />
    </div>
  );
};

export default CodeEditor;
