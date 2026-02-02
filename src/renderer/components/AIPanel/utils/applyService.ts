/**
 * Apply Service - 代码应用服务
 * 负责解析代码块、检测文件路径、应用代码到编辑器
 */

export interface PendingChange {
  id: string;
  filePath: string;
  originalContent: string;
  newContent: string;
  language: string;
  status: 'pending' | 'previewing' | 'applied' | 'rejected';
  isNewFile: boolean;
  timestamp: Date;
}

export interface ParsedCodeBlock {
  code: string;
  language: string;
  filePath: string | null;
  isNewFile: boolean;
}

/**
 * 从代码块中检测文件路径
 * 支持多种格式：
 * 1. ```typescript:src/utils/helper.ts
 * 2. // filepath: src/utils/helper.ts
 * 3. 上文提及 "修改 src/App.tsx"
 */
export function detectFilePath(
  codeBlock: string, 
  language: string, 
  contextText?: string
): string | null {
  // 1. 检查代码块第一行的文件路径注释
  const lines = codeBlock.split('\n');
  const firstLine = lines[0]?.trim() || '';
  
  // 格式: // filepath: xxx 或 // file: xxx
  const filePathCommentMatch = firstLine.match(/^\/\/\s*(?:filepath|file|path):\s*(.+)/i);
  if (filePathCommentMatch) {
    return normalizeFilePath(filePathCommentMatch[1].trim());
  }
  
  // 格式: # filepath: xxx (Python/Shell)
  const hashCommentMatch = firstLine.match(/^#\s*(?:filepath|file|path):\s*(.+)/i);
  if (hashCommentMatch) {
    return normalizeFilePath(hashCommentMatch[1].trim());
  }
  
  // 格式: // src/utils/helper.ts
  const simplePathMatch = firstLine.match(/^\/\/\s*([^\s]+\.\w+)\s*$/);
  if (simplePathMatch && isLikelyFilePath(simplePathMatch[1])) {
    return normalizeFilePath(simplePathMatch[1]);
  }
  
  // 2. 检查上文提及的文件路径
  if (contextText) {
    // 格式: "修改 xxx 文件" 或 "创建 xxx" 或 "更新 xxx"
    const mentionPatterns = [
      /(?:修改|更新|编辑|创建|新建|添加到|写入)\s*[`"']?([^\s`"']+\.\w+)[`"']?/gi,
      /(?:in|to|file|update|edit|create|modify)\s*[`"']?([^\s`"']+\.\w+)[`"']?/gi,
    ];
    
    for (const pattern of mentionPatterns) {
      const matches = [...contextText.matchAll(pattern)];
      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        if (isLikelyFilePath(lastMatch[1])) {
          return normalizeFilePath(lastMatch[1]);
        }
      }
    }
  }
  
  // 3. 根据语言推断可能的文件扩展名（用于新文件）
  return null;
}

/**
 * 检查字符串是否像文件路径
 */
function isLikelyFilePath(str: string): boolean {
  // 必须包含扩展名
  if (!str.includes('.')) return false;
  
  // 排除 URL
  if (str.startsWith('http://') || str.startsWith('https://')) return false;
  
  // 排除版本号格式
  if (/^\d+\.\d+\.\d+$/.test(str)) return false;
  
  // 排除包含中文字符的路径（防止误识别中文文本）
  if (/[\u4e00-\u9fff]/.test(str)) return false;
  
  // 排除以标点符号开头的（如 "，如stm32f4xx_hal.h"）
  if (/^[,，。！？：；、]/.test(str)) return false;
  
  // 必须以字母、数字或路径符号开头
  if (!/^[a-zA-Z0-9_.\-\/\\]/.test(str)) return false;
  
  // 常见代码文件扩展名
  const codeExtensions = [
    'ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'hpp',
    'css', 'scss', 'less', 'html', 'vue', 'svelte', 'json', 'yaml', 'yml',
    'md', 'txt', 'sh', 'bash', 'sql', 'graphql', 'prisma', 'toml', 'xml',
  ];
  
  const ext = str.split('.').pop()?.toLowerCase();
  return ext ? codeExtensions.includes(ext) : false;
}

/**
 * 规范化文件路径
 */
function normalizeFilePath(path: string): string {
  // 移除引号
  path = path.replace(/^["'`]|["'`]$/g, '');
  
  // 统一使用正斜杠
  path = path.replace(/\\/g, '/');
  
  // 移除开头的 ./
  if (path.startsWith('./')) {
    path = path.slice(2);
  }
  
  return path;
}

/**
 * 根据语言获取默认文件扩展名
 */
export function getExtensionForLanguage(language: string): string {
  const extensionMap: Record<string, string> = {
    typescript: 'ts',
    typescriptreact: 'tsx',
    javascript: 'js',
    javascriptreact: 'jsx',
    python: 'py',
    go: 'go',
    rust: 'rs',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    csharp: 'cs',
    css: 'css',
    scss: 'scss',
    less: 'less',
    html: 'html',
    vue: 'vue',
    svelte: 'svelte',
    json: 'json',
    yaml: 'yaml',
    markdown: 'md',
    shell: 'sh',
    bash: 'sh',
    sql: 'sql',
    graphql: 'graphql',
    plaintext: 'txt',
  };
  
  return extensionMap[language.toLowerCase()] || 'txt';
}

/**
 * 生成唯一的变更 ID
 */
export function generateChangeId(): string {
  return `change_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 清理代码块中的文件路径注释（应用时不需要）
 */
export function cleanCodeForApply(code: string): string {
  const lines = code.split('\n');
  
  // 检查第一行是否是文件路径注释
  const firstLine = lines[0]?.trim() || '';
  if (
    /^\/\/\s*(?:filepath|file|path):/i.test(firstLine) ||
    /^#\s*(?:filepath|file|path):/i.test(firstLine) ||
    /^\/\/\s*[^\s]+\.\w+\s*$/.test(firstLine)
  ) {
    lines.shift();
    // 如果第二行是空行，也移除
    if (lines[0]?.trim() === '') {
      lines.shift();
    }
  }
  
  return lines.join('\n');
}

/**
 * 判断是完整替换还是局部修改
 */
export function isFullFileReplacement(code: string, language: string): boolean {
  // 检查是否包含文件起始标记
  const fullFilePatterns: Record<string, RegExp[]> = {
    typescript: [/^import\s/, /^export\s/, /^\/\*\*/, /^'use strict'/],
    javascript: [/^import\s/, /^export\s/, /^\/\*\*/, /^'use strict'/, /^const\s/],
    python: [/^import\s/, /^from\s.*import/, /^def\s/, /^class\s/, /^#!.*python/],
    go: [/^package\s/, /^import\s/],
    rust: [/^use\s/, /^mod\s/, /^fn\s+main/, /^pub\s/],
    java: [/^package\s/, /^import\s/, /^public\s+class/],
    c: [/^#include\s/, /^int\s+main/],
    cpp: [/^#include\s/, /^int\s+main/, /^namespace\s/],
    html: [/^<!DOCTYPE/i, /^<html/i],
    css: [/^@import/, /^:root/, /^\*\s*\{/],
    json: [/^\s*\{/, /^\s*\[/],
  };
  
  const patterns = fullFilePatterns[language.toLowerCase()] || [];
  const firstLines = code.split('\n').slice(0, 5).join('\n');
  
  return patterns.some(pattern => pattern.test(firstLines));
}
