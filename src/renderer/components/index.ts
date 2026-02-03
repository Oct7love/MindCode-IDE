/**
 * Components - 组件统一导出索引
 */

// UI 基础组件
export { SettingsPanel } from './SettingsPanel';
export { ToastProvider, useToast, toast } from './Toast';
export { Breadcrumb } from './Breadcrumb';
export { ProgressProvider, useProgress, ProgressBar } from './ProgressBar';
export { ErrorBoundary, AIPanelErrorBoundary, EditorErrorBoundary } from './ErrorBoundary';

// 主题 & 快捷键
export { ThemeProvider, useTheme, ThemeManager } from './ThemeManager';
export type { Theme, ThemeColors } from './ThemeManager';
export { KeybindingManager, useKeybindings } from './KeybindingManager';
export type { Keybinding } from './KeybindingManager';

// 命令面板 & 快速打开
export { CommandPalette, createDefaultCommands } from './CommandPalette';
export type { Command } from './CommandPalette';
export { QuickOpen } from './QuickOpen';
export type { FileItem } from './QuickOpen';

// 欢迎页面
export { WelcomePage } from './WelcomePage';

// 布局管理
export { LayoutProvider, useLayout, Resizable, PanelContainer } from './LayoutManager';
export type { LayoutConfig, PanelConfig } from './LayoutManager';

// 编辑器增强
export { OutlinePanel, extractSymbols } from './OutlinePanel';
export type { OutlineSymbol, SymbolKind } from './OutlinePanel';
export { SnippetManager } from './SnippetManager';
export type { Snippet } from './SnippetManager';
export { SearchReplace } from './SearchReplace';
export type { SearchMatch, SearchOptions } from './SearchReplace';
export { BookmarkManager, useBookmarks } from './BookmarkManager';
export type { Bookmark } from './BookmarkManager';

// 工作区
export { RecentProjects, addRecentProject } from './RecentProjects';
export type { RecentProject } from './RecentProjects';
export { TaskRunner } from './TaskRunner';
export type { Task, TaskRun } from './TaskRunner';
export { FileTemplates } from './FileTemplates';
export type { FileTemplate } from './FileTemplates';

// Composer
export { ComposerPanel } from './ComposerPanel';

// 状态栏
export * from './StatusBar';

// 编码选择器
export { default as EncodingPicker } from './EncodingPicker';

// Git 组件
export * from './Git';

// Terminal 组件
export * from './Terminal';

// GitHub 面板
export { GitHubPanel } from './GitHubPanel';

// Plugin 面板
export { PluginPanel } from './PluginPanel';

// 工具确认对话框
export { ToolConfirmDialog } from './ToolConfirmDialog';

// 内联编辑组件
export { InlineEditWidget } from './InlineEditWidget';
export { InlineChatWidget } from './InlineChatWidget';

// 索引状态
export { IndexStatus } from './IndexStatus';
