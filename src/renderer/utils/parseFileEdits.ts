/**
 * AI 回复文件编辑解析器
 * 从 markdown 中提取 ```lang:filepath 格式的代码块，构建 FileChange[]
 */
import type { FileChange } from "../components/AIPanel/MultiFileChanges";
import { getLanguageFromPath } from "../components/MarkdownRenderer";

export interface ParsedFileEdit {
  filePath: string;
  language: string;
  newContent: string;
}

const CODE_BLOCK_RE = /```(\w+):([^\n]+)\n([\s\S]*?)```/g;

/** 从 markdown 文本中提取文件编辑信息 */
export function parseFileEditsFromMarkdown(text: string): ParsedFileEdit[] {
  const edits: ParsedFileEdit[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = CODE_BLOCK_RE.exec(text)) !== null) {
    const [, language, filePath, newContent] = match;
    const trimmedPath = filePath.trim();
    // 同一文件取最后一个代码块
    if (seen.has(trimmedPath)) {
      const idx = edits.findIndex((e) => e.filePath === trimmedPath);
      if (idx !== -1) edits[idx] = { filePath: trimmedPath, language, newContent };
    } else {
      seen.add(trimmedPath);
      edits.push({ filePath: trimmedPath, language, newContent });
    }
  }
  return edits;
}

/** 计算行级 additions/deletions */
function computeDiff(original: string, modified: string): { additions: number; deletions: number } {
  const oldLines = original ? original.split("\n") : [];
  const newLines = modified.split("\n");
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);
  let additions = 0;
  let deletions = 0;
  for (const line of newLines) {
    if (!oldSet.has(line)) additions++;
  }
  for (const line of oldLines) {
    if (!newSet.has(line)) deletions++;
  }
  return { additions, deletions };
}

/** 读取原文件并构建 FileChange[] */
export async function buildFileChanges(edits: ParsedFileEdit[]): Promise<FileChange[]> {
  const changes: FileChange[] = [];

  for (const edit of edits) {
    let originalContent = "";
    let isNewFile = false;

    try {
      const res = await window.mindcode?.fs?.readFile?.(edit.filePath);
      if (res?.success && res.data) {
        originalContent = res.data;
      } else {
        isNewFile = true;
      }
    } catch {
      isNewFile = true;
    }

    const lang = edit.language || getLanguageFromPath(edit.filePath);
    const { additions, deletions } = computeDiff(originalContent, edit.newContent);

    changes.push({
      id: `fc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      filePath: edit.filePath,
      originalContent,
      newContent: edit.newContent,
      language: lang,
      isNewFile,
      status: "pending",
      additions,
      deletions,
    });
  }

  return changes;
}
