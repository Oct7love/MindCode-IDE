/**
 * MindCode - Monaco 代码编辑器组件
 * 基于 Monaco Editor 的专业代码编辑器
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as monaco from 'monaco-editor';
import { InlineEditWidget } from './InlineEditWidget';
import { completionService, CompletionRequest } from '../services/completionService';
import {
  triggerInlineCompletion,
  acceptCompletionWord,
  acceptCompletionLine,
} from '../services/inlineCompletionProvider';

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
    // 背景 - 更深邃
    'editor.background': '#07070a',
    'editor.foreground': '#E5E5E5',
    'editor.lineHighlightBackground': '#12121580',
    'editor.lineHighlightBorder': '#00000000',
    // 选择 - 紫蓝色调
    'editor.selectionBackground': '#3b82f640',
    'editor.selectionHighlightBackground': '#3b82f625',
    'editor.inactiveSelectionBackground': '#3b82f620',
    // 光标
    'editorCursor.foreground': '#8b5cf6',
    'editorCursor.background': '#07070a',
    // 空白和缩进
    'editorWhitespace.foreground': '#2a2a2d',
    'editorIndentGuide.background': '#1f1f23',
    'editorIndentGuide.activeBackground': '#3f3f46',
    // 行号
    'editorLineNumber.foreground': '#3f3f46',
    'editorLineNumber.activeForeground': '#a1a1aa',
    'editorGutter.background': '#07070a',
    // 查找
    'editor.findMatchBackground': '#8b5cf640',
    'editor.findMatchHighlightBackground': '#6366f130',
    // 括号匹配
    'editorBracketMatch.background': '#8b5cf620',
    'editorBracketMatch.border': '#8b5cf6',
    // 滚动条
    'editorOverviewRuler.border': '#0f0f12',
    // Widget
    'editorWidget.background': '#111114',
    'editorWidget.border': '#1f1f23',
    'editorSuggestWidget.background': '#111114',
    'editorSuggestWidget.border': '#1f1f23',
    'editorSuggestWidget.selectedBackground': '#3b82f630',
    'editorSuggestWidget.highlightForeground': '#8b5cf6',
    'editorHoverWidget.background': '#111114',
    'editorHoverWidget.border': '#1f1f23',
    // Peek View
    'peekView.border': '#8b5cf6',
    'peekViewEditor.background': '#0d0d10',
    'peekViewResult.background': '#111114',
    'peekViewTitle.background': '#111114',
    // 滚动条
    'scrollbar.shadow': '#00000000',
    'scrollbarSlider.background': '#ffffff12',
    'scrollbarSlider.hoverBackground': '#ffffff20',
    'scrollbarSlider.activeBackground': '#ffffff30',
    // Ghost Text / Inline Completion
    'editorGhostText.foreground': '#6366f180',
    'editorGhostText.background': '#00000000',
    'editorGhostText.border': '#00000000',
    // Minimap
    'minimap.background': '#07070a',
    'minimapSlider.background': '#ffffff10',
    'minimapSlider.hoverBackground': '#ffffff18',
    'minimapSlider.activeBackground': '#ffffff25',
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
  onCursorPositionChange?: (line: number, column: number) => void; // 光标位置变化
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
let currentFilePath = ''; // 当前文件路径

// 注释模式检测
const COMMENT_PATTERNS = ['//', '/*', '#', '"""', "'''", '<!--'];

/**
 * 判断是否应该使用 block 模式（复杂代码生成）
 */
const shouldUseBlockMode = (content: string, lineNumber: number): boolean => {
  const lines = content.split('\n');
  if (lineNumber < 1 || lineNumber > lines.length) return false;

  const currentLine = lines[lineNumber - 1] || '';
  const trimmed = currentLine.trimStart();

  // 注释行使用 block 模式
  if (COMMENT_PATTERNS.some(p => trimmed.startsWith(p))) {
    return true;
  }

  // 空行且上一行是注释，使用 block 模式
  if (trimmed === '' && lineNumber > 1) {
    const prevLine = lines[lineNumber - 2].trimStart();
    if (COMMENT_PATTERNS.some(p => prevLine.startsWith(p))) {
      return true;
    }
  }

  // 函数/类定义后的空行
  if (trimmed === '' && lineNumber > 1) {
    const prevLine = lines[lineNumber - 2].trimEnd();
    if (prevLine.endsWith('{') || prevLine.endsWith(':') || prevLine.endsWith(')')) {
      return true;
    }
  }

  return false;
};

