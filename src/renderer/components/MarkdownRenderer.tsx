/**
 * MindCode - Markdown 渲染组件 (增强版)
 * 支持代码高亮、折叠、表格、Callout 等
 */

import React, { useState, useMemo, memo } from 'react';

// === 代码块组件 ===
interface CodeBlockProps {
  language: string;
  code: string;
  filename?: string;
  maxLines?: number;
  onCopy?: () => void;
  onApply?: () => void;  // Accept - 应用代码（写入文件）
  onPreview?: () => void; // 点击代码 - 预览代码（在编辑器中显示）
  onOpenInEditor?: (code: string, language: string, filename?: string) => void; // Phase 2: 在编辑器中打开
}

// 文件扩展名到语言的映射
export const EXT_TO_LANG: Record<string, string> = {
  c: 'c', h: 'c', cpp: 'cpp', cxx: 'cpp', cc: 'cpp', hpp: 'cpp', hxx: 'cpp',
  py: 'python', pyw: 'python', pyx: 'python',
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  java: 'java', kt: 'java', kts: 'java',
  go: 'go', rs: 'rust', rb: 'python', // ruby 用 python 高亮近似
  css: 'css', scss: 'css', less: 'css', sass: 'css',
  sql: 'sql', sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'bash',
  json: 'javascript', yaml: 'bash', yml: 'bash', md: 'text', txt: 'text',
  html: 'javascript', htm: 'javascript', xml: 'javascript', vue: 'javascript', svelte: 'javascript',
};

// 从文件路径推断语言
export const getLanguageFromPath = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return EXT_TO_LANG[ext] || 'text';
};

