/**
 * useLSP Hook - 编辑器 LSP 集成
 * 提供 定义跳转/类型提示/诊断 等功能
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import * as monaco from 'monaco-editor';
import { LSPClient, createLSPClient } from '../../core/lsp';
import type { Diagnostic, Location, Hover, CompletionItem } from '../../core/lsp/types';

interface UseLSPOptions {
  workspacePath?: string | null;
  enabled?: boolean;
}

interface LSPState {
  connected: boolean;
  language: string | null;
  diagnostics: Map<string, Diagnostic[]>;
}

export function useLSP(editor: monaco.editor.IStandaloneCodeEditor | null, options: UseLSPOptions = {}) {
  const { workspacePath, enabled = true } = options;
  const clientsRef = useRef<Map<string, LSPClient>>(new Map());
  const [state, setState] = useState<LSPState>({ connected: false, language: null, diagnostics: new Map() });
  const versionRef = useRef<Map<string, number>>(new Map()); // 文档版本号

  // 获取或创建 LSP 客户端
  const getClient = useCallback(async (language: string): Promise<LSPClient | null> => {
    if (!enabled || !workspacePath) return null;
    const supported = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact', 'python', 'go', 'rust'];
    const lang = language.replace('react', ''); // typescriptreact -> typescript
    if (!supported.includes(lang) && !supported.includes(language)) return null;
    const key = lang === 'javascript' ? 'typescript' : lang; // JS 使用 TS 服务器
    let client = clientsRef.current.get(key);
    if (!client) {
      client = await createLSPClient({ language: key, rootPath: workspacePath });
      clientsRef.current.set(key, client);
    }
    if (client.getState() !== 'running') {
      const ok = await client.start();
      if (!ok) return null;
    }
    setState(s => ({ ...s, connected: true, language: key }));
    return client;
  }, [workspacePath, enabled]);

  // 打开/同步文档
  const syncDocument = useCallback(async (model: monaco.editor.ITextModel) => {
    const lang = model.getLanguageId();
    const client = await getClient(lang);
    if (!client) return;
    const uri = `file://${model.uri.path.replace(/\\/g, '/')}`;
    const version = (versionRef.current.get(uri) || 0) + 1;
    versionRef.current.set(uri, version);
    if (version === 1) {
      await client.openDocument(uri, model.getValue(), lang);
    } else {
      await client.changeDocument(uri, version, [{ text: model.getValue() }]);
    }
  }, [getClient]);

  // 跳转定义
  const goToDefinition = useCallback(async (model: monaco.editor.ITextModel, position: monaco.Position): Promise<Location | Location[] | null> => {
    const client = await getClient(model.getLanguageId());
    if (!client) return null;
    const uri = `file://${model.uri.path.replace(/\\/g, '/')}`;
    return client.getDefinition(uri, { line: position.lineNumber - 1, character: position.column - 1 });
  }, [getClient]);

  // 获取 Hover
  const getHover = useCallback(async (model: monaco.editor.ITextModel, position: monaco.Position): Promise<Hover | null> => {
    const client = await getClient(model.getLanguageId());
    if (!client) return null;
    const uri = `file://${model.uri.path.replace(/\\/g, '/')}`;
    return client.getHover(uri, { line: position.lineNumber - 1, character: position.column - 1 });
  }, [getClient]);

  // 获取补全
  const getCompletion = useCallback(async (model: monaco.editor.ITextModel, position: monaco.Position): Promise<CompletionItem[]> => {
    const client = await getClient(model.getLanguageId());
    if (!client) return [];
    const uri = `file://${model.uri.path.replace(/\\/g, '/')}`;
    return client.getCompletion(uri, { line: position.lineNumber - 1, character: position.column - 1 });
  }, [getClient]);

  // 查找引用
  const findReferences = useCallback(async (model: monaco.editor.ITextModel, position: monaco.Position): Promise<Location[]> => {
    const client = await getClient(model.getLanguageId());
    if (!client) return [];
    const uri = `file://${model.uri.path.replace(/\\/g, '/')}`;
    return client.getReferences(uri, { line: position.lineNumber - 1, character: position.column - 1 });
  }, [getClient]);

  // 监听编辑器内容变化
  useEffect(() => {
    if (!editor || !enabled) return;
    const model = editor.getModel();
    if (!model) return;
    syncDocument(model); // 初始同步
    const disposable = model.onDidChangeContent(() => syncDocument(model));
    return () => disposable.dispose();
  }, [editor, syncDocument, enabled]);

  // 注册 Monaco 定义跳转 Provider
  useEffect(() => {
    if (!enabled) return;
    const langs = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact', 'python', 'go', 'rust'];
    const disposables = langs.map(lang => monaco.languages.registerDefinitionProvider(lang, {
      provideDefinition: async (model, position) => {
        const locs = await goToDefinition(model, position);
        if (!locs) return null;
        const arr = Array.isArray(locs) ? locs : [locs];
        return arr.map(loc => ({
          uri: monaco.Uri.parse(loc.uri),
          range: new monaco.Range(loc.range.start.line + 1, loc.range.start.character + 1, loc.range.end.line + 1, loc.range.end.character + 1)
        }));
      }
    }));
    return () => disposables.forEach(d => d.dispose());
  }, [goToDefinition, enabled]);

  // 注册 Monaco Hover Provider
  useEffect(() => {
    if (!enabled) return;
    const langs = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact', 'python', 'go', 'rust'];
    const disposables = langs.map(lang => monaco.languages.registerHoverProvider(lang, {
      provideHover: async (model, position) => {
        const hover = await getHover(model, position);
        if (!hover) return null;
        const contents = typeof hover.contents === 'string' ? [{ value: hover.contents }] : [{ value: hover.contents.value }];
        return { contents, range: hover.range ? new monaco.Range(hover.range.start.line + 1, hover.range.start.character + 1, hover.range.end.line + 1, hover.range.end.character + 1) : undefined };
      }
    }));
    return () => disposables.forEach(d => d.dispose());
  }, [getHover, enabled]);

  // 清理
  useEffect(() => () => { clientsRef.current.forEach(c => c.stop()); clientsRef.current.clear(); }, []);

  return { ...state, goToDefinition, getHover, getCompletion, findReferences, syncDocument };
}

export default useLSP;
