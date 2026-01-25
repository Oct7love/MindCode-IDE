import { create } from 'zustand';
import { applyTheme, saveTheme, loadTheme } from '../utils/themes';

type SidebarTab = 'files' | 'search' | 'git' | 'ext';
type CommandPaletteMode = 'files' | 'commands' | 'search';

interface UIState {
  showAIPanel: boolean;
  aiPanelWidth: number;
  sidebarTab: SidebarTab;
  showTerminal: boolean;
  terminalHeight: number;
  showCommandPalette: boolean;
  commandPaletteMode: CommandPaletteMode;
  isDragging: boolean;
  isResizing: boolean;
  theme: string;
}

interface UIActions {
  toggleAIPanel: () => void;
  setAIPanelWidth: (width: number) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  toggleTerminal: () => void;
  setTerminalHeight: (height: number) => void;
  openCommandPalette: (mode?: CommandPaletteMode) => void;
  closeCommandPalette: () => void;
  setDragging: (dragging: boolean) => void;
  setResizing: (resizing: boolean) => void;
  setTheme: (theme: string) => void;
  initTheme: () => Promise<void>; // 初始化主题
}

export const useUIStore = create<UIState & UIActions>((set) => ({
  showAIPanel: true,
  aiPanelWidth: 380,
  sidebarTab: 'files',
  showTerminal: false,
  terminalHeight: 250,
  showCommandPalette: false,
  commandPaletteMode: 'files',
  isDragging: false,
  isResizing: false,
  theme: 'dark-plus',

  toggleAIPanel: () => set((state) => ({ showAIPanel: !state.showAIPanel })),
  setAIPanelWidth: (aiPanelWidth) => set({ aiPanelWidth: Math.max(280, Math.min(800, aiPanelWidth)) }),
  setSidebarTab: (sidebarTab) => set({ sidebarTab }),
  toggleTerminal: () => set((state) => ({ showTerminal: !state.showTerminal })),
  setTerminalHeight: (terminalHeight) => set({ terminalHeight: Math.max(100, Math.min(500, terminalHeight)) }),
  openCommandPalette: (mode = 'files') => set({ showCommandPalette: true, commandPaletteMode: mode }),
  closeCommandPalette: () => set({ showCommandPalette: false }),
  setDragging: (isDragging) => set({ isDragging }),
  setResizing: (isResizing) => set({ isResizing }),
  // 设置主题 - 同时更新状态、应用主题、保存到存储
  setTheme: (theme) => { set({ theme }); applyTheme(theme); saveTheme(theme); },
  // 初始化主题 - 从存储加载并应用
  initTheme: async () => { const saved = await loadTheme(); set({ theme: saved }); applyTheme(saved); },
}));