export const highlightCode = (code: string, language: string): React.ReactNode[] => { // 语法高亮
  const keywords: Record<string, string[]> = {
    python: ['def', 'class', 'import', 'from', 'if', 'elif', 'else', 'while', 'for', 'in', 'return', 'try', 'except', 'finally', 'with', 'as', 'True', 'False', 'None', 'and', 'or', 'not', 'is', 'lambda', 'yield', 'break', 'continue', 'pass', 'raise', 'global', 'nonlocal', 'assert', 'del', 'async', 'await'],
    javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'class', 'extends', 'import', 'export', 'default', 'from', 'async', 'await', 'true', 'false', 'null', 'undefined', 'typeof', 'instanceof', 'of'],
    typescript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'class', 'extends', 'import', 'export', 'default', 'from', 'async', 'await', 'true', 'false', 'null', 'undefined', 'typeof', 'instanceof', 'interface', 'type', 'enum', 'implements', 'private', 'public', 'protected', 'readonly', 'static', 'abstract', 'as', 'any', 'void', 'never', 'unknown', 'of'],
    java: ['public', 'private', 'protected', 'class', 'interface', 'extends', 'implements', 'static', 'final', 'void', 'int', 'long', 'double', 'float', 'boolean', 'char', 'byte', 'short', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'try', 'catch', 'finally', 'throw', 'throws', 'new', 'this', 'super', 'true', 'false', 'null', 'import', 'package'],
    go: ['package', 'import', 'func', 'var', 'const', 'type', 'struct', 'interface', 'map', 'chan', 'if', 'else', 'for', 'range', 'switch', 'case', 'default', 'break', 'continue', 'return', 'go', 'defer', 'select', 'true', 'false', 'nil'],
    rust: ['fn', 'let', 'mut', 'const', 'static', 'struct', 'enum', 'impl', 'trait', 'pub', 'mod', 'use', 'if', 'else', 'match', 'loop', 'while', 'for', 'in', 'return', 'break', 'continue', 'true', 'false', 'self', 'Self', 'super', 'crate', 'async', 'await', 'move', 'ref', 'where'],
    c: ['int', 'long', 'double', 'float', 'char', 'void', 'short', 'unsigned', 'signed', 'const', 'static', 'extern', 'register', 'volatile', 'struct', 'union', 'enum', 'typedef', 'sizeof', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'return', 'goto', 'NULL', 'include', 'define', 'ifdef', 'ifndef', 'endif', 'pragma'],
    cpp: ['int', 'long', 'double', 'float', 'char', 'bool', 'void', 'auto', 'const', 'static', 'class', 'struct', 'enum', 'union', 'template', 'typename', 'public', 'private', 'protected', 'virtual', 'override', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'try', 'catch', 'throw', 'new', 'delete', 'this', 'true', 'false', 'nullptr', 'include', 'define', 'namespace', 'using'],
    css: ['color', 'background', 'margin', 'padding', 'border', 'font', 'display', 'position', 'width', 'height', 'top', 'left', 'right', 'bottom', 'flex', 'grid', 'transition', 'transform', 'animation', 'opacity', 'z-index', 'overflow', 'cursor', 'visibility'],
    sql: ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'LIKE', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'AS', 'DISTINCT'],
    bash: ['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case', 'esac', 'function', 'return', 'exit', 'echo', 'read', 'export', 'source', 'alias', 'cd', 'ls', 'pwd', 'mkdir', 'rm', 'cp', 'mv', 'cat', 'grep', 'sed', 'awk', 'find', 'chmod', 'chown', 'sudo'],
    diff: [],
  };
  const lang = language.toLowerCase();
  const langKeywords = keywords[lang] || keywords['javascript'] || [];
  const lines = code.split('\n');
  const isDiff = lang === 'diff';

  return lines.map((line, lineIndex) => {
    if (isDiff) { // Diff 特殊处理
      const cls = line.startsWith('+') ? 'diff-add' : line.startsWith('-') ? 'diff-del' : line.startsWith('@@') ? 'diff-info' : '';
      return <div key={lineIndex} className={`code-line ${cls}`}><span className="line-number">{lineIndex + 1}</span><span className="line-content">{line}</span></div>;
    }
    const tokens: React.ReactNode[] = [];
    let remaining = line, tokenIndex = 0;
    while (remaining.length > 0) {
      let matched = false;
      const commentMatch = remaining.match(/^(\/\/.*|#.*)$/); // 注释
      if (commentMatch) { tokens.push(<span key={`${lineIndex}-${tokenIndex++}`} className="syntax-comment">{commentMatch[0]}</span>); remaining = ''; continue; }
      const doubleStringMatch = remaining.match(/^"(?:[^"\\]|\\.)*"/); // 双引号字符串
      if (doubleStringMatch) { tokens.push(<span key={`${lineIndex}-${tokenIndex++}`} className="syntax-string">{doubleStringMatch[0]}</span>); remaining = remaining.slice(doubleStringMatch[0].length); continue; }
      const singleStringMatch = remaining.match(/^'(?:[^'\\]|\\.)*'/); // 单引号字符串
      if (singleStringMatch) { tokens.push(<span key={`${lineIndex}-${tokenIndex++}`} className="syntax-string">{singleStringMatch[0]}</span>); remaining = remaining.slice(singleStringMatch[0].length); continue; }
      const templateStringMatch = remaining.match(/^`(?:[^`\\]|\\.)*`/); // 模板字符串
      if (templateStringMatch) { tokens.push(<span key={`${lineIndex}-${tokenIndex++}`} className="syntax-string">{templateStringMatch[0]}</span>); remaining = remaining.slice(templateStringMatch[0].length); continue; }
      const numberMatch = remaining.match(/^\b\d+\.?\d*\b/); // 数字
      if (numberMatch) { tokens.push(<span key={`${lineIndex}-${tokenIndex++}`} className="syntax-number">{numberMatch[0]}</span>); remaining = remaining.slice(numberMatch[0].length); continue; }
      for (const keyword of langKeywords) { // 关键字
        const regex = new RegExp(`^\\b${keyword}\\b`);
        const keywordMatch = remaining.match(regex);
        if (keywordMatch) { tokens.push(<span key={`${lineIndex}-${tokenIndex++}`} className="syntax-keyword">{keywordMatch[0]}</span>); remaining = remaining.slice(keywordMatch[0].length); matched = true; break; }
      }
      if (matched) continue;
      const funcMatch = remaining.match(/^([a-zA-Z_]\w*)\s*\(/); // 函数调用
      if (funcMatch) { tokens.push(<span key={`${lineIndex}-${tokenIndex++}`} className="syntax-function">{funcMatch[1]}</span>); tokens.push(<span key={`${lineIndex}-${tokenIndex++}`}>(</span>); remaining = remaining.slice(funcMatch[0].length); continue; }
      const identMatch = remaining.match(/^[a-zA-Z_]\w*/); // 标识符
      if (identMatch) { tokens.push(<span key={`${lineIndex}-${tokenIndex++}`} className="syntax-variable">{identMatch[0]}</span>); remaining = remaining.slice(identMatch[0].length); continue; }
      const operatorMatch = remaining.match(/^[+\-*/%=<>!&|^~?:]+/); // 操作符
      if (operatorMatch) { tokens.push(<span key={`${lineIndex}-${tokenIndex++}`} className="syntax-operator">{operatorMatch[0]}</span>); remaining = remaining.slice(operatorMatch[0].length); continue; }
      tokens.push(<span key={`${lineIndex}-${tokenIndex++}`}>{remaining[0]}</span>);
      remaining = remaining.slice(1);
    }
    return <div key={lineIndex} className="code-line"><span className="line-number">{lineIndex + 1}</span><span className="line-content">{tokens}</span></div>;
  });
};

export const CodeBlock: React.FC<CodeBlockProps> = memo(({ language, code, filename, maxLines = 15, onCopy, onApply, onPreview, onOpenInEditor }) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [applied, setApplied] = useState(false);
  const [applying, setApplying] = useState(false);
  const lines = code.split('\n');
  const shouldCollapse = lines.length > maxLines;
  const displayCode = shouldCollapse && !expanded ? lines.slice(0, maxLines - 2).join('\n') : code;
  const hiddenLines = lines.length - maxLines + 2;
  const isDiff = language.toLowerCase() === 'diff' || code.split('\n').some(l => l.startsWith('+ ') || l.startsWith('- ') || l.startsWith('@@ '));

  const handleCopy = async () => { await navigator.clipboard.writeText(code); setCopied(true); onCopy?.(); setTimeout(() => setCopied(false), 1500); };
  const handleOpenInEditor = () => onOpenInEditor?.(code, language, filename);
  
  // 点击代码区域 - 预览代码
  const handleCodeClick = () => {
    if (onPreview) {
      onPreview();
    }
  };

  // 点击 Accept 按钮 - 应用代码
  const handleApply = async () => {
    if (onApply && !applying) {
      setApplying(true);
      try {
        await onApply();
        setApplied(true);
        setTimeout(() => setApplied(false), 2000);
      } finally {
        setApplying(false);
      }
    }
  };

  return (
    <div className={`code-block ${isDiff ? 'code-block--diff' : ''} ${applied ? 'code-block--applied' : ''}`}>
      <div className="code-block-header">
        <span className="code-block-lang">{language || 'text'}</span>
        {filename && <span className="code-block-filename">{filename}</span>}
        {applied && <span className="code-block-applied-badge">✓ Applied</span>}
        <div className="code-block-actions">
          {/* Accept 按钮 */}
          {onApply && !applied && (
            <button 
              className={`code-block-btn code-block-btn--accept ${applying ? 'applying' : ''}`} 
              onClick={handleApply} 
              title="应用代码到文件"
              disabled={applying}
            >
              {applying ? <SpinnerIcon /> : <ApplyIcon />}
              <span>{applying ? 'Applying...' : 'Accept'}</span>
            </button>
          )}
          {/* Copy 按钮 */}
          <button className="code-block-btn" onClick={handleCopy} title={copied ? '已复制' : '复制代码'}>
            {copied ? <CheckIcon /> : <CopyIcon />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
      </div>
      <div 
        className={`code-block-content ${onPreview ? 'clickable' : ''}`}
        onClick={handleCodeClick}
        title={onPreview ? '点击在编辑器中预览' : undefined}
      >
        <pre><code>{highlightCode(displayCode, language)}</code></pre>
      </div>
      {shouldCollapse && (
        <button className="code-block-toggle" onClick={() => setExpanded(!expanded)}>
          {expanded ? <><ChevronUpIcon /> 收起</> : <><ChevronDownIcon /> 展开剩余 {hiddenLines} 行</>}
        </button>
      )}
    </div>
  );
});

// === Callout 组件 ===
type CalloutType = 'info' | 'warning' | 'error' | 'success' | 'tip';
const CalloutIcons: Record<CalloutType, React.ReactNode> = {
  info: <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm6.5-.25A.75.75 0 017.25 7h1a.75.75 0 01.75.75v2.75h.25a.75.75 0 010 1.5h-2a.75.75 0 010-1.5h.25v-2h-.25a.75.75 0 01-.75-.75zM8 6a1 1 0 100-2 1 1 0 000 2z"/></svg>,
  warning: <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0114.082 15H1.918a1.75 1.75 0 01-1.543-2.575L6.457 1.047zM8 5a.75.75 0 00-.75.75v2.5a.75.75 0 001.5 0v-2.5A.75.75 0 008 5zm1 6a1 1 0 11-2 0 1 1 0 012 0z"/></svg>,
  error: <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M2.343 13.657A8 8 0 1113.657 2.343 8 8 0 012.343 13.657zM6.03 4.97a.75.75 0 00-1.06 1.06L6.94 8 4.97 9.97a.75.75 0 101.06 1.06L8 9.06l1.97 1.97a.75.75 0 101.06-1.06L9.06 8l1.97-1.97a.75.75 0 10-1.06-1.06L8 6.94 6.03 4.97z"/></svg>,
  success: <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 16A8 8 0 108 0a8 8 0 000 16zm3.78-9.72a.75.75 0 00-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.06 0l4.5-4.5z"/></svg>,
  tip: <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 01-1.484.211c-.04-.282-.163-.547-.37-.847a8.695 8.695 0 00-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.75.75 0 01-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75zM6 15.25a.75.75 0 01.75-.75h2.5a.75.75 0 010 1.5h-2.5a.75.75 0 01-.75-.75zM5.75 12a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5z"/></svg>,
};
const Callout: React.FC<{ type: CalloutType; children: React.ReactNode }> = ({ type, children }) => (
  <div className={`callout callout--${type}`}><div className="callout-icon">{CalloutIcons[type]}</div><div className="callout-content">{children}</div></div>
);

// === Markdown 解析与渲染 ===
interface ParsedBlock { type: 'text' | 'code' | 'inline-code' | 'callout' | 'table' | 'heading' | 'list' | 'blockquote' | 'hr'; content: string; language?: string; calloutType?: CalloutType; level?: number; items?: string[]; ordered?: boolean; }

const parseMarkdown = (text: string): ParsedBlock[] => {
  const blocks: ParsedBlock[] = [];
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    // 代码块
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
      blocks.push({ type: 'code', language: lang || 'text', content: codeLines.join('\n') });
      i++;
      continue;
    }
    // Callout :::type
    const calloutMatch = line.match(/^:::(info|warning|error|success|tip)$/);
    if (calloutMatch) {
      const calloutType = calloutMatch[1] as CalloutType;
      const calloutLines: string[] = [];
      i++;
      while (i < lines.length && lines[i] !== ':::') { calloutLines.push(lines[i]); i++; }
      blocks.push({ type: 'callout', calloutType, content: calloutLines.join('\n') });
      i++;
      continue;
    }
    // 表格
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableLines: string[] = [line];
      i++;
      while (i < lines.length && lines[i].includes('|')) { tableLines.push(lines[i]); i++; }
      blocks.push({ type: 'table', content: tableLines.join('\n') });
      continue;
    }
    // 标题
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) { blocks.push({ type: 'heading', level: headingMatch[1].length, content: headingMatch[2] }); i++; continue; }
    // 分割线
    if (/^[-*_]{3,}$/.test(line.trim())) { blocks.push({ type: 'hr', content: '' }); i++; continue; }
    // 引用块
    if (line.startsWith('>')) {
      const quoteLines: string[] = [line.slice(1).trim()];
      i++;
      while (i < lines.length && lines[i].startsWith('>')) { quoteLines.push(lines[i].slice(1).trim()); i++; }
      blocks.push({ type: 'blockquote', content: quoteLines.join('\n') });
      continue;
    }
    // 列表
    const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const items: string[] = [listMatch[3]];
      const ordered = /^\d+\./.test(listMatch[2]);
      i++;
      while (i < lines.length) {
        const nextMatch = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
        if (nextMatch) { items.push(nextMatch[3]); i++; } else break;
      }
      blocks.push({ type: 'list', ordered, items, content: '' });
      continue;
    }
    // 普通文本
    if (line.trim()) blocks.push({ type: 'text', content: line });
    i++;
  }
  return blocks;
};

const renderInline = (text: string): React.ReactNode => { // 内联元素渲染
  const parts: React.ReactNode[] = [];
  let remaining = text, idx = 0;
  while (remaining.length > 0) {
    // 行内代码
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) { parts.push(<code key={idx++} className="inline-code">{codeMatch[1]}</code>); remaining = remaining.slice(codeMatch[0].length); continue; }
    // 粗体
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) { parts.push(<strong key={idx++}>{boldMatch[1]}</strong>); remaining = remaining.slice(boldMatch[0].length); continue; }
    // 斜体
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) { parts.push(<em key={idx++}>{italicMatch[1]}</em>); remaining = remaining.slice(italicMatch[0].length); continue; }
    // 删除线
    const strikeMatch = remaining.match(/^~~([^~]+)~~/);
    if (strikeMatch) { parts.push(<del key={idx++}>{strikeMatch[1]}</del>); remaining = remaining.slice(strikeMatch[0].length); continue; }
    // 链接
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) { parts.push(<a key={idx++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="md-link">{linkMatch[1]} <ExternalIcon /></a>); remaining = remaining.slice(linkMatch[0].length); continue; }
    // 查找下一个特殊字符
    const nextSpecial = remaining.search(/[`*~\[]/);
    if (nextSpecial === -1) { parts.push(remaining); break; }
    if (nextSpecial > 0) { parts.push(remaining.slice(0, nextSpecial)); remaining = remaining.slice(nextSpecial); }
    else { parts.push(remaining[0]); remaining = remaining.slice(1); }
  }
  return parts;
};

