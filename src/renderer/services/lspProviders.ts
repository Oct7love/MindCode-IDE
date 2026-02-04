/**
 * LSP Provider 集成 - Monaco Editor
 * 提供补全、悬停、定义跳转等功能
 */

import * as monaco from 'monaco-editor';
import { LSPClient } from '../../core/lsp/client';
import type { CompletionItem, Hover, Location, DocumentSymbol } from '../../core/lsp/types';

/** 语言ID到LSP客户端的映射 */
const lspClients = new Map<string, LSPClient>();

/** 获取或创建LSP客户端 */
async function getLSPClient(language: string, rootPath?: string): Promise<LSPClient | null> {
  // 检查是否已存在
  if (lspClients.has(language)) {
    const client = lspClients.get(language)!;
    if (client.getState() === 'running') return client;
  }

  // 创建新客户端
  const client = new LSPClient({ language, rootPath });
  const success = await client.start();
  
  if (success) {
    lspClients.set(language, client);
    console.log(`[LSP] ${language} 客户端已启动`);
    return client;
  }

  return null;
}

/** 将LSP CompletionItem转换为Monaco CompletionItem */
function mapToMonacoCompletionItem(item: CompletionItem): monaco.languages.CompletionItem {
  // 映射CompletionItemKind
  const kindMap: Record<number, monaco.languages.CompletionItemKind> = {
    1: monaco.languages.CompletionItemKind.Text,
    2: monaco.languages.CompletionItemKind.Method,
    3: monaco.languages.CompletionItemKind.Function,
    4: monaco.languages.CompletionItemKind.Constructor,
    5: monaco.languages.CompletionItemKind.Field,
    6: monaco.languages.CompletionItemKind.Variable,
    7: monaco.languages.CompletionItemKind.Class,
    8: monaco.languages.CompletionItemKind.Interface,
    9: monaco.languages.CompletionItemKind.Module,
    10: monaco.languages.CompletionItemKind.Property,
    11: monaco.languages.CompletionItemKind.Unit,
    12: monaco.languages.CompletionItemKind.Value,
    13: monaco.languages.CompletionItemKind.Enum,
    14: monaco.languages.CompletionItemKind.Keyword,
    15: monaco.languages.CompletionItemKind.Snippet,
    16: monaco.languages.CompletionItemKind.Color,
    17: monaco.languages.CompletionItemKind.File,
    18: monaco.languages.CompletionItemKind.Reference,
    19: monaco.languages.CompletionItemKind.Folder,
    20: monaco.languages.CompletionItemKind.EnumMember,
    21: monaco.languages.CompletionItemKind.Constant,
    22: monaco.languages.CompletionItemKind.Struct,
    23: monaco.languages.CompletionItemKind.Event,
    24: monaco.languages.CompletionItemKind.Operator,
    25: monaco.languages.CompletionItemKind.TypeParameter,
  };

  return {
    label: item.label,
    kind: item.kind ? kindMap[item.kind] || monaco.languages.CompletionItemKind.Text : monaco.languages.CompletionItemKind.Text,
    insertText: item.insertText || item.label,
    detail: item.detail,
    documentation: item.documentation,
    sortText: item.sortText,
    filterText: item.filterText,
    range: item.range as any,
  };
}

/** 将LSP Location转换为Monaco Location */
function mapToMonacoLocation(location: Location): monaco.languages.Location {
  return {
    uri: monaco.Uri.parse(location.uri),
    range: new monaco.Range(
      location.range.start.line + 1,
      location.range.start.character + 1,
      location.range.end.line + 1,
      location.range.end.character + 1
    )
  };
}

/** LSP补全提供器 */
export class LSPCompletionProvider implements monaco.languages.CompletionItemProvider {
  triggerCharacters = ['.', ':', '<', '"', "'", '/', '@'];

  async provideCompletionItems(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    context: monaco.languages.CompletionContext,
    token: monaco.CancellationToken
  ): Promise<monaco.languages.CompletionList | null> {
    const language = model.getLanguageId();
    const client = await getLSPClient(language);
    
    if (!client || token.isCancellationRequested) return null;

    try {
      const uri = model.uri.toString();
      const items = await client.getCompletion(uri, {
        line: position.lineNumber - 1,
        character: position.column - 1
      });

      if (token.isCancellationRequested) return null;

      return {
        suggestions: items.map(mapToMonacoCompletionItem),
        incomplete: false
      };
    } catch (error) {
      console.error('[LSP] 补全失败:', error);
      return null;
    }
  }
}

