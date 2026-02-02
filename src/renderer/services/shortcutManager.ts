/**
 * ShortcutManager - 快捷键管理服务
 */

export interface Shortcut { id: string; keys: string; description: string; category: string; handler: () => void | Promise<void>; enabled?: boolean; when?: string; }
export interface ShortcutGroup { category: string; shortcuts: Shortcut[]; }

const STORAGE_KEY = 'mindcode-shortcuts';

class ShortcutManager {
  private shortcuts = new Map<string, Shortcut>();
  private customBindings = new Map<string, string>(); // id -> custom keys
  private pressedKeys = new Set<string>();
  private listeners: ((shortcut: Shortcut) => void)[] = [];

  constructor() { this.loadCustomBindings(); this.setupListeners(); }

  private setupListeners(): void {
    document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
    document.addEventListener('keyup', this.handleKeyUp.bind(this), true);
    window.addEventListener('blur', () => this.pressedKeys.clear());
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (this.isInputFocused() && !e.ctrlKey && !e.metaKey && !e.altKey) return; // 输入框内只响应修饰键组合
    
    const key = this.normalizeKey(e);
    this.pressedKeys.add(key);
    const combo = this.getCurrentCombo();

    for (const shortcut of this.shortcuts.values()) {
      if (shortcut.enabled === false) continue;
      const targetKeys = this.customBindings.get(shortcut.id) || shortcut.keys;
      if (this.matchCombo(combo, targetKeys)) {
        e.preventDefault();
        e.stopPropagation();
        try { shortcut.handler(); this.listeners.forEach(fn => fn(shortcut)); }
        catch (err) { console.error('[ShortcutManager] Handler error:', err); }
        return;
      }
    }
  }

  private handleKeyUp(e: KeyboardEvent): void { this.pressedKeys.delete(this.normalizeKey(e)); }

  private normalizeKey(e: KeyboardEvent): string {
    const key = e.key.toLowerCase();
    if (key === 'control') return 'ctrl';
    if (key === 'meta') return 'cmd';
    return key;
  }

  private getCurrentCombo(): string {
    const keys = Array.from(this.pressedKeys);
    const modifiers = ['ctrl', 'alt', 'shift', 'cmd'].filter(m => keys.includes(m));
    const others = keys.filter(k => !['ctrl', 'alt', 'shift', 'cmd'].includes(k));
    return [...modifiers, ...others].join('+');
  }

  private matchCombo(current: string, target: string): boolean {
    const normalize = (s: string) => s.toLowerCase().split('+').sort().join('+');
    return normalize(current) === normalize(target);
  }

  private isInputFocused(): boolean {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable;
  }

  // ============ 公开 API ============

  register(shortcut: Shortcut): () => void {
    this.shortcuts.set(shortcut.id, { ...shortcut, enabled: shortcut.enabled ?? true });
    return () => this.unregister(shortcut.id);
  }

  registerMany(shortcuts: Shortcut[]): () => void {
    shortcuts.forEach(s => this.register(s));
    return () => shortcuts.forEach(s => this.unregister(s.id));
  }

  unregister(id: string): void { this.shortcuts.delete(id); }

  setBinding(id: string, keys: string): void {
    this.customBindings.set(id, keys);
    this.saveCustomBindings();
  }

  resetBinding(id: string): void {
    this.customBindings.delete(id);
    this.saveCustomBindings();
  }

  resetAllBindings(): void {
    this.customBindings.clear();
    this.saveCustomBindings();
  }

  getShortcut(id: string): Shortcut | undefined { return this.shortcuts.get(id); }
  
  getBinding(id: string): string {
    const shortcut = this.shortcuts.get(id);
    if (!shortcut) return '';
    return this.customBindings.get(id) || shortcut.keys;
  }

  listShortcuts(): Shortcut[] { return Array.from(this.shortcuts.values()); }

  listByCategory(): ShortcutGroup[] {
    const groups = new Map<string, Shortcut[]>();
    for (const s of this.shortcuts.values()) {
      const cat = s.category || '其他';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(s);
    }
    return Array.from(groups.entries()).map(([category, shortcuts]) => ({ category, shortcuts }));
  }

  enable(id: string): void { const s = this.shortcuts.get(id); if (s) s.enabled = true; }
  disable(id: string): void { const s = this.shortcuts.get(id); if (s) s.enabled = false; }

