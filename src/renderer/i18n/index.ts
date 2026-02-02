/**
 * i18n - 国际化框架
 * 多语言支持、动态切换
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type Locale = 'zh-CN' | 'en-US';
export type TranslationKey = keyof typeof zhCN;

// 中文语言包
export const zhCN = {
  // 通用
  'common.ok': '确定',
  'common.cancel': '取消',
  'common.save': '保存',
  'common.delete': '删除',
  'common.edit': '编辑',
  'common.close': '关闭',
  'common.search': '搜索',
  'common.filter': '筛选',
  'common.refresh': '刷新',
  'common.loading': '加载中...',
  'common.error': '错误',
  'common.success': '成功',
  'common.warning': '警告',
  'common.info': '信息',
  'common.confirm': '确认',
  'common.reset': '重置',
  'common.clear': '清空',
  'common.copy': '复制',
  'common.paste': '粘贴',
  'common.cut': '剪切',
  'common.undo': '撤销',
  'common.redo': '重做',
  // 文件
  'file.new': '新建文件',
  'file.open': '打开文件',
  'file.openFolder': '打开文件夹',
  'file.save': '保存',
  'file.saveAs': '另存为',
  'file.saveAll': '保存全部',
  'file.close': '关闭',
  'file.closeAll': '关闭全部',
  'file.rename': '重命名',
  'file.delete': '删除',
  'file.copy': '复制',
  'file.move': '移动',
  'file.noFiles': '无文件',
  'file.recentProjects': '最近项目',
  // 编辑器
  'editor.untitled': '未命名',
  'editor.modified': '已修改',
  'editor.readonly': '只读',
  'editor.encoding': '编码',
  'editor.lineEnding': '行尾',
  'editor.language': '语言',
  'editor.goToLine': '跳转到行',
  'editor.find': '查找',
  'editor.replace': '替换',
  'editor.findNext': '查找下一个',
  'editor.findPrevious': '查找上一个',
  'editor.replaceAll': '全部替换',
  // 视图
  'view.sidebar': '侧边栏',
  'view.terminal': '终端',
  'view.output': '输出',
  'view.problems': '问题',
  'view.explorer': '资源管理器',
  'view.search': '搜索',
  'view.git': 'Git',
  'view.extensions': '扩展',
  'view.settings': '设置',
  'view.theme': '主题',
  'view.keybindings': '快捷键',
  'view.commandPalette': '命令面板',
  // AI
  'ai.chat': 'AI 对话',
  'ai.inline': '内联编辑',
  'ai.composer': 'Composer',
  'ai.explain': '解释代码',
  'ai.fix': '修复代码',
  'ai.generate': '生成代码',
  'ai.review': '代码审查',
  'ai.test': '生成测试',
  'ai.docs': '生成文档',
  'ai.thinking': '思考中...',
  'ai.settings': 'AI 设置',
  'ai.history': '会话历史',
  'ai.prompts': '提示模板',
  // Git
  'git.status': '状态',
  'git.commit': '提交',
  'git.push': '推送',
  'git.pull': '拉取',
  'git.branch': '分支',
  'git.merge': '合并',
  'git.stash': '暂存',
  'git.history': '历史',
  'git.diff': '差异',
  'git.stage': '暂存更改',
  'git.unstage': '取消暂存',
  'git.discard': '放弃更改',
  'git.noChanges': '无更改',
  'git.conflicts': '冲突',
  // 终端
  'terminal.new': '新建终端',
  'terminal.clear': '清空',
  'terminal.kill': '终止',
  'terminal.split': '拆分',
  // 设置
  'settings.general': '常规',
  'settings.editor': '编辑器',
  'settings.ai': 'AI',
  'settings.appearance': '外观',
  'settings.files': '文件',
  'settings.git': 'Git',
  'settings.terminal': '终端',
  'settings.extensions': '扩展',
  // 欢迎页
  'welcome.title': '欢迎使用 MindCode',
  'welcome.subtitle': 'AI 驱动的智能代码编辑器',
  'welcome.openFolder': '打开文件夹',
  'welcome.openFile': '打开文件',
  'welcome.recentProjects': '最近项目',
  'welcome.shortcuts': '快捷键',
  'welcome.docs': '文档',
  'welcome.feedback': '反馈',
};

// 英文语言包
export const enUS: typeof zhCN = {
  'common.ok': 'OK',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.close': 'Close',
  'common.search': 'Search',
  'common.filter': 'Filter',
  'common.refresh': 'Refresh',
  'common.loading': 'Loading...',
  'common.error': 'Error',
  'common.success': 'Success',
  'common.warning': 'Warning',
  'common.info': 'Info',
  'common.confirm': 'Confirm',
  'common.reset': 'Reset',
  'common.clear': 'Clear',
  'common.copy': 'Copy',
  'common.paste': 'Paste',
  'common.cut': 'Cut',
  'common.undo': 'Undo',
  'common.redo': 'Redo',
  'file.new': 'New File',
  'file.open': 'Open File',
  'file.openFolder': 'Open Folder',
  'file.save': 'Save',
  'file.saveAs': 'Save As',
  'file.saveAll': 'Save All',
  'file.close': 'Close',
  'file.closeAll': 'Close All',
  'file.rename': 'Rename',
  'file.delete': 'Delete',
  'file.copy': 'Copy',
  'file.move': 'Move',
  'file.noFiles': 'No files',
  'file.recentProjects': 'Recent Projects',
  'editor.untitled': 'Untitled',
  'editor.modified': 'Modified',
  'editor.readonly': 'Read-only',
  'editor.encoding': 'Encoding',
  'editor.lineEnding': 'Line Ending',
  'editor.language': 'Language',
  'editor.goToLine': 'Go to Line',
  'editor.find': 'Find',
  'editor.replace': 'Replace',
  'editor.findNext': 'Find Next',
  'editor.findPrevious': 'Find Previous',
  'editor.replaceAll': 'Replace All',
  'view.sidebar': 'Sidebar',
  'view.terminal': 'Terminal',
  'view.output': 'Output',
  'view.problems': 'Problems',
  'view.explorer': 'Explorer',
  'view.search': 'Search',
  'view.git': 'Git',
  'view.extensions': 'Extensions',
  'view.settings': 'Settings',
  'view.theme': 'Theme',
  'view.keybindings': 'Keybindings',
  'view.commandPalette': 'Command Palette',
  'ai.chat': 'AI Chat',
  'ai.inline': 'Inline Edit',
  'ai.composer': 'Composer',
  'ai.explain': 'Explain Code',
  'ai.fix': 'Fix Code',
  'ai.generate': 'Generate Code',
  'ai.review': 'Code Review',
  'ai.test': 'Generate Tests',
  'ai.docs': 'Generate Docs',
  'ai.thinking': 'Thinking...',
  'ai.settings': 'AI Settings',
  'ai.history': 'Chat History',
  'ai.prompts': 'Prompt Templates',
  'git.status': 'Status',
  'git.commit': 'Commit',
  'git.push': 'Push',
  'git.pull': 'Pull',
  'git.branch': 'Branch',
  'git.merge': 'Merge',
  'git.stash': 'Stash',
  'git.history': 'History',
  'git.diff': 'Diff',
  'git.stage': 'Stage Changes',
  'git.unstage': 'Unstage',
  'git.discard': 'Discard Changes',
  'git.noChanges': 'No changes',
  'git.conflicts': 'Conflicts',
  'terminal.new': 'New Terminal',
  'terminal.clear': 'Clear',
  'terminal.kill': 'Kill',
  'terminal.split': 'Split',
  'settings.general': 'General',
  'settings.editor': 'Editor',
  'settings.ai': 'AI',
  'settings.appearance': 'Appearance',
  'settings.files': 'Files',
  'settings.git': 'Git',
  'settings.terminal': 'Terminal',
  'settings.extensions': 'Extensions',
  'welcome.title': 'Welcome to MindCode',
  'welcome.subtitle': 'AI-Powered Code Editor',
  'welcome.openFolder': 'Open Folder',
  'welcome.openFile': 'Open File',
  'welcome.recentProjects': 'Recent Projects',
  'welcome.shortcuts': 'Shortcuts',
  'welcome.docs': 'Documentation',
  'welcome.feedback': 'Feedback',
};

const LOCALES = { 'zh-CN': zhCN, 'en-US': enUS };
const STORAGE_KEY = 'mindcode_locale';

// Context
interface I18nContextValue { locale: Locale; setLocale: (locale: Locale) => void; t: (key: TranslationKey, params?: Record<string, string>) => string; }
const I18nContext = createContext<I18nContextValue | null>(null);

export const useI18n = () => { const ctx = useContext(I18nContext); if (!ctx) throw new Error('useI18n must be used within I18nProvider'); return ctx; };

// Provider
export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>('zh-CN');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale;
    if (saved && LOCALES[saved]) setLocaleState(saved);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
  }, []);

  const t = useCallback((key: TranslationKey, params?: Record<string, string>): string => {
    let text = LOCALES[locale][key] || key;
    if (params) Object.entries(params).forEach(([k, v]) => { text = text.replace(`{${k}}`, v); });
    return text;
  }, [locale]);

  return React.createElement(I18nContext.Provider, { value: { locale, setLocale, t } }, children);
};

// 独立翻译函数
export function translate(key: TranslationKey, locale: Locale = 'zh-CN'): string { return LOCALES[locale][key] || key; }

export default { I18nProvider, useI18n, translate, zhCN, enUS };