const renderTable = (content: string): React.ReactNode => { // 表格渲染
  const rows = content.split('\n').filter(r => r.trim() && !r.match(/^[\s|:-]+$/));
  if (rows.length === 0) return null;
  const parseRow = (row: string) => row.split('|').map(c => c.trim()).filter(c => c);
  const headers = parseRow(rows[0]);
  const body = rows.slice(1).map(parseRow);
  return (
    <div className="md-table-wrapper">
      <table className="md-table">
        <thead><tr>{headers.map((h, i) => <th key={i}>{renderInline(h)}</th>)}</tr></thead>
        <tbody>{body.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j}>{renderInline(c)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
};

interface MarkdownProps {
  content: string;
  onApplyCode?: (code: string, language: string) => void;  // Accept - 应用代码
  onPreviewCode?: (code: string, language: string) => void; // 点击代码 - 预览
  onOpenInEditor?: (code: string, language: string, filename?: string) => void; // Phase 2
}

export const MarkdownRenderer: React.FC<MarkdownProps> = memo(({ content, onApplyCode, onPreviewCode, onOpenInEditor }) => {
  const blocks = useMemo(() => parseMarkdown(content), [content]);
  return (
    <div className="markdown-content">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'code': return <CodeBlock key={i} language={block.language || 'text'} code={block.content} onApply={onApplyCode ? () => onApplyCode(block.content, block.language || 'text') : undefined} onPreview={onPreviewCode ? () => onPreviewCode(block.content, block.language || 'text') : undefined} onOpenInEditor={onOpenInEditor} />;
          case 'callout': return <Callout key={i} type={block.calloutType!}>{renderInline(block.content)}</Callout>;
          case 'table': return <React.Fragment key={i}>{renderTable(block.content)}</React.Fragment>;
          case 'heading': const H = `h${block.level}` as keyof JSX.IntrinsicElements; return <H key={i} className="md-heading">{renderInline(block.content)}</H>;
          case 'hr': return <hr key={i} className="md-hr" />;
          case 'blockquote': return <blockquote key={i} className="md-blockquote">{renderInline(block.content)}</blockquote>;
          case 'list': return block.ordered ? <ol key={i} className="md-list">{block.items?.map((item, j) => <li key={j}>{renderInline(item)}</li>)}</ol> : <ul key={i} className="md-list">{block.items?.map((item, j) => <li key={j}>{renderInline(item)}</li>)}</ul>;
          default: return <p key={i} className="md-paragraph">{renderInline(block.content)}</p>;
        }
      })}
    </div>
  );
});

