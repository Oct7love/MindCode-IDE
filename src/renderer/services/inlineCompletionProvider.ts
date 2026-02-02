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

/**
 * 创建内联补全提供者
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

      // 检查是否被取消
      if (token.isCancellationRequested) return null;

      const content = model.getValue();
      const mode = shouldUseBlockMode(content, position.lineNumber) ? 'block' : 'inline';

      const request: CompletionRequest = {
        file_path: filePath,
        content: content,
        cursor_line: position.lineNumber - 1,
        cursor_column: position.column - 1,
        mode: mode,
      };

      const response = await completionService.getCompletion(request);

      // 再次检查取消状态
      if (token.isCancellationRequested) return null;

      if (!response || !response.completion) {
        return null;
      }

      // 多行补全：计算结束位置
      const completionLines = response.completion.split('\n');
      const endLineNumber = position.lineNumber + completionLines.length - 1;
      const lastLineLength = completionLines[completionLines.length - 1].length;
      const endColumn = completionLines.length === 1
        ? position.column + lastLineLength
        : lastLineLength + 1;

      const inlineCompletion: monaco.languages.InlineCompletion = {
        insertText: response.completion,
        range: new monaco.Range(
          position.lineNumber,
          position.column,
          endLineNumber,
          endColumn
        ),
        // 命令：补全被接受时执行（用于分析）
        command: {
          id: 'mindcode.completionAccepted',
          title: 'Completion Accepted',
          arguments: [response.model, response.latency_ms]
        }
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
 * 注册内联补全提供者
 */
export function registerInlineCompletionProvider(
  getFilePath: () => string
): monaco.IDisposable {
  const provider = createInlineCompletionProvider(getFilePath);

  const languages = [
    'typescript', 'javascript', 'typescriptreact', 'javascriptreact',
    'python', 'java', 'go', 'rust', 'cpp', 'c', 'csharp',
    'html', 'css', 'json', 'markdown', 'yaml', 'xml', 'sql',
    'shell', 'powershell', 'php', 'ruby', 'swift', 'kotlin',
  ];

  const disposables = languages.map((lang) =>
    monaco.languages.registerInlineCompletionsProvider(lang, provider)
  );

  return {
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
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