/**
 * 创建基于本地补全服务的内联补全提供者 v2.0
 * - 智能 block/inline 模式切换
 * - 多行补全支持
 */
const createLocalCompletionProvider = (): monaco.languages.InlineCompletionsProvider => ({
  provideInlineCompletions: async (monacoModel, position, _context, token) => {
    const fullContent = monacoModel.getValue();

    // 如果文件内容太少，不触发
    if (fullContent.trim().length < 5) {
      return { items: [] };
    }

    // 智能模式选择
    const mode = shouldUseBlockMode(fullContent, position.lineNumber) ? 'block' : 'inline';

    const request: CompletionRequest = {
      file_path: currentFilePath || monacoModel.uri.path,
      content: fullContent,
      cursor_line: position.lineNumber - 1,
      cursor_column: position.column - 1,
      mode,
    };

    try {
      if (token.isCancellationRequested) return { items: [] }; // 提前检查取消
      const response = await completionService.getCompletion(request);
      if (token.isCancellationRequested || !response || !response.completion) return { items: [] };

      // 多行补全：计算结束位置
      const completionLines = response.completion.split('\n');
      const endLineNumber = position.lineNumber + completionLines.length - 1;
      const lastLineLength = completionLines[completionLines.length - 1].length;
      const endColumn = completionLines.length === 1
        ? position.column + lastLineLength
        : lastLineLength + 1;

      return {
        items: [{
          insertText: response.completion,
          range: new monaco.Range(
            position.lineNumber,
            position.column,
            endLineNumber,
            endColumn
          ),
        }],
        enableForwardStability: true, // 启用部分接受
      };
    } catch (e: any) {
      if (e?.name === 'AbortError' || e?.message?.includes('Canceled')) return { items: [] }; // 静默处理取消
      console.error('[CodeEditor] 补全请求失败:', e);
      return { items: [] };
    }
  },
  freeInlineCompletions: () => {
    completionService.cancel();
  },
});