/** LSP悬停提供器 */
export class LSPHoverProvider implements monaco.languages.HoverProvider {
  async provideHover(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    token: monaco.CancellationToken
  ): Promise<monaco.languages.Hover | null> {
    const language = model.getLanguageId();
    const client = await getLSPClient(language);
    
    if (!client || token.isCancellationRequested) return null;

    try {
      const uri = model.uri.toString();
      const hover = await client.getHover(uri, {
        line: position.lineNumber - 1,
        character: position.column - 1
      });

      if (!hover || token.isCancellationRequested) return null;

      // 转换Hover内容
      let contents: monaco.IMarkdownString[] = [];
      if (typeof hover.contents === 'string') {
        contents = [{ value: hover.contents }];
      } else if (Array.isArray(hover.contents)) {
        contents = hover.contents.map(c => 
          typeof c === 'string' ? { value: c } : { value: c.value, isTrusted: true }
        );
      } else {
        contents = [{ value: (hover.contents as any).value || '' }];
      }

      return {
        contents,
        range: hover.range ? new monaco.Range(
          hover.range.start.line + 1,
          hover.range.start.character + 1,
          hover.range.end.line + 1,
          hover.range.end.character + 1
        ) : undefined
      };
    } catch (error) {
      console.error('[LSP] Hover 失败:', error);
      return null;
    }
  }
}

/** LSP定义提供器 */
export class LSPDefinitionProvider implements monaco.languages.DefinitionProvider {
  async provideDefinition(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    token: monaco.CancellationToken
  ): Promise<monaco.languages.Definition | null> {
    const language = model.getLanguageId();
    const client = await getLSPClient(language);
    
    if (!client || token.isCancellationRequested) return null;

    try {
      const uri = model.uri.toString();
      const result = await client.getDefinition(uri, {
        line: position.lineNumber - 1,
        character: position.column - 1
      });

      if (!result || token.isCancellationRequested) return null;

      // 处理单个或多个定义
      if (Array.isArray(result)) {
        return result.map(mapToMonacoLocation);
      }
      
      return mapToMonacoLocation(result);
    } catch (error) {
      console.error('[LSP] 定义跳转失败:', error);
      return null;
    }
  }
}

/** LSP引用提供器 */
export class LSPReferencesProvider implements monaco.languages.ReferenceProvider {
  async provideReferences(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    context: monaco.languages.ReferenceContext,
    token: monaco.CancellationToken
  ): Promise<monaco.languages.Location[] | null> {
    const language = model.getLanguageId();
    const client = await getLSPClient(language);
    
    if (!client || token.isCancellationRequested) return null;

    try {
      const uri = model.uri.toString();
      const refs = await client.getReferences(uri, {
        line: position.lineNumber - 1,
        character: position.column - 1
      }, context.includeDeclaration);

      if (token.isCancellationRequested) return null;

      return refs.map(mapToMonacoLocation);
    } catch (error) {
      console.error('[LSP] 查找引用失败:', error);
      return null;
    }
  }
}

/** LSP文档符号提供器 */
export class LSPDocumentSymbolProvider implements monaco.languages.DocumentSymbolProvider {
  async provideDocumentSymbols(
    model: monaco.editor.ITextModel,
    token: monaco.CancellationToken
  ): Promise<monaco.languages.DocumentSymbol[] | null> {
    const language = model.getLanguageId();
    const client = await getLSPClient(language);
    
    if (!client || token.isCancellationRequested) return null;

    try {
      const uri = model.uri.toString();
      const symbols = await client.getDocumentSymbols(uri);

      if (token.isCancellationRequested) return null;

      // 转换LSP DocumentSymbol到Monaco DocumentSymbol
      return symbols.map(mapDocumentSymbol);
    } catch (error) {
      console.error('[LSP] 获取符号失败:', error);
      return null;
    }
  }
}

