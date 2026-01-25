/**
 * 主题预设 - VS Code 完整变量映射
 */

export function getVSCodeTokens(base: {
  editorBg: string;
  editorFg: string;
  sidebarBg: string;
  sidebarFg: string;
  activityBarBg: string;
  activityBarFg: string;
  tabActiveBg: string;
  tabInactiveBg: string;
  statusBarBg: string;
  statusBarFg: string;
  inputBg: string;
  inputFg: string;
  focusBorder: string;
  selectionBg: string;
  hoverBg: string;
}): Record<string, string> {
  return {
    // VS Code 完整变量
    '--vscode-editor-background': base.editorBg,
    '--vscode-editor-foreground': base.editorFg,
    '--vscode-sideBar-background': base.sidebarBg,
    '--vscode-sideBar-foreground': base.sidebarFg,
    '--vscode-sideBarSectionHeader-background': base.sidebarBg,
    '--vscode-activityBar-background': base.activityBarBg,
    '--vscode-activityBar-foreground': base.activityBarFg,
    '--vscode-activityBar-inactiveForeground': base.sidebarFg.includes('rgba') 
      ? base.sidebarFg.replace(/[\d.]+\)$/, '0.5)')
      : base.sidebarFg.includes('rgb')
      ? base.sidebarFg.replace('rgb', 'rgba').replace(')', ', 0.5)')
      : base.sidebarFg + '80', // hex with alpha
    '--vscode-activityBarBadge-background': base.focusBorder,
    '--vscode-titleBar-activeBackground': base.sidebarBg,
    '--vscode-titleBar-activeForeground': base.sidebarFg,
    '--vscode-tab-activeBackground': base.tabActiveBg,
    '--vscode-tab-inactiveBackground': base.tabInactiveBg,
    '--vscode-tab-border': base.hoverBg,
    '--vscode-tab-activeBorderTop': 'transparent',
    '--vscode-statusBar-background': base.statusBarBg,
    '--vscode-statusBar-foreground': base.statusBarFg,
    '--vscode-input-background': base.inputBg,
    '--vscode-input-foreground': base.inputFg,
    '--vscode-input-border': base.hoverBg,
    '--vscode-focusBorder': base.focusBorder,
    '--vscode-list-hoverBackground': base.hoverBg,
    '--vscode-list-activeSelectionBackground': base.selectionBg,
    '--vscode-list-activeSelectionForeground': base.editorFg,
    '--vscode-scrollbarSlider-background': base.hoverBg,
    '--vscode-scrollbarSlider-hoverBackground': base.hoverBg.includes('rgba')
      ? base.hoverBg.replace(/[\d.]+\)$/, '0.8)')
      : base.hoverBg.includes('rgb')
      ? base.hoverBg.replace('rgb', 'rgba').replace(')', ', 0.8)')
      : base.hoverBg + 'CC', // hex with alpha
    '--vscode-panelTitle-activeBorder': base.focusBorder,
    '--vscode-panel-border': base.hoverBg,
    '--vscode-icon-foreground': base.sidebarFg,
  };
}
