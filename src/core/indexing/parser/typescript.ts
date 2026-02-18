/**
 * TypeScript/JavaScript AST 解析器
 * 提取代码结构和符号信息
 */

import * as ts from "typescript";
import type { CodeSymbol, ParameterInfo, FileDependency, CallRelation } from "../types";

/** 解析结果 */
export interface ParseResult {
  /** 提取的符号 */
  symbols: CodeSymbol[];
  /** 文件依赖 */
  dependencies: FileDependency[];
  /** 调用关系 */
  callRelations: CallRelation[];
  /** 解析错误 */
  errors: Array<{ line: number; message: string }>;
}

/** TypeScript 解析器 */
export class TypeScriptParser {
  private symbolIdCounter = 0;

  /**
   * 解析 TypeScript/JavaScript 文件
   */
  parse(filePath: string, sourceCode: string): ParseResult {
    const symbols: CodeSymbol[] = [];
    const dependencies: FileDependency[] = [];
    const callRelations: CallRelation[] = [];
    const errors: Array<{ line: number; message: string }> = [];

    // 确定文件类型
    const isTypeScript = filePath.endsWith(".ts") || filePath.endsWith(".tsx");
    const isJsx = filePath.endsWith(".tsx") || filePath.endsWith(".jsx");

    // 创建源文件
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceCode,
      ts.ScriptTarget.Latest,
      true,
      isJsx ? ts.ScriptKind.TSX : isTypeScript ? ts.ScriptKind.TS : ts.ScriptKind.JS,
    );

    // 收集诊断错误
    // Note: 完整的类型检查需要 Program，这里只做语法解析

    // 符号 ID 映射（用于建立父子关系）
    const nodeToSymbolId = new Map<ts.Node, string>();

    // 遍历 AST
    const visit = (node: ts.Node, parentId?: string) => {
      const symbol = this.extractSymbol(node, sourceFile, filePath, parentId);

      if (symbol) {
        symbols.push(symbol);
        nodeToSymbolId.set(node, symbol.id);

        // 遍历子节点时传递当前符号作为父
        ts.forEachChild(node, (child) => visit(child, symbol.id));
      } else {
        // 非符号节点，继续遍历
        ts.forEachChild(node, (child) => visit(child, parentId));
      }

      // 提取导入依赖
      if (ts.isImportDeclaration(node)) {
        const dep = this.extractImportDependency(node, sourceFile, filePath);
        if (dep) dependencies.push(dep);
      }

      // 提取调用关系
      if (ts.isCallExpression(node) && parentId) {
        const call = this.extractCallRelation(node, sourceFile, parentId);
        if (call) callRelations.push(call);
      }
    };

    ts.forEachChild(sourceFile, (node) => visit(node));