  onTrigger(fn: (shortcut: Shortcut) => void): () => void { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter(f => f !== fn); }; }

  // ============ 持久化 ============

  private loadCustomBindings(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) this.customBindings = new Map(JSON.parse(stored));
    } catch {}
  }

  private saveCustomBindings(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(this.customBindings.entries()))); }
    catch {}
  }

  // ============ 格式化 ============

  formatKeys(keys: string): string {
    return keys.split('+').map(k => {
      const key = k.toLowerCase();
      if (key === 'ctrl') return '⌃';
      if (key === 'alt') return '⌥';
      if (key === 'shift') return '⇧';
      if (key === 'cmd' || key === 'meta') return '⌘';
      if (key === 'enter') return '↵';
      if (key === 'escape' || key === 'esc') return 'Esc';
      if (key === 'backspace') return '⌫';
      if (key === 'delete') return '⌦';
      if (key === 'tab') return '⇥';
      if (key === ' ' || key === 'space') return 'Space';
      if (key.startsWith('arrow')) return key.replace('arrow', '');
      return k.toUpperCase();
    }).join(' ');
  }
}

export const shortcutManager = new ShortcutManager();

// 默认快捷键注册
export function registerDefaultShortcuts(handlers: Record<string, () => void>): () => void {
  const defaults: Omit<Shortcut, 'handler'>[] = [
    { id: 'file.new', keys: 'Ctrl+N', description: '新建文件', category: '文件' },
    { id: 'file.open', keys: 'Ctrl+O', description: '打开文件', category: '文件' },
    { id: 'file.save', keys: 'Ctrl+S', description: '保存', category: '文件' },
    { id: 'file.saveAll', keys: 'Ctrl+Shift+S', description: '全部保存', category: '文件' },
    { id: 'file.close', keys: 'Ctrl+W', description: '关闭标签', category: '文件' },
    { id: 'edit.undo', keys: 'Ctrl+Z', description: '撤销', category: '编辑' },
    { id: 'edit.redo', keys: 'Ctrl+Shift+Z', description: '重做', category: '编辑' },
    { id: 'edit.copy', keys: 'Ctrl+C', description: '复制', category: '编辑' },
    { id: 'edit.cut', keys: 'Ctrl+X', description: '剪切', category: '编辑' },
    { id: 'edit.paste', keys: 'Ctrl+V', description: '粘贴', category: '编辑' },
    { id: 'edit.find', keys: 'Ctrl+F', description: '查找', category: '编辑' },
    { id: 'edit.replace', keys: 'Ctrl+H', description: '替换', category: '编辑' },
    { id: 'view.sidebar', keys: 'Ctrl+B', description: '切换侧边栏', category: '视图' },
    { id: 'view.terminal', keys: 'Ctrl+J', description: '切换终端', category: '视图' },
    { id: 'view.ai', keys: 'Ctrl+L', description: '打开 AI 面板', category: '视图' },
    { id: 'view.palette', keys: 'Ctrl+Shift+P', description: '命令面板', category: '视图' },
    { id: 'view.quickOpen', keys: 'Ctrl+P', description: '快速打开', category: '视图' },
    { id: 'view.search', keys: 'Ctrl+Shift+F', description: '全局搜索', category: '视图' },
    { id: 'goto.line', keys: 'Ctrl+G', description: '跳转到行', category: '跳转' },
    { id: 'goto.symbol', keys: 'Ctrl+Shift+O', description: '跳转到符号', category: '跳转' },
    { id: 'debug.start', keys: 'F5', description: '开始调试', category: '调试' },
    { id: 'debug.stop', keys: 'Shift+F5', description: '停止调试', category: '调试' },
    { id: 'debug.stepOver', keys: 'F10', description: '单步跳过', category: '调试' },
    { id: 'debug.stepInto', keys: 'F11', description: '单步进入', category: '调试' },
    { id: 'debug.stepOut', keys: 'Shift+F11', description: '单步跳出', category: '调试' },
    { id: 'debug.toggleBreakpoint', keys: 'F9', description: '切换断点', category: '调试' },
  ];

  const registered = defaults.map(d => {
    const handler = handlers[d.id] || (() => console.log(`[Shortcut] ${d.id} not implemented`));
    return shortcutManager.register({ ...d, handler });
  });

  return () => registered.forEach(unregister => unregister());
}

export default shortcutManager;
