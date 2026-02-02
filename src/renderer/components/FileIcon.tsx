/**
 * FileIcon - 文件图标组件
 */

import React from 'react';

const FILE_ICONS: Record<string, { icon: string; color: string }> = {
  // 编程语言
  ts: { icon: 'TS', color: '#3178c6' },
  tsx: { icon: 'TSX', color: '#3178c6' },
  js: { icon: 'JS', color: '#f7df1e' },
  jsx: { icon: 'JSX', color: '#61dafb' },
  py: { icon: 'PY', color: '#3776ab' },
  java: { icon: 'J', color: '#b07219' },
  c: { icon: 'C', color: '#555555' },
  cpp: { icon: 'C++', color: '#f34b7d' },
  h: { icon: 'H', color: '#555555' },
  cs: { icon: 'C#', color: '#178600' },
  go: { icon: 'GO', color: '#00add8' },
  rs: { icon: 'RS', color: '#dea584' },
  rb: { icon: 'RB', color: '#701516' },
  php: { icon: 'PHP', color: '#4f5d95' },
  swift: { icon: 'SW', color: '#f05138' },
  kt: { icon: 'KT', color: '#a97bff' },
  scala: { icon: 'SC', color: '#c22d40' },
  // Web
  html: { icon: 'H', color: '#e34c26' },
  css: { icon: 'CSS', color: '#1572b6' },
  scss: { icon: 'S', color: '#c6538c' },
  sass: { icon: 'S', color: '#c6538c' },
  less: { icon: 'L', color: '#1d365d' },
  vue: { icon: 'V', color: '#42b883' },
  svelte: { icon: 'S', color: '#ff3e00' },
  // 数据/配置
  json: { icon: '{ }', color: '#cbcb41' },
  yaml: { icon: 'Y', color: '#cb171e' },
  yml: { icon: 'Y', color: '#cb171e' },
  xml: { icon: 'X', color: '#e37933' },
  toml: { icon: 'T', color: '#9c4121' },
  ini: { icon: 'I', color: '#6d8086' },
  env: { icon: 'E', color: '#ecd53f' },
  // 文档
  md: { icon: 'MD', color: '#083fa1' },
  mdx: { icon: 'MDX', color: '#fcb32c' },
  txt: { icon: 'T', color: '#6d8086' },
  pdf: { icon: 'PDF', color: '#e34c26' },
  doc: { icon: 'W', color: '#2b579a' },
  docx: { icon: 'W', color: '#2b579a' },
  // 图片
  png: { icon: '🖼', color: '#a074c4' },
  jpg: { icon: '🖼', color: '#a074c4' },
  jpeg: { icon: '🖼', color: '#a074c4' },
  gif: { icon: '🖼', color: '#a074c4' },
  svg: { icon: 'SVG', color: '#ffb13b' },
  ico: { icon: 'I', color: '#a074c4' },
  // 其他
  sh: { icon: '$', color: '#89e051' },
  bash: { icon: '$', color: '#89e051' },
  zsh: { icon: '$', color: '#89e051' },
  sql: { icon: 'SQL', color: '#e38c00' },
  graphql: { icon: 'GQL', color: '#e10098' },
  dockerfile: { icon: 'D', color: '#384d54' },
  makefile: { icon: 'M', color: '#6d8086' },
  gitignore: { icon: 'G', color: '#f14e32' },
  lock: { icon: '🔒', color: '#6d8086' },
};

const FOLDER_ICONS: Record<string, { icon: string; color: string }> = {
  src: { icon: '📁', color: '#6d8086' },
  components: { icon: '🧩', color: '#61dafb' },
  hooks: { icon: '🪝', color: '#61dafb' },
  services: { icon: '⚙️', color: '#6d8086' },
  utils: { icon: '🔧', color: '#6d8086' },
  stores: { icon: '🗄️', color: '#6d8086' },
  styles: { icon: '🎨', color: '#1572b6' },
  assets: { icon: '📦', color: '#6d8086' },
  public: { icon: '🌐', color: '#6d8086' },
  test: { icon: '🧪', color: '#c21325' },
  tests: { icon: '🧪', color: '#c21325' },
  __tests__: { icon: '🧪', color: '#c21325' },
  node_modules: { icon: '📦', color: '#cb3837' },
  dist: { icon: '📤', color: '#6d8086' },
  build: { icon: '📤', color: '#6d8086' },
  '.git': { icon: '', color: '#f14e32' },
  '.vscode': { icon: '⚙️', color: '#007acc' },
  docs: { icon: '📚', color: '#083fa1' },
  config: { icon: '⚙️', color: '#6d8086' },
};

interface FileIconProps { filename: string; isFolder?: boolean; size?: number; className?: string; }

export const FileIcon: React.FC<FileIconProps> = ({ filename, isFolder = false, size = 16, className = '' }) => {
  const name = filename.toLowerCase();

  if (isFolder) {
    const folderInfo = FOLDER_ICONS[name] || { icon: '📁', color: 'var(--color-text-muted)' };
    return <span className={className} style={{ fontSize: size, color: folderInfo.color }}>{folderInfo.icon}</span>;
  }

  const ext = name.split('.').pop() || '';
  const fileInfo = FILE_ICONS[ext] || FILE_ICONS[name] || { icon: '📄', color: 'var(--color-text-muted)' };

  // 特殊文件名
  if (name === 'package.json') return <span className={className} style={{ fontSize: size, color: '#cb3837' }}>📦</span>;
  if (name === 'tsconfig.json') return <span className={className} style={{ fontSize: size, color: '#3178c6' }}>⚙️</span>;
  if (name === 'readme.md') return <span className={className} style={{ fontSize: size, color: '#083fa1' }}>📖</span>;
  if (name === '.gitignore') return <span className={className} style={{ fontSize: size, color: '#f14e32' }}></span>;
  if (name === 'dockerfile') return <span className={className} style={{ fontSize: size, color: '#384d54' }}>🐳</span>;

  return (
    <span className={`inline-flex items-center justify-center font-mono font-bold ${className}`} style={{ fontSize: size * 0.6, color: fileInfo.color, minWidth: size, height: size }}>
      {fileInfo.icon}
    </span>
  );
};

// 获取文件类型颜色
export const getFileColor = (filename: string): string => {
  const ext = filename.toLowerCase().split('.').pop() || '';
  return FILE_ICONS[ext]?.color || 'var(--color-text-muted)';
};

// 获取语言名称
export const getLanguageName = (filename: string): string => {
  const ext = filename.toLowerCase().split('.').pop() || '';
  const names: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript React', js: 'JavaScript', jsx: 'JavaScript React',
    py: 'Python', java: 'Java', c: 'C', cpp: 'C++', cs: 'C#', go: 'Go', rs: 'Rust',
    rb: 'Ruby', php: 'PHP', swift: 'Swift', kt: 'Kotlin', scala: 'Scala',
    html: 'HTML', css: 'CSS', scss: 'SCSS', vue: 'Vue', svelte: 'Svelte',
    json: 'JSON', yaml: 'YAML', xml: 'XML', md: 'Markdown', sql: 'SQL',
  };
  return names[ext] || 'Plain Text';
};

export default FileIcon;