    return { symbols, dependencies, callRelations, errors };
  }

  /**
   * 提取符号信息
   */
  private extractSymbol(
    node: ts.Node,
    sourceFile: ts.SourceFile,
    filePath: string,
    parentId?: string,
  ): CodeSymbol | null {
    const { line: startLine, character: startColumn } = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(),
    );
    const { line: endLine, character: endColumn } = sourceFile.getLineAndCharacterOfPosition(
      node.getEnd(),
    );

    let symbol: Partial<CodeSymbol> | null = null;

    // 函数声明
    if (ts.isFunctionDeclaration(node) && node.name) {
      symbol = {
        name: node.name.text,
        kind: "function",
        signature: this.getFunctionSignature(node, sourceFile),
        parameters: this.extractParameters(node.parameters, sourceFile),
        returnType: node.type ? node.type.getText(sourceFile) : undefined,
        modifiers: this.getModifiers(node),
        typeParameters: this.getTypeParameters(node.typeParameters, sourceFile),
        documentation: this.getJsDoc(node, sourceFile),
      };
    }

    // 类声明
    else if (ts.isClassDeclaration(node) && node.name) {
      symbol = {
        name: node.name.text,
        kind: "class",
        signature: `class ${node.name.text}${this.getHeritageClause(node)}`,
        modifiers: this.getModifiers(node),
        typeParameters: this.getTypeParameters(node.typeParameters, sourceFile),
        documentation: this.getJsDoc(node, sourceFile),
      };
    }

    // 接口声明
    else if (ts.isInterfaceDeclaration(node)) {
      symbol = {
        name: node.name.text,
        kind: "interface",
        signature: `interface ${node.name.text}${this.getHeritageClause(node)}`,
        typeParameters: this.getTypeParameters(node.typeParameters, sourceFile),
        documentation: this.getJsDoc(node, sourceFile),
      };
    }

    // 类型别名
    else if (ts.isTypeAliasDeclaration(node)) {
      symbol = {
        name: node.name.text,
        kind: "type",
        signature: `type ${node.name.text} = ${node.type.getText(sourceFile)}`,
        typeParameters: this.getTypeParameters(node.typeParameters, sourceFile),
        documentation: this.getJsDoc(node, sourceFile),
      };
    }

    // 枚举声明
    else if (ts.isEnumDeclaration(node)) {
      symbol = {
        name: node.name.text,
        kind: "enum",
        modifiers: this.getModifiers(node),
        documentation: this.getJsDoc(node, sourceFile),
      };
    }

    // 方法声明（类内部）
    else if (ts.isMethodDeclaration(node) && node.name) {
      const name = ts.isIdentifier(node.name) ? node.name.text : node.name.getText(sourceFile);
      symbol = {
        name,
        kind: "method",
        signature: this.getMethodSignature(node, sourceFile),
        parameters: this.extractParameters(node.parameters, sourceFile),
        returnType: node.type ? node.type.getText(sourceFile) : undefined,
        modifiers: this.getModifiers(node),
        documentation: this.getJsDoc(node, sourceFile),
      };
    }

    // 属性声明（类内部）
    else if (ts.isPropertyDeclaration(node) && node.name) {
      const name = ts.isIdentifier(node.name) ? node.name.text : node.name.getText(sourceFile);
      symbol = {
        name,
        kind: "property",
        returnType: node.type ? node.type.getText(sourceFile) : undefined,
        modifiers: this.getModifiers(node),
        documentation: this.getJsDoc(node, sourceFile),
      };
    }

    // 变量声明（顶层）
    else if (ts.isVariableStatement(node) && !parentId) {
      // 变量声明可能有多个
      const declarations = node.declarationList.declarations;
      if (declarations.length === 1) {
        const decl = declarations[0];
        if (ts.isIdentifier(decl.name)) {
          const isConst = (node.declarationList.flags & ts.NodeFlags.Const) !== 0;
          symbol = {
            name: decl.name.text,
            kind: isConst ? "constant" : "variable",
            returnType: decl.type ? decl.type.getText(sourceFile) : undefined,
            modifiers: this.getModifiers(node),
            documentation: this.getJsDoc(node, sourceFile),
          };
        }
      }
    }

    // 箭头函数（赋值给变量）
    else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      if (
        node.initializer &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
      ) {
        const func = node.initializer;
        symbol = {
          name: node.name.text,
          kind: "function",
          signature: this.getArrowFunctionSignature(node.name.text, func, sourceFile),
          parameters: this.extractParameters(func.parameters, sourceFile),
          returnType: func.type ? func.type.getText(sourceFile) : undefined,
          documentation: this.getJsDoc(node.parent?.parent || node, sourceFile),
        };
      }
    }

    // 命名空间/模块
    else if (ts.isModuleDeclaration(node) && ts.isIdentifier(node.name)) {
      symbol = {
        name: node.name.text,
        kind: "namespace",
        modifiers: this.getModifiers(node),
        documentation: this.getJsDoc(node, sourceFile),
      };
    }

    // 导出声明
    else if (ts.isExportAssignment(node)) {
      symbol = {
        name: "default",
        kind: "export",
        exportType: "default",
      };
    }

    if (symbol) {
      return {
        id: this.generateSymbolId(filePath),
        filePath,
        startLine: startLine + 1, // 转为 1-based
        endLine: endLine + 1,
        startColumn: startColumn + 1,
        endColumn: endColumn + 1,
        parentId,
        ...symbol,
      } as CodeSymbol;
    }

    return null;
  }

  /**
   * 提取导入依赖
   */
  private extractImportDependency(
    node: ts.ImportDeclaration,
    sourceFile: ts.SourceFile,
    filePath: string,
  ): FileDependency | null {
    const moduleSpecifier = node.moduleSpecifier;
    if (!ts.isStringLiteral(moduleSpecifier)) return null;

    const targetPath = moduleSpecifier.text;
    const importedSymbols: string[] = [];
    let isTypeOnly = false;

    if (node.importClause) {
      isTypeOnly = node.importClause.isTypeOnly || false;

      // 默认导入
      if (node.importClause.name) {
        importedSymbols.push(node.importClause.name.text);
      }

      // 命名导入
      const namedBindings = node.importClause.namedBindings;
      if (namedBindings) {
        if (ts.isNamedImports(namedBindings)) {
          namedBindings.elements.forEach((el) => {
            importedSymbols.push(el.name.text);
          });
        } else if (ts.isNamespaceImport(namedBindings)) {
          importedSymbols.push(`* as ${namedBindings.name.text}`);
        }
      }
    }

    return {
      sourceFile: filePath,
      targetFile: targetPath,
      type: "import",
      importedSymbols,
      isTypeOnly,
    };
  }

  /**
   * 提取调用关系
   */
  private extractCallRelation(
    node: ts.CallExpression,
    sourceFile: ts.SourceFile,
    callerId: string,
  ): CallRelation | null {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    let calleeName = "";
    let callType: CallRelation["callType"] = "direct";

    const expression = node.expression;

    if (ts.isIdentifier(expression)) {
      calleeName = expression.text;
    } else if (ts.isPropertyAccessExpression(expression)) {
      calleeName = expression.getText(sourceFile);
    } else if (ts.isNewExpression(node.parent)) {
      callType = "constructor";
      if (ts.isIdentifier(expression)) {
        calleeName = expression.text;
      }
    } else {
      callType = "dynamic";
      calleeName = expression.getText(sourceFile);
    }

    if (!calleeName) return null;

    return {
      callerId,
      calleeId: calleeName, // 实际的符号 ID 需要在后处理中解析
      callLine: line + 1,
      callType,
      callExpression: node.getText(sourceFile),
    };
  }

  /**
   * 提取参数信息
   */
  private extractParameters(
    params: ts.NodeArray<ts.ParameterDeclaration>,
    sourceFile: ts.SourceFile,
  ): ParameterInfo[] {
    return params.map((param) => {
      const name = ts.isIdentifier(param.name) ? param.name.text : param.name.getText(sourceFile);
      return {
        name,
        type: param.type ? param.type.getText(sourceFile) : undefined,
        optional: !!param.questionToken,
        defaultValue: param.initializer ? param.initializer.getText(sourceFile) : undefined,
      };
    });
  }

  /**
   * 获取函数签名
   */
  private getFunctionSignature(node: ts.FunctionDeclaration, sourceFile: ts.SourceFile): string {
    const name = node.name?.text || "anonymous";
    const params = node.parameters.map((p) => p.getText(sourceFile)).join(", ");
    const returnType = node.type ? `: ${node.type.getText(sourceFile)}` : "";
    const typeParams = this.getTypeParametersString(node.typeParameters, sourceFile);
    return `function ${name}${typeParams}(${params})${returnType}`;
  }

  /**
   * 获取方法签名
   */
  private getMethodSignature(node: ts.MethodDeclaration, sourceFile: ts.SourceFile): string {
    const name = node.name.getText(sourceFile);
    const params = node.parameters.map((p) => p.getText(sourceFile)).join(", ");
    const returnType = node.type ? `: ${node.type.getText(sourceFile)}` : "";
    const typeParams = this.getTypeParametersString(node.typeParameters, sourceFile);
    return `${name}${typeParams}(${params})${returnType}`;
  }

  /**
   * 获取箭头函数签名
   */
  private getArrowFunctionSignature(
    name: string,
    func: ts.ArrowFunction | ts.FunctionExpression,
    sourceFile: ts.SourceFile,
  ): string {
    const params = func.parameters.map((p) => p.getText(sourceFile)).join(", ");
    const returnType = func.type ? `: ${func.type.getText(sourceFile)}` : "";
    const typeParams = this.getTypeParametersString(func.typeParameters, sourceFile);
    return `const ${name}${typeParams} = (${params})${returnType} => ...`;
  }

  /**
   * 获取类型参数
   */
  private getTypeParameters(
    typeParams: ts.NodeArray<ts.TypeParameterDeclaration> | undefined,
    sourceFile: ts.SourceFile,
  ): string[] | undefined {
    if (!typeParams || typeParams.length === 0) return undefined;
    return typeParams.map((tp) => tp.getText(sourceFile));
  }

  /**
   * 获取类型参数字符串
   */
  private getTypeParametersString(
    typeParams: ts.NodeArray<ts.TypeParameterDeclaration> | undefined,
    sourceFile: ts.SourceFile,
  ): string {
    if (!typeParams || typeParams.length === 0) return "";
    return `<${typeParams.map((tp) => tp.getText(sourceFile)).join(", ")}>`;
  }

  /**
   * 获取修饰符
   */
  private getModifiers(node: ts.Node): string[] | undefined {
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    if (!modifiers || modifiers.length === 0) return undefined;
    return modifiers.map((m) => ts.tokenToString(m.kind) || "").filter(Boolean);
  }

  /**
   * 获取继承/实现子句
   */
  private getHeritageClause(node: ts.ClassDeclaration | ts.InterfaceDeclaration): string {
    if (!node.heritageClauses || node.heritageClauses.length === 0) return "";

    const parts: string[] = [];
    node.heritageClauses.forEach((clause) => {
      const keyword = clause.token === ts.SyntaxKind.ExtendsKeyword ? "extends" : "implements";
      const types = clause.types.map((t) => t.getText()).join(", ");
      parts.push(`${keyword} ${types}`);
    });

    return parts.length > 0 ? ` ${parts.join(" ")}` : "";
  }

  /**
   * 获取 JSDoc 注释
   */
  private getJsDoc(node: ts.Node, _sourceFile: ts.SourceFile): string | undefined {
    const jsDocs = (node as any).jsDoc;
    if (!jsDocs || jsDocs.length === 0) return undefined;

    const comments: string[] = [];
    for (const jsDoc of jsDocs) {
      if (jsDoc.comment) {
        if (typeof jsDoc.comment === "string") {
          comments.push(jsDoc.comment);
        } else {
          comments.push(jsDoc.comment.map((c: any) => c.text || "").join(""));
        }
      }
    }

    return comments.length > 0 ? comments.join("\n") : undefined;
  }

  /**
   * 生成唯一符号 ID
   */
  private generateSymbolId(filePath: string): string {
    return `${filePath}#${++this.symbolIdCounter}`;
  }
}

/** 创建解析器实例 */
export function createTypeScriptParser(): TypeScriptParser {
  return new TypeScriptParser();
}
