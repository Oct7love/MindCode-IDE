// 超长文件分块策略
export interface FileChunk { index: number; startLine: number; endLine: number; content: string; }
export interface ChunkedFile { path: string; totalLines: number; totalChars: number; chunks: FileChunk[]; summary?: string; }

export const FILE_LIMITS = { maxChars: 50000, maxLines: 500, chunkSize: 200, summaryLines: 50 }; // 文件大小限制

export function shouldChunkFile(content: string): boolean { // 判断是否需要分块
  return content.length > FILE_LIMITS.maxChars || content.split('\n').length > FILE_LIMITS.maxLines;
}

export function chunkFile(path: string, content: string): ChunkedFile { // 分块处理文件
  const lines = content.split('\n');
  const totalLines = lines.length, totalChars = content.length;
  if (!shouldChunkFile(content)) return { path, totalLines, totalChars, chunks: [{ index: 0, startLine: 1, endLine: totalLines, content }] };
  const chunks: FileChunk[] = [];
  for (let i = 0; i < totalLines; i += FILE_LIMITS.chunkSize) {
    const start = i, end = Math.min(i + FILE_LIMITS.chunkSize, totalLines);
    chunks.push({ index: chunks.length, startLine: start + 1, endLine: end, content: lines.slice(start, end).join('\n') });
  }
  return { path, totalLines, totalChars, chunks, summary: generateFileSummary(path, lines) };
}

export function generateFileSummary(path: string, lines: string[]): string { // 生成文件摘要
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const codeExtensions = ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs', 'c', 'cpp', 'h'];
  let summary = `文件: ${path}\n总行数: ${lines.length}\n\n`;
  if (codeExtensions.includes(ext)) { // 代码文件：提取结构
    const imports: string[] = [], exports: string[] = [], classes: string[] = [], functions: string[] = [];
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) imports.push(`L${i + 1}: ${trimmed.slice(0, 80)}`);
      if (trimmed.startsWith('export ')) exports.push(`L${i + 1}: ${trimmed.slice(0, 80)}`);
      if (trimmed.match(/^(export\s+)?(class|interface|type|enum)\s+\w+/)) classes.push(`L${i + 1}: ${trimmed.slice(0, 80)}`);
      if (trimmed.match(/^(export\s+)?(async\s+)?(function|const|let|var)\s+\w+.*[=(]/)) functions.push(`L${i + 1}: ${trimmed.slice(0, 80)}`);
    });
    if (imports.length) summary += `【导入 (${imports.length})】\n${imports.slice(0, 10).join('\n')}${imports.length > 10 ? '\n...' : ''}\n\n`;
    if (classes.length) summary += `【类/接口 (${classes.length})】\n${classes.join('\n')}\n\n`;
    if (functions.length) summary += `【函数 (${functions.length})】\n${functions.slice(0, 20).join('\n')}${functions.length > 20 ? '\n...' : ''}\n\n`;
    if (exports.length) summary += `【导出 (${exports.length})】\n${exports.slice(0, 10).join('\n')}${exports.length > 10 ? '\n...' : ''}\n\n`;
  }
  summary += `【开头 ${FILE_LIMITS.summaryLines} 行】\n${lines.slice(0, FILE_LIMITS.summaryLines).join('\n')}\n\n`;
  summary += `【结尾 20 行】\n${lines.slice(-20).join('\n')}`;
  return summary;
}

export function getChunkByLine(chunked: ChunkedFile, lineNumber: number): FileChunk | null { // 根据行号获取分块
  return chunked.chunks.find(c => lineNumber >= c.startLine && lineNumber <= c.endLine) || null;
}

export function mergeChunks(chunks: FileChunk[]): string { // 合并分块
  return chunks.sort((a, b) => a.startLine - b.startLine).map(c => c.content).join('\n');
}

export function formatChunkedFileForContext(chunked: ChunkedFile, includeFullContent = false): string { // 格式化分块文件用于上下文
  if (chunked.chunks.length === 1 || includeFullContent) return `【文件: ${chunked.path}】\n${mergeChunks(chunked.chunks)}`;
  let result = `【文件: ${chunked.path}】\n总行数: ${chunked.totalLines}, 分块数: ${chunked.chunks.length}\n\n`;
  if (chunked.summary) result += `【摘要】\n${chunked.summary}\n\n`;
  result += `【分块信息】\n${chunked.chunks.map(c => `- 块 ${c.index}: 行 ${c.startLine}-${c.endLine}`).join('\n')}`;
  result += `\n\n提示: 如需查看特定行，请使用 workspace.readFile 并指定 startLine/endLine`;
  return result;
}
