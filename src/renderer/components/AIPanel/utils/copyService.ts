/**
 * CopyService - 剪贴板复制服务
 * 
 * 功能：
 * 1. navigator.clipboard API (优先)
 * 2. document.execCommand 降级方案
 * 3. 消息内容序列化 (Plain Text / Markdown)
 */

// ============================================
// 类型定义
// ============================================

export type CopyFormat = 'markdown' | 'plaintext';

export interface CopyResult {
  success: boolean;
  error?: string;
}

export interface ParsedContent {
  type: 'paragraph' | 'heading' | 'list' | 'code' | 'blockquote' | 'link' | 'hr';
  content: string;
  level?: number;           // heading level
  language?: string;        // code language
  ordered?: boolean;        // list ordered
  items?: string[];         // list items
  url?: string;             // link url
}

// ============================================
// 核心复制函数
// ============================================

/**
 * 复制文本到剪贴板 (带降级方案)
 */
export async function copyToClipboard(text: string): Promise<CopyResult> {
  // 方案1: 使用现代 Clipboard API
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return { success: true };
    } catch (err) {
      console.warn('[CopyService] Clipboard API failed, trying fallback:', err);
    }
  }

  // 方案2: 使用 execCommand 降级
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    
    if (success) {
      return { success: true };
    }
    return { success: false, error: 'execCommand failed' };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ============================================
// Markdown 解析
// ============================================

/**
 * 解析 Markdown 为结构化内容
 */
export function parseMarkdownContent(markdown: string): ParsedContent[] {
  const blocks: ParsedContent[] = [];
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // 空行跳过
    if (!trimmedLine) {
      i++;
      continue;
    }

    // 代码块 ```
    if (trimmedLine.startsWith('```')) {
      const language = trimmedLine.slice(3).trim() || 'text';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: 'code',
        content: codeLines.join('\n'),
        language
      });
      i++; // 跳过结束的 ```
      continue;
    }

    // 标题 #
    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        content: headingMatch[2],
        level: headingMatch[1].length
      });
      i++;
      continue;
    }

    // 分割线 ---
    if (/^[-*_]{3,}$/.test(trimmedLine)) {
      blocks.push({ type: 'hr', content: '' });
      i++;
      continue;
    }

    // 引用块 >
    if (trimmedLine.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().slice(1).trim());
        i++;
      }
      blocks.push({
        type: 'blockquote',
        content: quoteLines.join('\n')
      });
      continue;
    }

    // 列表 - 或 1.
    const listMatch = trimmedLine.match(/^([-*]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const items: string[] = [];
      const ordered = /^\d+\./.test(listMatch[1]);
      while (i < lines.length) {
        const listItemMatch = lines[i].trim().match(/^([-*]|\d+\.)\s+(.+)$/);
        if (listItemMatch) {
          items.push(listItemMatch[2]);
          i++;
        } else if (lines[i].trim() === '') {
          i++;
          // 检查下一行是否还是列表项
          if (i < lines.length && lines[i].trim().match(/^([-*]|\d+\.)\s+/)) {
            continue;
          }
          break;
        } else {
          break;
        }
      }
      blocks.push({
        type: 'list',
        content: '',
        ordered,
        items
      });
      continue;
    }

    // 普通段落
    const paragraphLines: string[] = [trimmedLine];
    i++;
    while (i < lines.length && lines[i].trim() && 
           !lines[i].trim().startsWith('#') &&
           !lines[i].trim().startsWith('```') &&
           !lines[i].trim().startsWith('>') &&
           !lines[i].trim().match(/^([-*]|\d+\.)\s+/) &&
           !lines[i].trim().match(/^[-*_]{3,}$/)) {
      paragraphLines.push(lines[i].trim());
      i++;
    }
    blocks.push({
      type: 'paragraph',
      content: paragraphLines.join(' ')
    });
  }

  return blocks;
}

// ============================================
// 内容序列化
// ============================================

