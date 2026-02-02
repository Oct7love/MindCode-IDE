/**
 * Monaco Themes - 编辑器主题定义
 */

import * as monaco from 'monaco-editor';

export interface EditorTheme { name: string; base: 'vs' | 'vs-dark' | 'hc-black'; colors: Record<string, string>; rules: monaco.editor.ITokenThemeRule[]; }

const baseColors = {
  dark: { 'editor.background': '#1e1e1e', 'editor.foreground': '#d4d4d4', 'editor.lineHighlightBackground': '#2a2d2e', 'editor.selectionBackground': '#264f78', 'editorCursor.foreground': '#aeafad', 'editorWhitespace.foreground': '#3b3b3b', 'editorLineNumber.foreground': '#858585', 'editorLineNumber.activeForeground': '#c6c6c6' },
  light: { 'editor.background': '#ffffff', 'editor.foreground': '#1f1f1f', 'editor.lineHighlightBackground': '#f5f5f5', 'editor.selectionBackground': '#add6ff', 'editorCursor.foreground': '#000000', 'editorWhitespace.foreground': '#d4d4d4', 'editorLineNumber.foreground': '#858585', 'editorLineNumber.activeForeground': '#1f1f1f' },
};

export const themes: EditorTheme[] = [
  { name: 'MindCode Dark', base: 'vs-dark', colors: { ...baseColors.dark, 'editor.background': '#1a1a2e', 'editorLineNumber.foreground': '#4a5568' }, rules: [
    { token: 'comment', foreground: '6a9955', fontStyle: 'italic' }, { token: 'keyword', foreground: 'c586c0' }, { token: 'string', foreground: 'ce9178' },
    { token: 'number', foreground: 'b5cea8' }, { token: 'type', foreground: '4ec9b0' }, { token: 'function', foreground: 'dcdcaa' },
    { token: 'variable', foreground: '9cdcfe' }, { token: 'operator', foreground: 'd4d4d4' }, { token: 'delimiter', foreground: 'd4d4d4' },
  ]},
  { name: 'Dracula', base: 'vs-dark', colors: { ...baseColors.dark, 'editor.background': '#282a36', 'editor.foreground': '#f8f8f2', 'editor.selectionBackground': '#44475a' }, rules: [
    { token: 'comment', foreground: '6272a4', fontStyle: 'italic' }, { token: 'keyword', foreground: 'ff79c6' }, { token: 'string', foreground: 'f1fa8c' },
    { token: 'number', foreground: 'bd93f9' }, { token: 'type', foreground: '8be9fd', fontStyle: 'italic' }, { token: 'function', foreground: '50fa7b' },
    { token: 'variable', foreground: 'f8f8f2' }, { token: 'operator', foreground: 'ff79c6' },
  ]},
  { name: 'One Dark Pro', base: 'vs-dark', colors: { ...baseColors.dark, 'editor.background': '#282c34', 'editor.foreground': '#abb2bf', 'editor.selectionBackground': '#3e4451' }, rules: [
    { token: 'comment', foreground: '5c6370', fontStyle: 'italic' }, { token: 'keyword', foreground: 'c678dd' }, { token: 'string', foreground: '98c379' },
    { token: 'number', foreground: 'd19a66' }, { token: 'type', foreground: 'e5c07b' }, { token: 'function', foreground: '61afef' },
    { token: 'variable', foreground: 'e06c75' }, { token: 'operator', foreground: '56b6c2' },
  ]},
  { name: 'GitHub Dark', base: 'vs-dark', colors: { ...baseColors.dark, 'editor.background': '#0d1117', 'editor.foreground': '#c9d1d9', 'editor.selectionBackground': '#264f78' }, rules: [
    { token: 'comment', foreground: '8b949e', fontStyle: 'italic' }, { token: 'keyword', foreground: 'ff7b72' }, { token: 'string', foreground: 'a5d6ff' },
    { token: 'number', foreground: '79c0ff' }, { token: 'type', foreground: 'ffa657' }, { token: 'function', foreground: 'd2a8ff' },
    { token: 'variable', foreground: 'c9d1d9' }, { token: 'operator', foreground: 'ff7b72' },
  ]},
  { name: 'Monokai', base: 'vs-dark', colors: { ...baseColors.dark, 'editor.background': '#272822', 'editor.foreground': '#f8f8f2', 'editor.selectionBackground': '#49483e' }, rules: [
    { token: 'comment', foreground: '75715e', fontStyle: 'italic' }, { token: 'keyword', foreground: 'f92672' }, { token: 'string', foreground: 'e6db74' },
    { token: 'number', foreground: 'ae81ff' }, { token: 'type', foreground: '66d9ef', fontStyle: 'italic' }, { token: 'function', foreground: 'a6e22e' },
    { token: 'variable', foreground: 'f8f8f2' }, { token: 'operator', foreground: 'f92672' },
  ]},
  { name: 'GitHub Light', base: 'vs', colors: { ...baseColors.light, 'editor.background': '#ffffff', 'editor.foreground': '#24292f' }, rules: [
    { token: 'comment', foreground: '6a737d', fontStyle: 'italic' }, { token: 'keyword', foreground: 'cf222e' }, { token: 'string', foreground: '0a3069' },
    { token: 'number', foreground: '0550ae' }, { token: 'type', foreground: '953800' }, { token: 'function', foreground: '8250df' },
    { token: 'variable', foreground: '24292f' }, { token: 'operator', foreground: 'cf222e' },
  ]},
];

export function registerThemes(): void { themes.forEach(t => monaco.editor.defineTheme(t.name.replace(/\s+/g, '-').toLowerCase(), { base: t.base, inherit: true, colors: t.colors, rules: t.rules })); }

export function applyTheme(themeName: string): void {
  const id = themeName.replace(/\s+/g, '-').toLowerCase();
  monaco.editor.setTheme(id);
}

export function getThemeNames(): string[] { return themes.map(t => t.name); }

export default { themes, registerThemes, applyTheme, getThemeNames };
