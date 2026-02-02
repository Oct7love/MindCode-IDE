/**
 * Window Manager - 窗口管理服务
 */

export interface WindowState { id: string; title: string; bounds: { x: number; y: number; width: number; height: number }; maximized: boolean; minimized: boolean; focused: boolean; }
export interface PanelState { id: string; visible: boolean; size: number; position: 'left' | 'right' | 'bottom'; }
export interface SplitState { direction: 'horizontal' | 'vertical'; sizes: number[]; children: (string | SplitState)[]; }

const WINDOW_STATE_KEY = 'mindcode-window-state';
const PANEL_STATE_KEY = 'mindcode-panel-state';
const SPLIT_STATE_KEY = 'mindcode-split-state';

class WindowManager {
  private windowState: WindowState | null = null;
  private panels: Map<string, PanelState> = new Map();
  private splitState: SplitState | null = null;
  private listeners: ((state: WindowState) => void)[] = [];

  init(): void { this.loadState(); }

  private loadState(): void {
    try {
      const windowJson = localStorage.getItem(WINDOW_STATE_KEY);
      const panelJson = localStorage.getItem(PANEL_STATE_KEY);
      const splitJson = localStorage.getItem(SPLIT_STATE_KEY);
      if (windowJson) this.windowState = JSON.parse(windowJson);
      if (panelJson) (JSON.parse(panelJson) as PanelState[]).forEach(p => this.panels.set(p.id, p));
      if (splitJson) this.splitState = JSON.parse(splitJson);
    } catch (e) { console.error('[WindowManager] Failed to load state:', e); }
  }

  saveState(): void {
    try {
      if (this.windowState) localStorage.setItem(WINDOW_STATE_KEY, JSON.stringify(this.windowState));
      localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(Array.from(this.panels.values())));
      if (this.splitState) localStorage.setItem(SPLIT_STATE_KEY, JSON.stringify(this.splitState));
    } catch (e) { console.error('[WindowManager] Failed to save state:', e); }
  }

  getWindowState(): WindowState | null { return this.windowState; }
  setWindowState(state: Partial<WindowState>): void { this.windowState = { ...this.windowState, ...state } as WindowState; this.notifyListeners(); }

  getPanel(id: string): PanelState | undefined { return this.panels.get(id); }
  setPanel(id: string, state: Partial<PanelState>): void {
    const existing = this.panels.get(id) || { id, visible: true, size: 250, position: 'left' as const };
    this.panels.set(id, { ...existing, ...state });
  }
  togglePanel(id: string): boolean {
    const panel = this.panels.get(id);
    if (panel) { panel.visible = !panel.visible; return panel.visible; }
    return false;
  }
  getPanels(): PanelState[] { return Array.from(this.panels.values()); }

  getSplitState(): SplitState | null { return this.splitState; }
  setSplitState(state: SplitState): void { this.splitState = state; }

  splitEditor(direction: 'horizontal' | 'vertical', editorId: string): void {
    if (!this.splitState) { this.splitState = { direction, sizes: [50, 50], children: [editorId, `${editorId}-2`] }; return; }
    // 简化处理：在根级别添加分割
    this.splitState = { direction, sizes: [50, 50], children: [this.splitState, `${editorId}-new`] };
  }

  closeSplit(editorId: string): void {
    if (!this.splitState) return;
    const removeFromSplit = (split: SplitState): SplitState | string | null => {
      const newChildren = split.children.map(child => typeof child === 'string' ? (child === editorId ? null : child) : removeFromSplit(child)).filter(Boolean) as (string | SplitState)[];
      if (newChildren.length === 0) return null;
      if (newChildren.length === 1) return newChildren[0];
      return { ...split, children: newChildren, sizes: newChildren.map(() => 100 / newChildren.length) };
    };
    const result = removeFromSplit(this.splitState);
    this.splitState = typeof result === 'object' ? result : null;
  }

  subscribe(fn: (state: WindowState) => void): () => void { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter(f => f !== fn); }; }
  private notifyListeners(): void { if (this.windowState) this.listeners.forEach(fn => fn(this.windowState!)); }

  // 快捷方法
  maximize(): void { this.setWindowState({ maximized: true, minimized: false }); }
  minimize(): void { this.setWindowState({ minimized: true }); }
  restore(): void { this.setWindowState({ maximized: false, minimized: false }); }
  focus(): void { this.setWindowState({ focused: true }); }
}

export const windowManager = new WindowManager();
export default windowManager;