function mapDocumentSymbol(symbol: DocumentSymbol): monaco.languages.DocumentSymbol {
  const kindMap: Record<number, monaco.languages.SymbolKind> = {
    1: monaco.languages.SymbolKind.File,
    2: monaco.languages.SymbolKind.Module,
    3: monaco.languages.SymbolKind.Namespace,
    4: monaco.languages.SymbolKind.Package,
    5: monaco.languages.SymbolKind.Class,
    6: monaco.languages.SymbolKind.Method,
    7: monaco.languages.SymbolKind.Property,
    8: monaco.languages.SymbolKind.Field,
    9: monaco.languages.SymbolKind.Constructor,
    10: monaco.languages.SymbolKind.Enum,
    11: monaco.languages.SymbolKind.Interface,
    12: monaco.languages.SymbolKind.Function,
    13: monaco.languages.SymbolKind.Variable,
    14: monaco.languages.SymbolKind.Constant,
    15: monaco.languages.SymbolKind.String,
    16: monaco.languages.SymbolKind.Number,
    17: monaco.languages.SymbolKind.Boolean,
    18: monaco.languages.SymbolKind.Array,
  };

  return {
    name: symbol.name,
    detail: symbol.detail || '',
    kind: kindMap[symbol.kind] || monaco.languages.SymbolKind.Variable,
    range: new monaco.Range(
      symbol.range.start.line + 1,
      symbol.range.start.character + 1,
      symbol.range.end.line + 1,
      symbol.range.end.character + 1
    ),
    selectionRange: new monaco.Range(
      symbol.selectionRange.start.line + 1,
      symbol.selectionRange.start.character + 1,
      symbol.selectionRange.end.line + 1,
      symbol.selectionRange.end.character + 1
    ),
    children: symbol.children?.map(mapDocumentSymbol)
  };
}

/** 注册所有LSP Provider */
export function registerLSPProviders(languages: string[] = ['typescript', 'javascript', 'python', 'go', 'rust']) {
  console.log('[LSP] 注册 LSP Providers...', languages);

  languages.forEach(language => {
    // 注册补全
    monaco.languages.registerCompletionItemProvider(language, new LSPCompletionProvider());

    // 注册悬停
    monaco.languages.registerHoverProvider(language, new LSPHoverProvider());

    // 注册定义跳转
    monaco.languages.registerDefinitionProvider(language, new LSPDefinitionProvider());

    // 注册查找引用
    monaco.languages.registerReferenceProvider(language, new LSPReferencesProvider());

    // 注册文档符号
    monaco.languages.registerDocumentSymbolProvider(language, new LSPDocumentSymbolProvider());
  });

  console.log('[LSP] LSP Providers 注册完成');
}

/** 当文档打开时通知LSP */
export async function notifyDocumentOpen(model: monaco.editor.ITextModel) {
  const language = model.getLanguageId();
  const client = await getLSPClient(language);
  
  if (client) {
    const uri = model.uri.toString();
    const text = model.getValue();
    await client.openDocument(uri, text, language);
  }
}

/** 当文档关闭时通知LSP */
export async function notifyDocumentClose(model: monaco.editor.ITextModel) {
  const language = model.getLanguageId();
  const client = lspClients.get(language);
  
  if (client) {
    const uri = model.uri.toString();
    await client.closeDocument(uri);
  }
}

/** 当文档变更时通知LSP */
export async function notifyDocumentChange(
  model: monaco.editor.ITextModel,
  changes: monaco.editor.IModelContentChange[]
) {
  const language = model.getLanguageId();
  const client = lspClients.get(language);
  
  if (client) {
    const uri = model.uri.toString();
    const version = (model as any).getVersionId?.() || 1;
    
    // 转换Monaco changes到LSP格式
    const lspChanges = changes.map(change => ({
      range: {
        start: { line: change.range.startLineNumber - 1, character: change.range.startColumn - 1 },
        end: { line: change.range.endLineNumber - 1, character: change.range.endColumn - 1 }
      },
      text: change.text
    }));

    await client.changeDocument(uri, version, lspChanges);
  }
}

/** 停止所有LSP客户端 */
export async function stopAllLSPClients() {
  console.log('[LSP] 停止所有 LSP 客户端...');
  const promises = Array.from(lspClients.values()).map(client => client.stop());
  await Promise.all(promises);
  lspClients.clear();
}

export { getLSPClient, lspClients };
