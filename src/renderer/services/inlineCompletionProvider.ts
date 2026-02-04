/**
 * MindCode Inline Completion Provider v2.0
 * Cursor 风格的内联补全 - 支持多行 ghost text
 */

import * as monaco from 'monaco-editor';
import { completionService, CompletionRequest } from './completionService';

// 注释模式检测
const COMMENT_PATTERNS = ['//', '/*', '#', '"""', "'''", '<!--'];

/**
 * 判断是否应该使用 block 模式
 */
function shouldUseBlockMode(content: string, lineNumber: number): boolean {
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
}

/** 获取 LSP 补全并提取最佳项 */
async function getLSPCompletion(lang: string, uri: string, line: number, col: number): Promise<string | null> {
  try {
    const win = window as any;
    if (!win.mindcode?.lsp?.request) return null;
    const result = await win.mindcode.lsp.request(lang, 'textDocument/completion', { textDocument: { uri }, position: { line, character: col } });
    if (!result?.success || !result.data) return null;
    const items = Array.isArray(result.data) ? result.data : result.data.items || [];
    if (items.length === 0) return null;
    const best = items.sort((a: any, b: any) => ((b.sortText || b.label) < (a.sortText || a.label) ? 1 : -1))[0]; // 取最佳匹配
    return best?.insertText || best?.label || null;
  } catch { return null; }
}

/**
 * 创建内联补全提供者 - 融合 LSP + AI
 */
export function createInlineCompletionProvider(
  getFilePath: () => string
): monaco.languages.InlineCompletionsProvider {
  return {
    provideInlineCompletions: async (
      model: monaco.editor.ITextModel,
      position: monaco.Position,
      context: monaco.languages.InlineCompletionContext,
      token: monaco.CancellationToken
    ): Promise<monaco.languages.InlineCompletions | null> => {
      const filePath = getFilePath();
      if (!filePath) return null;
      if (token.isCancellationRequested) return null;

      const content = model.getValue();
      const mode = shouldUseBlockMode(content, position.lineNumber) ? 'block' : 'inline';
      const lang = model.getLanguageId();
      const uri = `file://${filePath.replace(/\\/g, '/')}`;

      // 并行获取 LSP 补全和 AI 补全
      const [lspResult, aiResult] = await Promise.all([
        getLSPCompletion(lang === 'typescriptreact' ? 'typescript' : lang, uri, position.lineNumber - 1, position.column - 1),
        completionService.getCompletion({ file_path: filePath, content, cursor_line: position.lineNumber - 1, cursor_column: position.column - 1, mode }),
      ]);

      if (token.isCancellationRequested) return null;

      // 融合策略：AI 优先（更智能），LSP 作为快速回退
      let completion = aiResult?.completion;
      let source = 'ai';
      if (!completion && lspResult) { completion = lspResult; source = 'lsp'; }
      if (!completion) return null;

      // 多行补全：计算结束位置
      const completionLines = completion.split('\n');
      const endLineNumber = position.lineNumber + completionLines.length - 1;
      const lastLineLength = completionLines[completionLines.length - 1].length;
      const endColumn = completionLines.length === 1 ? position.column + lastLineLength : lastLineLength + 1;

      const inlineCompletion: monaco.languages.InlineCompletion = {
        insertText: completion,
        range: new monaco.Range(position.lineNumber, position.column, endLineNumber, endColumn),
        command: { id: 'mindcode.completionAccepted', title: 'Completion Accepted', arguments: [source === 'ai' ? (aiResult?.model || 'ai') : 'lsp', aiResult?.latency_ms || 0] }
      };

      return {
        items: [inlineCompletion],
        // 启用部分接受
        enableForwardStability: true,
      };
    },

    freeInlineCompletions: () => {},
  };
}

/**
 * 注册内联补全提供者 + 接受回调命令
 */
export function registerInlineCompletionProvider(
  getFilePath: () => string,
  onAccepted?: (model: string, latencyMs: number) => void // 补全接受回调
): monaco.IDisposable {
  const provider = createInlineCompletionProvider(getFilePath);
  const languages = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact', 'python', 'java', 'go', 'rust', 'cpp', 'c', 'csharp', 'html', 'css', 'json', 'markdown', 'yaml', 'xml', 'sql', 'shell', 'powershell', 'php', 'ruby', 'swift', 'kotlin'];
  const disposables: monaco.IDisposable[] = languages.map((lang) => monaco.languages.registerInlineCompletionsProvider(lang, provider));
  // 注册补全接受命令（用于统计）
  const cmdDisposable = monaco.editor.registerCommand('mindcode.completionAccepted', (_accessor, model?: string, latencyMs?: number) => {
    console.log(`[Completion] Accepted: model=${model}, latency=${latencyMs}ms`);
    onAccepted?.(model || 'unknown', latencyMs || 0);
  });
  disposables.push(cmdDisposable);
  return { dispose: () => disposables.forEach((d) => d.dispose()) };
}

/**
 * 手动触发内联补全（快捷键用）
 */
export async function triggerInlineCompletion(
  editor: monaco.editor.IStandaloneCodeEditor,
  filePath: string
): Promise<void> {
  const model = editor.getModel();
  const position = editor.getPosition();

  if (!model || !position) return;

  const content = model.getValue();
  const mode = shouldUseBlockMode(content, position.lineNumber) ? 'block' : 'inline';

  const request: CompletionRequest = {
    file_path: filePath,
    content: content,
    cursor_line: position.lineNumber - 1,
    cursor_column: position.column - 1,
    mode: mode,
  };

  const response = await completionService.getCompletionImmediate(request);

  if (response?.completion) {
    // 触发 Monaco 的内联补全
    editor.trigger('mindcode', 'editor.action.inlineSuggest.trigger', {});
  }
}

/**
 * 接受部分补全（按词）
 */
export function acceptCompletionWord(editor: monaco.editor.IStandaloneCodeEditor): void {
  editor.trigger('mindcode', 'editor.action.inlineSuggest.acceptNextWord', {});
}

/**
 * 接受部分补全（按行）
 */
export function acceptCompletionLine(editor: monaco.editor.IStandaloneCodeEditor): void {
  editor.trigger('mindcode', 'editor.action.inlineSuggest.acceptNextLine', {});
}

export default {
  createInlineCompletionProvider,
  registerInlineCompletionProvider,
  triggerInlineCompletion,
  acceptCompletionWord,
  acceptCompletionLine,
};
