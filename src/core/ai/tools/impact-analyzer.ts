// 变更影响分析器
export interface FileReference { file: string; line: number; type: 'import' | 'require' | 'usage'; text: string; }
export interface ImpactAnalysis { targetFile: string; affectedFiles: FileReference[]; testFiles: string[]; typeIssues: string[]; rollbackPath?: string; }

export async function analyzeImpact(targetPath: string, workspaceRoot: string): Promise<ImpactAnalysis> { // 分析文件变更影响
  const analysis: ImpactAnalysis = { targetFile: targetPath, affectedFiles: [], testFiles: [], typeIssues: [] };
  const fileName = targetPath.split(/[/\\]/).pop() || '';
  const baseName = fileName.replace(/\.(ts|tsx|js|jsx)$/, '');
  try { // 搜索引用该文件的其他文件
    const searchResult = await (window as any).mindcode?.fs?.searchInFiles?.({ workspacePath: workspaceRoot, query: baseName, maxResults: 50 });
    if (searchResult?.success && searchResult.data) {
      for (const match of searchResult.data) {
        if (match.file === targetPath) continue;
        const text = match.text.trim();
        let type: FileReference['type'] = 'usage';
        if (text.includes('import ') || text.includes('from ')) type = 'import';
        else if (text.includes('require(')) type = 'require';
        analysis.affectedFiles.push({ file: match.file, line: match.line, type, text: text.slice(0, 100) });
      }
    }
    // 查找相关测试文件
    const testPatterns = [`${baseName}.test.`, `${baseName}.spec.`, `${baseName}_test.`];
    const allFiles = await (window as any).mindcode?.fs?.getAllFiles?.(workspaceRoot);
    if (allFiles?.success && allFiles.data) {
      analysis.testFiles = allFiles.data.filter((f: any) => testPatterns.some(p => f.name.includes(p))).map((f: any) => f.path);
    }
  } catch (e) { console.error('Impact analysis error:', e); }
  return analysis;
}

export function formatImpactForDisplay(analysis: ImpactAnalysis): string { // 格式化影响分析结果
  let result = `【变更影响分析: ${analysis.targetFile}】\n\n`;
  if (analysis.affectedFiles.length === 0) result += '✅ 未发现其他文件引用此文件\n\n';
  else {
    result += `⚠️ ${analysis.affectedFiles.length} 个文件引用了此文件:\n`;
    const byType = { import: [] as FileReference[], require: [] as FileReference[], usage: [] as FileReference[] };
    analysis.affectedFiles.forEach(f => byType[f.type].push(f));
    if (byType.import.length) result += `\n【import 引用 (${byType.import.length})】\n${byType.import.map(f => `  ${f.file}:${f.line}`).join('\n')}\n`;
    if (byType.require.length) result += `\n【require 引用 (${byType.require.length})】\n${byType.require.map(f => `  ${f.file}:${f.line}`).join('\n')}\n`;
    if (byType.usage.length) result += `\n【其他引用 (${byType.usage.length})】\n${byType.usage.slice(0, 10).map(f => `  ${f.file}:${f.line}`).join('\n')}\n`;
  }
  if (analysis.testFiles.length) result += `\n📝 相关测试文件 (${analysis.testFiles.length}):\n${analysis.testFiles.map(f => `  ${f}`).join('\n')}\n`;
  if (analysis.typeIssues.length) result += `\n❌ 类型问题:\n${analysis.typeIssues.map(i => `  ${i}`).join('\n')}\n`;
  return result;
}
