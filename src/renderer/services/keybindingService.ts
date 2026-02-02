// 快捷键配置服务 - Vim模式 + 自定义快捷键 + 冲突检测

// ==================== 类型定义 ====================
export interface Keybinding {
  id: string;
  key: string; // 如 "ctrl+shift+p", "cmd+k cmd+s"
  command: string;
  when?: string; // 上下文条件
  source: 'default' | 'user' | 'extension';
}

export interface KeybindingConflict {
  key: string;
  bindings: Keybinding[];
}

// ==================== 默认快捷键 ====================
const DEFAULT_KEYBINDINGS: Keybinding[] = [
  { id: 'cmd.palette', key: 'ctrl+shift+p', command: 'workbench.action.showCommands', source: 'default' },
  { id: 'quick.open', key: 'ctrl+p', command: 'workbench.action.quickOpen', source: 'default' },
  { id: 'save', key: 'ctrl+s', command: 'workbench.action.files.save', source: 'default' },
  { id: 'save.all', key: 'ctrl+shift+s', command: 'workbench.action.files.saveAll', source: 'default' },
  { id: 'close.editor', key: 'ctrl+w', command: 'workbench.action.closeActiveEditor', source: 'default' },
  { id: 'new.file', key: 'ctrl+n', command: 'workbench.action.files.newUntitledFile', source: 'default' },
  { id: 'undo', key: 'ctrl+z', command: 'editor.action.undo', source: 'default' },
  { id: 'redo', key: 'ctrl+y', command: 'editor.action.redo', source: 'default' },
  { id: 'find', key: 'ctrl+f', command: 'editor.action.find', source: 'default' },
  { id: 'replace', key: 'ctrl+h', command: 'editor.action.replace', source: 'default' },
  { id: 'search.files', key: 'ctrl+shift+f', command: 'workbench.action.findInFiles', source: 'default' },
  { id: 'terminal.toggle', key: 'ctrl+`', command: 'workbench.action.terminal.toggleTerminal', source: 'default' },
  { id: 'ai.toggle', key: 'ctrl+l', command: 'mindcode.ai.toggle', source: 'default' },
  { id: 'inline.edit', key: 'ctrl+k', command: 'mindcode.inlineEdit', source: 'default' },
  { id: 'go.line', key: 'ctrl+g', command: 'workbench.action.gotoLine', source: 'default' },
  { id: 'go.symbol', key: 'ctrl+shift+o', command: 'workbench.action.gotoSymbol', source: 'default' },
  { id: 'explorer.focus', key: 'ctrl+shift+e', command: 'workbench.view.explorer', source: 'default' },
  { id: 'git.focus', key: 'ctrl+shift+g', command: 'workbench.view.scm', source: 'default' },
  { id: 'zoom.in', key: 'ctrl+=', command: 'workbench.action.zoomIn', source: 'default' },
  { id: 'zoom.out', key: 'ctrl+-', command: 'workbench.action.zoomOut', source: 'default' },
  { id: 'zoom.reset', key: 'ctrl+0', command: 'workbench.action.zoomReset', source: 'default' },
];

// ==================== Vim 模式快捷键 (追加) ====================
const VIM_KEYBINDINGS: Keybinding[] = [
  { id: 'vim.escape', key: 'escape', command: 'vim.escape', when: 'vim.mode != normal', source: 'extension' },
  { id: 'vim.insert', key: 'i', command: 'vim.insertMode', when: 'vim.mode == normal', source: 'extension' },
  { id: 'vim.append', key: 'a', command: 'vim.appendMode', when: 'vim.mode == normal', source: 'extension' },
  { id: 'vim.visual', key: 'v', command: 'vim.visualMode', when: 'vim.mode == normal', source: 'extension' },
  { id: 'vim.command', key: ':', command: 'vim.commandMode', when: 'vim.mode == normal', source: 'extension' },
];

// ==================== 快捷键服务 ====================
class KeybindingService {
  private bindings: Keybinding[] = [...DEFAULT_KEYBINDINGS];
  private vimEnabled = false;
  private listeners: Set<() => void> = new Set();

  // 获取所有快捷键
  getAll(): Keybinding[] { return this.bindings; }

  // 获取用户自定义快捷键
  getUserBindings(): Keybinding[] { return this.bindings.filter(b => b.source === 'user'); }

  // 添加/更新快捷键
  set(id: string, key: string, command: string, when?: string): void {
    const existing = this.bindings.find(b => b.id === id);
    if (existing) { existing.key = key; existing.when = when; existing.source = 'user'; }
    else this.bindings.push({ id, key, command, when, source: 'user' });
    this.save();
    this.notify();
  }

  // 删除用户自定义快捷键
  remove(id: string): void {
    const idx = this.bindings.findIndex(b => b.id === id && b.source === 'user');
    if (idx !== -1) { this.bindings.splice(idx, 1); this.save(); this.notify(); }
  }

  // 重置为默认
  reset(id: string): void {
    const defaultBinding = DEFAULT_KEYBINDINGS.find(b => b.id === id);
    if (defaultBinding) {
      const idx = this.bindings.findIndex(b => b.id === id);
      if (idx !== -1) this.bindings[idx] = { ...defaultBinding };
      else this.bindings.push({ ...defaultBinding });
      this.save();
      this.notify();
    }
  }

  // 查找命令对应的快捷键
  getByCommand(command: string): Keybinding | undefined { return this.bindings.find(b => b.command === command); }

  // 查找快捷键对应的命令
  getByKey(key: string): Keybinding | undefined { return this.bindings.find(b => b.key.toLowerCase() === key.toLowerCase()); }

  // 检测冲突
  detectConflicts(): KeybindingConflict[] {
    const keyMap = new Map<string, Keybinding[]>();
    for (const b of this.bindings) {
      const key = b.key.toLowerCase();
      if (!keyMap.has(key)) keyMap.set(key, []);
      keyMap.get(key)!.push(b);
    }
    return [...keyMap.entries()].filter(([_, bindings]) => bindings.length > 1).map(([key, bindings]) => ({ key, bindings }));
  }

  // Vim 模式开关
  setVimMode(enabled: boolean): void {
    this.vimEnabled = enabled;
    if (enabled) { for (const vb of VIM_KEYBINDINGS) if (!this.bindings.find(b => b.id === vb.id)) this.bindings.push(vb); }
    else this.bindings = this.bindings.filter(b => !b.id.startsWith('vim.'));
    this.save();
    this.notify();
  }

  isVimEnabled(): boolean { return this.vimEnabled; }

  // 持久化
  private save(): void {
    const userBindings = this.bindings.filter(b => b.source === 'user');
    localStorage.setItem('mindcode.keybindings', JSON.stringify(userBindings));
    localStorage.setItem('mindcode.vimMode', JSON.stringify(this.vimEnabled));
  }

  load(): void {
    try {
      const saved = localStorage.getItem('mindcode.keybindings');
      if (saved) { const userBindings = JSON.parse(saved) as Keybinding[]; for (const ub of userBindings) this.set(ub.id, ub.key, ub.command, ub.when); }
      const vimMode = localStorage.getItem('mindcode.vimMode');
      if (vimMode) this.setVimMode(JSON.parse(vimMode));
    } catch { /* 忽略解析错误 */ }
  }

  // 监听变更
  subscribe(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private notify(): void { this.listeners.forEach(fn => fn()); }
}

// ==================== 全局实例 ====================
export const keybindingService = new KeybindingService();

// 初始化时加载
if (typeof window !== 'undefined') keybindingService.load();
