/**
 * MindCode - Markdown 渲染组件
 * 解析 AI 消息中的代码块并进行语法高亮
 */

import React, { useState } from 'react';

// 代码块组件
interface CodeBlockProps {
  language: string;
  code: string;
  onCopy?: () => void;
  onApply?: () => void;
}

// 简单的语法高亮规则
const highlightCode = (code: string, language: string): React.ReactNode[] => {
  // 语言相关的关键字
  const keywords: Record<string, string[]> = {
    python: ['def', 'class', 'import', 'from', 'if', 'elif', 'else', 'while', 'for', 'in', 'return', 'try', 'except', 'finally', 'with', 'as', 'True', 'False', 'None', 'and', 'or', 'not', 'is', 'lambda', 'yield', 'break', 'continue', 'pass', 'raise', 'global', 'nonlocal', 'assert', 'del'],
    javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'class', 'extends', 'import', 'export', 'default', 'from', 'async', 'await', 'true', 'false', 'null', 'undefined', 'typeof', 'instanceof'],
    typescript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'class', 'extends', 'import', 'export', 'default', 'from', 'async', 'await', 'true', 'false', 'null', 'undefined', 'typeof', 'instanceof', 'interface', 'type', 'enum', 'implements', 'private', 'public', 'protected', 'readonly', 'static', 'abstract', 'as', 'any', 'void', 'never', 'unknown'],
    java: ['public', 'private', 'protected', 'class', 'interface', 'extends', 'implements', 'static', 'final', 'void', 'int', 'long', 'double', 'float', 'boolean', 'char', 'byte', 'short', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'try', 'catch', 'finally', 'throw', 'throws', 'new', 'this', 'super', 'true', 'false', 'null', 'import', 'package'],
    go: ['package', 'import', 'func', 'var', 'const', 'type', 'struct', 'interface', 'map', 'chan', 'if', 'else', 'for', 'range', 'switch', 'case', 'default', 'break', 'continue', 'return', 'go', 'defer', 'select', 'true', 'false', 'nil'],
    rust: ['fn', 'let', 'mut', 'const', 'static', 'struct', 'enum', 'impl', 'trait', 'pub', 'mod', 'use', 'if', 'else', 'match', 'loop', 'while', 'for', 'in', 'return', 'break', 'continue', 'true', 'false', 'self', 'Self', 'super', 'crate', 'async', 'await', 'move', 'ref', 'where'],
    cpp: ['int', 'long', 'double', 'float', 'char', 'bool', 'void', 'auto', 'const', 'static', 'class', 'struct', 'enum', 'union', 'template', 'typename', 'public', 'private', 'protected', 'virtual', 'override', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'try', 'catch', 'throw', 'new', 'delete', 'this', 'true', 'false', 'nullptr', 'include', 'define', 'namespace', 'using'],
    css: ['color', 'background', 'margin', 'padding', 'border', 'font', 'display', 'position', 'width', 'height', 'top', 'left', 'right', 'bottom', 'flex', 'grid', 'transition', 'transform', 'animation', 'opacity', 'z-index', 'overflow', 'cursor', 'visibility'],
    html: ['html', 'head', 'body', 'div', 'span', 'p', 'a', 'img', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'form', 'input', 'button', 'select', 'option', 'textarea', 'label', 'script', 'style', 'link', 'meta', 'title', 'header', 'footer', 'nav', 'main', 'section', 'article', 'aside'],
    sql: ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'LIKE', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'AS', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN'],
    bash: ['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case', 'esac', 'function', 'return', 'exit', 'echo', 'read', 'export', 'source', 'alias', 'cd', 'ls', 'pwd', 'mkdir', 'rm', 'cp', 'mv', 'cat', 'grep', 'sed', 'awk', 'find', 'chmod', 'chown', 'sudo'],
    json: [],
    yaml: [],
    markdown: [],
  };

  const lang = language.toLowerCase();
  const langKeywords = keywords[lang] || keywords['javascript'] || [];

  const lines = code.split('\n');

  return lines.map((line, lineIndex) => {
    const tokens: React.ReactNode[] = [];
    let remaining = line;
    let tokenIndex = 0;

    while (remaining.length > 0) {
      let matched = false;

      // 匹配注释 (// 或 #)
      const commentMatch = remaining.match(/^(\/\/.*|#.*)$/);
      if (commentMatch) {
        tokens.push(<span key={`${lineIndex}-${tokenIndex++}`} className="syntax-comment">{commentMatch[0]}</span>);
        remaining = '';
        matched = true;
        continue;
      }

      // 匹配多行注释开始
      const multiCommentMatch = remaining.match(/^(\/\*.*?\*\/|<!--.*?-->)/);
      if (multiCommentMatch) {
        tokens.push(<span key={`${lineIndex}-${tokenIndex++}`} className="syntax-comment">{multiCommentMatch[0]}</span>);
        remaining = remaining.slice(multiCommentMatch[0].length);
        matched = true;
        continue;
      }

      // 匹配字符串 (双引号)
      const doubleStringMatch = remaining.match(/^"(?:[^"\\]|\\.)*"/);
      if (doubleStringMatch) {
        tokens.push(<span key={`${lineIndex}-${tokenIndex++}`} className="syntax-string">{doubleStringMatch[0]}</span>);
        remaining = remaining.slice(doubleStringMatch[0].length);
        matched = true;
        continue;
      }

      // 匹配字符串 (单引号)
      const singleStringMatch = remaining.match(/^'(?:[^'\\]|\\.)*'/);
      if (singleStringMatch) {
        tokens.push(<span key={`${lineIndex}-${tokenIndex++}`} className="syntax-string">{singleStringMatch[0]}</span>);
        remaining = remaining.slice(singleStringMatch[0].length);
        matched = true;
        continue;
      }

      // 匹配模板字符串
      const templateStringMatch = remaining.match(/^`(?:[^`\\]|\\.)*`/);
      if (templateStringMatch) {
        tokens.push(<span key={`${lineIndex}-${tokenIndex++}`} className="syntax-string">{templateStringMatch[0]}</span>);
        remaining = remaining.slice(templateStringMatch[0].length);
        matched = true;
        continue;
      }

      // 匹配数字
      const numberMatch = remaining.match(/^\b\d+\.?\d*\b/);
      if (numberMatch) {
        tokens.push(<span key={`${lineIndex}-${tokenIndex++}`} className="syntax-number">{numberMatch[0]}</span>);
        remaining = remaining.slice(numberMatch[0].length);
        matched = true;
        continue;
      }

      // 匹配关键字
      for (const keyword of langKeywords) {
        const regex = new RegExp(`^\\b${keyword}\\b`);
        const keywordMatch = remaining.match(regex);
        if (keywordMatch) {
          tokens.push(<span key={`${lineIndex}-${tokenIndex++}`} className="syntax-keyword">{keywordMatch[0]}</span>);
          remaining = remaining.slice(keywordMatch[0].length);
          matched = true;
          break;
        }
      }
      if (matched) continue;

      // 匹配函数调用
      const funcMatch = remaining.match(/^([a-zA-Z_]\w*)\s*\(/);
      if (funcMatch) {
        tokens.push(<span key={`${lineIndex}-${tokenIndex++}`} className="syntax-function">{funcMatch[1]}</span>);
        tokens.push(<span key={`${lineIndex}-${tokenIndex++}`}>(</span>);
        remaining = remaining.slice(funcMatch[0].length);
        matched = true;
        continue;
      }

      // 匹配标识符
      const identMatch = remaining.match(/^[a-zA-Z_]\w*/);
      if (identMatch) {
        tokens.push(<span key={`${lineIndex}-${tokenIndex++}`} className="syntax-variable">{identMatch[0]}</span>);
        remaining = remaining.slice(identMatch[0].length);
        matched = true;
        continue;
      }

      // 匹配操作符
      const operatorMatch = remaining.match(/^[+\-*/%=<>!&|^~?:]+/);
      if (operatorMatch) {
        tokens.push(<span key={`${lineIndex}-${tokenIndex++}`} className="syntax-operator">{operatorMatch[0]}</span>);
        remaining = remaining.slice(operatorMatch[0].length);
        matched = true;
        continue;
      }

      // 其他字符
      tokens.push(<span key={`${lineIndex}-${tokenIndex++}`}>{remaining[0]}</span>);
      remaining = remaining.slice(1);
    }

    return (
      <div key={lineIndex} className="code-line">
        <span className="line-number">{lineIndex + 1}</span>
        <span className="line-content">{tokens}</span>
      </div>
    );
  });
};

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, code, onCopy, onApply }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-block-lang">{language || 'text'}</span>
        <div className="code-block-actions">
          <button
            className="code-block-btn"
            onClick={handleCopy}
            title={copied ? '已复制!' : '复制代码'}
          >
            {copied ? (
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                <path fillRule="evenodd" clipRule="evenodd" d="M14.431 3.323l-8.47 10-.79-.036-3.35-4.77.818-.574 2.978 4.24 8.051-9.506.763.646z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                <path fillRule="evenodd" clipRule="evenodd" d="M4 4l1-1h5.414L14 6.586V14l-1 1H5l-1-1V4zm9 3l-3-3H5v10h8V7zM3 1L2 2v10l1 1V2h6.414l-1-1H3z"/>
              </svg>
            )}
          </button>
          {onApply && (
            <button
              className="code-block-btn code-block-apply"
              onClick={onApply}
              title="应用到编辑器"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                <path d="M14 7v1H8v6H7V8H1V7h6V1h1v6h6z"/>
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="code-block-content">
        <pre><code>{highlightCode(code, language)}</code></pre>
      </div>
    </div>
  );
};

// 解析 Markdown 文本中的代码块
interface MarkdownProps {
  content: string;
  onApplyCode?: (code: string, language: string) => void;
}

interface ParsedBlock {
  type: 'text' | 'code' | 'inline-code';
  content: string;
  language?: string;
}

const parseMarkdown = (text: string): ParsedBlock[] => {
  const blocks: ParsedBlock[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // 匹配代码块 ```language\n...\n```
    const codeBlockMatch = remaining.match(/^```(\w*)\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      if (remaining.indexOf(codeBlockMatch[0]) > 0) {
        // 代码块之前有文本
        const textBefore = remaining.slice(0, remaining.indexOf(codeBlockMatch[0]));
        if (textBefore.trim()) {
          blocks.push({ type: 'text', content: textBefore });
        }
        remaining = remaining.slice(textBefore.length);
      }
      blocks.push({
        type: 'code',
        language: codeBlockMatch[1] || 'text',
        content: codeBlockMatch[2].trim()
      });
      remaining = remaining.slice(codeBlockMatch[0].length);
      continue;
    }

    // 匹配行内代码 `code`
    const inlineCodeMatch = remaining.match(/^`([^`]+)`/);
    if (inlineCodeMatch) {
      if (remaining.indexOf(inlineCodeMatch[0]) > 0) {
        const textBefore = remaining.slice(0, remaining.indexOf(inlineCodeMatch[0]));
        blocks.push({ type: 'text', content: textBefore });
        remaining = remaining.slice(textBefore.length);
      }
      blocks.push({ type: 'inline-code', content: inlineCodeMatch[1] });
      remaining = remaining.slice(inlineCodeMatch[0].length);
      continue;
    }

    // 查找下一个代码块或行内代码
    const nextCodeBlock = remaining.indexOf('```');
    const nextInlineCode = remaining.indexOf('`');

    if (nextCodeBlock === -1 && nextInlineCode === -1) {
      // 没有更多代码，剩余全是文本
      if (remaining.trim()) {
        blocks.push({ type: 'text', content: remaining });
      }
      break;
    }

    // 找到最近的代码标记
    let nextIndex = -1;
    if (nextCodeBlock !== -1 && nextInlineCode !== -1) {
      nextIndex = Math.min(nextCodeBlock, nextInlineCode);
    } else if (nextCodeBlock !== -1) {
      nextIndex = nextCodeBlock;
    } else {
      nextIndex = nextInlineCode;
    }

    if (nextIndex > 0) {
      blocks.push({ type: 'text', content: remaining.slice(0, nextIndex) });
      remaining = remaining.slice(nextIndex);
    } else {
      // 避免无限循环
      blocks.push({ type: 'text', content: remaining[0] });
      remaining = remaining.slice(1);
    }
  }

  return blocks;
};

// 渲染文本（处理粗体、斜体等）
const renderText = (text: string): React.ReactNode => {
  // 处理粗体 **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    // 处理斜体 *text*
    const italicParts = part.split(/(\*[^*]+\*)/g);
    return italicParts.map((iPart, j) => {
      if (iPart.startsWith('*') && iPart.endsWith('*') && !iPart.startsWith('**')) {
        return <em key={`${i}-${j}`}>{iPart.slice(1, -1)}</em>;
      }
      return iPart;
    });
  });
};

export const MarkdownRenderer: React.FC<MarkdownProps> = ({ content, onApplyCode }) => {
  const blocks = parseMarkdown(content);

  return (
    <div className="markdown-content">
      {blocks.map((block, index) => {
        if (block.type === 'code') {
          return (
            <CodeBlock
              key={index}
              language={block.language || 'text'}
              code={block.content}
              onApply={onApplyCode ? () => onApplyCode(block.content, block.language || 'text') : undefined}
            />
          );
        }
        if (block.type === 'inline-code') {
          return <code key={index} className="inline-code">{block.content}</code>;
        }
        // 文本块
        return <span key={index}>{renderText(block.content)}</span>;
      })}
    </div>
  );
};

export default MarkdownRenderer;