// === Icons ===
const CopyIcon = () => <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/></svg>;
const CheckIcon = () => <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 111.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>;
const ApplyIcon = () => <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 111.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>;
const SpinnerIcon = () => <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" className="spin"><path d="M8 0a8 8 0 100 16A8 8 0 008 0zm.75 2.015v2.993a.75.75 0 01-1.5 0V2.015A6.502 6.502 0 0114 8a.75.75 0 01-1.5 0A5 5 0 007.25 2.015z"/></svg>;
const EditorIcon = () => <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M4.708 5.578L2.061 8.224l2.647 2.646-.708.708-3-3V7.87l3-3 .708.708zm7-.708L11 5.578l2.647 2.646L11 10.87l.708.708 3-3v-.708l-3-3zM4.908 13l.894.448 5-10L9.908 3l-5 10z"/></svg>;
const ChevronDownIcon = () => <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M12.78 5.22a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0L3.22 6.28a.75.75 0 011.06-1.06L8 8.94l3.72-3.72a.75.75 0 011.06 0z"/></svg>;
const ChevronUpIcon = () => <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M3.22 10.78a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0l4.25 4.25a.75.75 0 01-1.06 1.06L8 7.06l-3.72 3.72a.75.75 0 01-1.06 0z"/></svg>;
const ExternalIcon = () => <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" style={{ marginLeft: 2, verticalAlign: 'middle' }}><path d="M3.75 2A1.75 1.75 0 002 3.75v8.5c0 .966.784 1.75 1.75 1.75h8.5A1.75 1.75 0 0014 12.25v-3.5a.75.75 0 00-1.5 0v3.5a.25.25 0 01-.25.25h-8.5a.25.25 0 01-.25-.25v-8.5a.25.25 0 01.25-.25h3.5a.75.75 0 000-1.5h-3.5z"/><path d="M10 1a.75.75 0 000 1.5h2.44L7.22 7.72a.75.75 0 001.06 1.06l5.22-5.22V6a.75.75 0 001.5 0V1.75a.75.75 0 00-.75-.75H10z"/></svg>;

export default MarkdownRenderer;