/**
 * 处理内联元素 (粗体、斜体、链接等) 转为纯文本
 */
function inlineToPlainText(text: string): string {
  return text
    // 链接 [text](url) -> text (url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    // 粗体 **text** -> text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // 斜体 *text* -> text
    .replace(/\*([^*]+)\*/g, '$1')
    // 删除线 ~~text~~ -> text
    .replace(/~~([^~]+)~~/g, '$1')
    // 行内代码 `code` -> code
    .replace(/`([^`]+)`/g, '$1');
}

/**
 * 序列化为 Plain Text
 */
export function serializeToPlainText(markdown: string): string {
  const blocks = parseMarkdownContent(markdown);
  const result: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph':
        result.push(inlineToPlainText(block.content));
        result.push('');
        break;

      case 'heading':
        result.push(inlineToPlainText(block.content));
        result.push('');
        break;

      case 'list':
        if (block.items) {
          block.items.forEach((item, index) => {
            const bullet = block.ordered ? `${index + 1}.` : '-';
            result.push(`${bullet} ${inlineToPlainText(item)}`);
          });
        }
        result.push('');
        break;

      case 'code':
        // 代码块不加围栏，直接输出代码
        result.push(block.content);
        result.push('');
        break;

      case 'blockquote':
        const quoteLines = block.content.split('\n');
        quoteLines.forEach(line => {
          result.push(`> ${inlineToPlainText(line)}`);
        });
        result.push('');
        break;

      case 'hr':
        result.push('---');
        result.push('');
        break;
    }
  }

  // 清理多余空行
  return result.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * 序列化为 Markdown (规范化格式)
 */
export function serializeToMarkdown(markdown: string): string {
  const blocks = parseMarkdownContent(markdown);
  const result: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph':
        result.push(block.content);
        result.push('');
        break;

      case 'heading':
        const hashes = '#'.repeat(block.level || 1);
        result.push(`${hashes} ${block.content}`);
        result.push('');
        break;

      case 'list':
        if (block.items) {
          block.items.forEach((item, index) => {
            const bullet = block.ordered ? `${index + 1}.` : '-';
            result.push(`${bullet} ${item}`);
          });
        }
        result.push('');
        break;

      case 'code':
        result.push(`\`\`\`${block.language || ''}`);
        result.push(block.content);
        result.push('```');
        result.push('');
        break;

      case 'blockquote':
        const quoteLines = block.content.split('\n');
        quoteLines.forEach(line => {
          result.push(`> ${line}`);
        });
        result.push('');
        break;

      case 'hr':
        result.push('---');
        result.push('');
        break;
    }
  }

  return result.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * 提取所有代码块
 */
export function extractCodeBlocks(markdown: string): Array<{ code: string; language: string }> {
  const blocks = parseMarkdownContent(markdown);
  return blocks
    .filter(b => b.type === 'code')
    .map(b => ({ code: b.content, language: b.language || 'text' }));
}

// ============================================
// 高级复制函数
// ============================================

/**
 * 复制消息内容
 */
export async function copyMessage(
  content: string,
  format: CopyFormat = 'markdown'
): Promise<CopyResult> {
  const text = format === 'plaintext' 
    ? serializeToPlainText(content)
    : serializeToMarkdown(content);
  
  return copyToClipboard(text);
}

/**
 * 复制代码块 (不含围栏)
 */
export async function copyCode(code: string): Promise<CopyResult> {
  return copyToClipboard(code);
}

/**
 * 复制所有代码块
 */
export async function copyAllCodeBlocks(markdown: string): Promise<CopyResult> {
  const codeBlocks = extractCodeBlocks(markdown);
  if (codeBlocks.length === 0) {
    return { success: false, error: 'No code blocks found' };
  }
  
  const combined = codeBlocks
    .map(b => `// ${b.language}\n${b.code}`)
    .join('\n\n');
  
  return copyToClipboard(combined);
}
