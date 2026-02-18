/**
 * CodeNavigation - 代码导航服务
 */

export interface Position {
  line: number;
  column: number;
}
export interface Range {
  start: Position;
  end: Position;
}
export interface Location {
  file: string;
  range: Range;
}
export interface Symbol {
  name: string;
  kind: SymbolKind;
  location: Location;
  containerName?: string;
}
export enum SymbolKind {
  File = 1,
  Module,
  Namespace,
  Package,
  Class,
  Method,
  Property,
  Field,
  Constructor,
  Enum,
  Interface,
  Function,
  Variable,
  Constant,
  String,
  Number,
  Boolean,
  Array,
  Object,
  Key,
  Null,
  EnumMember,
  Struct,
  Event,
  Operator,
  TypeParameter,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const win = window as any;

class CodeNavigation {
  private navigationHistory: Location[] = [];
  private historyIndex = -1;
  private maxHistory = 50;

  // ============ 定义跳转 ============

  /** 跳转到定义 */
  async goToDefinition(file: string, position: Position): Promise<Location | null> {
    try {
      if (win.mindcode?.lsp?.definition) {
        const result = await win.mindcode.lsp.definition(file, position);
        if (result) {
          this.pushHistory({ file, range: { start: position, end: position } });
          return result;
        }
      }
    } catch (e) {
      console.error("[CodeNavigation] goToDefinition failed:", e);
    }
    return null;
  }

  /** 跳转到类型定义 */
  async goToTypeDefinition(file: string, position: Position): Promise<Location | null> {
    try {
      if (win.mindcode?.lsp?.typeDefinition) {
        const result = await win.mindcode.lsp.typeDefinition(file, position);
        if (result) {
          this.pushHistory({ file, range: { start: position, end: position } });
          return result;
        }
      }
    } catch (e) {
      console.error("[CodeNavigation] goToTypeDefinition failed:", e);
    }
    return null;
  }

  /** 跳转到实现 */
  async goToImplementation(file: string, position: Position): Promise<Location[] | null> {
    try {
      if (win.mindcode?.lsp?.implementation)
        return await win.mindcode.lsp.implementation(file, position);
    } catch (e) {
      console.error("[CodeNavigation] goToImplementation failed:", e);
    }
    return null;
  }

  // ============ 引用查找 ============

  /** 查找所有引用 */
  async findReferences(
    file: string,
    position: Position,
    includeDeclaration = true,
  ): Promise<Location[]> {
    try {
      if (win.mindcode?.lsp?.references)
        return (await win.mindcode.lsp.references(file, position, includeDeclaration)) || [];
    } catch (e) {
      console.error("[CodeNavigation] findReferences failed:", e);
    }
    return [];
  }

  // ============ 符号操作 ============

  /** 获取文档符号 */
  async getDocumentSymbols(file: string): Promise<Symbol[]> {
    try {
      if (win.mindcode?.lsp?.documentSymbols)
        return (await win.mindcode.lsp.documentSymbols(file)) || [];
    } catch (e) {
      console.error("[CodeNavigation] getDocumentSymbols failed:", e);
    }
    return [];
  }

  /** 工作区符号搜索 */
  async searchWorkspaceSymbols(query: string): Promise<Symbol[]> {
    try {
      if (win.mindcode?.lsp?.workspaceSymbols)
        return (await win.mindcode.lsp.workspaceSymbols(query)) || [];
    } catch (e) {
      console.error("[CodeNavigation] searchWorkspaceSymbols failed:", e);
    }
    return [];
  }

  // ============ 重命名 ============

  /** 重命名符号 */
  async renameSymbol(
    file: string,
    position: Position,
    newName: string,
  ): Promise<{ file: string; edits: { range: Range; newText: string }[] }[] | null> {
    try {
      if (win.mindcode?.lsp?.rename) return await win.mindcode.lsp.rename(file, position, newName);
    } catch (e) {
      console.error("[CodeNavigation] renameSymbol failed:", e);
    }
    return null;
  }

  /** 准备重命名（获取当前名称） */
  async prepareRename(
    file: string,
    position: Position,
  ): Promise<{ range: Range; placeholder: string } | null> {
    try {
      if (win.mindcode?.lsp?.prepareRename)
        return await win.mindcode.lsp.prepareRename(file, position);
    } catch (e) {
      console.error("[CodeNavigation] prepareRename failed:", e);
    }
    return null;
  }

  // ============ 导航历史 ============

  private pushHistory(location: Location): void {
    // 移除当前位置之后的历史
    if (this.historyIndex < this.navigationHistory.length - 1) {
      this.navigationHistory = this.navigationHistory.slice(0, this.historyIndex + 1);
    }
    this.navigationHistory.push(location);
    if (this.navigationHistory.length > this.maxHistory) this.navigationHistory.shift();
    this.historyIndex = this.navigationHistory.length - 1;
  }

  /** 后退 */
  goBack(): Location | null {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      return this.navigationHistory[this.historyIndex];
    }
    return null;
  }

  /** 前进 */
  goForward(): Location | null {
    if (this.historyIndex < this.navigationHistory.length - 1) {
      this.historyIndex++;
      return this.navigationHistory[this.historyIndex];
    }
    return null;
  }

  canGoBack(): boolean {
    return this.historyIndex > 0;
  }
  canGoForward(): boolean {
    return this.historyIndex < this.navigationHistory.length - 1;
  }
  clearHistory(): void {
    this.navigationHistory = [];
    this.historyIndex = -1;
  }

  // ============ 工具方法 ============

  /** 符号类型图标 */
  getSymbolIcon(kind: SymbolKind): string {
    const icons: Record<number, string> = {
      [SymbolKind.File]: "📄",
      [SymbolKind.Module]: "📦",
      [SymbolKind.Namespace]: "🗂️",
      [SymbolKind.Package]: "📦",
      [SymbolKind.Class]: "🔷",
      [SymbolKind.Method]: "🔹",
      [SymbolKind.Property]: "🔸",
      [SymbolKind.Field]: "🔸",
      [SymbolKind.Constructor]: "🔨",
      [SymbolKind.Enum]: "📊",
      [SymbolKind.Interface]: "🔶",
      [SymbolKind.Function]: "⚡",
      [SymbolKind.Variable]: "📝",
      [SymbolKind.Constant]: "🔒",
      [SymbolKind.String]: "📜",
      [SymbolKind.Number]: "🔢",
      [SymbolKind.Boolean]: "✅",
      [SymbolKind.Array]: "📚",
      [SymbolKind.Object]: "🧩",
      [SymbolKind.Struct]: "🏗️",
    };
    return icons[kind] || "📌";
  }

  /** 符号类型名称 */
  getSymbolKindName(kind: SymbolKind): string {
    const names: Record<number, string> = {
      [SymbolKind.File]: "文件",
      [SymbolKind.Module]: "模块",
      [SymbolKind.Namespace]: "命名空间",
      [SymbolKind.Package]: "包",
      [SymbolKind.Class]: "类",
      [SymbolKind.Method]: "方法",
      [SymbolKind.Property]: "属性",
      [SymbolKind.Field]: "字段",
      [SymbolKind.Constructor]: "构造函数",
      [SymbolKind.Enum]: "枚举",
      [SymbolKind.Interface]: "接口",
      [SymbolKind.Function]: "函数",
      [SymbolKind.Variable]: "变量",
      [SymbolKind.Constant]: "常量",
      [SymbolKind.Struct]: "结构体",
    };
    return names[kind] || "符号";
  }
}

export const codeNavigation = new CodeNavigation();
export default codeNavigation;