export const CodeEditor: React.FC<CodeEditorProps> = ({
  file,
  onContentChange,
  onSave,
  onCursorPositionChange,
  readOnly = false,
  minimap = true,
  lineNumbers = 'on',
  wordWrap = 'off',
  fontSize = 12, // 紧凑模式
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

  // 注册 Ghost Text 补全提供者（使用本地补全服务）
  useEffect(() => {
    if (!enableGhostText) return;

    // 先检查补全服务是否可用
    completionService.healthCheck().then((health) => {
      if (health) {
        console.log('[CodeEditor] 本地补全服务可用:', health);
      } else {
        console.warn('[CodeEditor] 本地补全服务不可用，请启动 completion-server');
      }
    });

    inlineCompletionDisposable?.dispose();
    inlineCompletionDisposable = monaco.languages.registerInlineCompletionsProvider(
      '*',
      createLocalCompletionProvider()
    );
    return () => {
      inlineCompletionDisposable?.dispose();
      inlineCompletionDisposable = null;
    };
  }, [enableGhostText]);

  // 初始化编辑器
  useEffect(() => {
    if (!containerRef.current) return;

    const editor = monaco.editor.create(containerRef.current, {
      value: file?.content || '',
      language: file?.language || getLanguageFromPath(file?.path || ''),
      theme: 'mindcode-dark',
      readOnly,
      minimap: { 
        enabled: minimap,
        scale: 1,
        showSlider: 'mouseover',
        renderCharacters: false, // 使用色块而非字符，更清晰
        maxColumn: 80,
        side: 'right',
      },
      lineNumbers,
      wordWrap,
      fontSize,
      lineHeight: 18, // 紧凑行高
      fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace",
      fontLigatures: true,
      renderWhitespace: 'selection',
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      automaticLayout: true,
      padding: { top: 8, bottom: 8 }, // 紧凑 padding
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
      inlineSuggest: { // Ghost Text 配置 (Cursor 风格)
        enabled: true,
        mode: 'subwordSmart', // 智能子词匹配
        showToolbar: 'always', // 始终显示工具栏（接受/拒绝）
        suppressSuggestions: false, // 不抑制普通建议
        keepOnBlur: false, // 失焦时隐藏
      },
      tabCompletion: 'off', // 禁用普通 Tab 补全，由 inline suggest 接管
      acceptSuggestionOnEnter: 'off', // Enter 不接受，避免冲突
    });

    editorRef.current = editor;
    setIsReady(true);

    // 监听光标位置变化
    const cursorDisposable = editor.onDidChangeCursorPosition((e) => {
      onCursorPositionChange?.(e.position.lineNumber, e.position.column);
    });
    // 初始位置
    const pos = editor.getPosition();
    if (pos) onCursorPositionChange?.(pos.lineNumber, pos.column);

    // 监听主题变化 - 动态更新编辑器颜色
    const handleThemeChange = (event: CustomEvent<{ themeId: string; editorTheme: string; type: string }>) => {
      if (editorRef.current) {
        // 获取当前主题的 CSS 变量值来更新编辑器
        const root = document.documentElement;
        const getColor = (name: string) => getComputedStyle(root).getPropertyValue(name).trim();
        
        const editorBg = getColor('--vscode-editor-background') || getColor('--color-bg-base');
        const editorFg = getColor('--vscode-editor-foreground') || getColor('--color-text-primary');
        const isDark = event.detail.type !== 'light';
        
        // 动态定义新主题
        const themeId = `mindcode-${event.detail.themeId}`;
        monaco.editor.defineTheme(themeId, {
          base: isDark ? 'vs-dark' : 'vs',
          inherit: true,
          rules: [],
          colors: {
            'editor.background': editorBg,
            'editor.foreground': editorFg,
            'editor.lineHighlightBackground': isDark ? '#ffffff08' : '#00000008',
            'editor.selectionBackground': getColor('--vscode-list-activeSelectionBackground') || (isDark ? '#264F78' : '#add6ff'),
            'editorLineNumber.foreground': getColor('--color-text-muted') || (isDark ? '#525252' : '#858585'),
            'editorLineNumber.activeForeground': getColor('--color-text-secondary') || (isDark ? '#A3A3A3' : '#333333'),
            'editorCursor.foreground': getColor('--color-accent-primary') || '#8b5cf6',
            'editorWidget.background': getColor('--color-bg-elevated') || (isDark ? '#1A1A1A' : '#f3f3f3'),
            'editorWidget.border': getColor('--color-border') || (isDark ? '#262626' : '#c8c8c8'),
          },
        });
        
        monaco.editor.setTheme(themeId);
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

    // ========== 补全快捷键 (Cursor 风格) ==========
    // Tab - 接受 inline completion (最高优先级)
    editor.addAction({
      id: 'mindcode.acceptInlineCompletion',
      label: 'Accept Inline Completion',
      keybindings: [monaco.KeyCode.Tab],
      precondition: 'inlineSuggestionVisible', // 仅当 inline suggestion 可见时
      run: (ed) => { ed.trigger('mindcode', 'editor.action.inlineSuggest.commit', {}); }
    });
    // Esc - 取消 inline completion
    editor.addAction({
      id: 'mindcode.cancelInlineCompletion',
      label: 'Cancel Inline Completion',
      keybindings: [monaco.KeyCode.Escape],
      precondition: 'inlineSuggestionVisible',
      run: (ed) => { ed.trigger('mindcode', 'editor.action.inlineSuggest.hide', {}); }
    });
    // Alt+\ - 手动触发补全
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.Backslash, () => {
      if (currentFilePath) triggerInlineCompletion(editor, currentFilePath);
    });
    // Ctrl+Shift+Space - 备选触发
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Space, () => {
      if (currentFilePath) triggerInlineCompletion(editor, currentFilePath);
    });
    // Ctrl+Right - 按词接受
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.RightArrow, () => acceptCompletionWord(editor));
    // Ctrl+Shift+Right - 按行接受
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.RightArrow, () => acceptCompletionLine(editor));

    // ========== 编辑快捷键 ==========
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
      cursorDisposable.dispose();
      disposable.dispose();
      editor.dispose();
      window.removeEventListener('theme-changed', handleThemeChange as EventListener);
    };
  }, []);

  // 更新文件内容和路径
  useEffect(() => {
    if (!editorRef.current || !file) return;

    // 更新当前文件路径（供补全服务使用）
    currentFilePath = file.path;

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
      minimap: { 
        enabled: minimap,
        scale: 1,
        showSlider: 'mouseover',
        renderCharacters: false,
        maxColumn: 80,
      },
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
