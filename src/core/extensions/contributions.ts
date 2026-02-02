/**
 * Contributions - 扩展贡献点系统
 */

export type ContributionType = 'commands' | 'menus' | 'keybindings' | 'views' | 'themes' | 'languages' | 'snippets' | 'configuration' | 'taskProviders' | 'debuggers';

export interface CommandContribution { id: string; title: string; category?: string; icon?: string; enablement?: string; }
export interface MenuContribution { id: string; command: string; group?: string; when?: string; order?: number; }
export interface KeybindingContribution { command: string; key: string; mac?: string; when?: string; }
export interface ViewContribution { id: string; name: string; container: string; icon?: string; when?: string; }
export interface ThemeContribution { id: string; label: string; uiTheme: 'vs' | 'vs-dark' | 'hc-black'; path: string; }
export interface LanguageContribution { id: string; extensions: string[]; aliases?: string[]; configuration?: string; }
export interface SnippetContribution { language: string; path: string; }
export interface ConfigurationContribution { title: string; properties: Record<string, { type: string; default?: any; description?: string; enum?: any[] }>; }

export interface ContributionManifest {
  commands?: CommandContribution[];
  menus?: Record<string, MenuContribution[]>;
  keybindings?: KeybindingContribution[];
  views?: Record<string, ViewContribution[]>;
  themes?: ThemeContribution[];
  languages?: LanguageContribution[];
  snippets?: SnippetContribution[];
  configuration?: ConfigurationContribution;
}

type ContributionHandler<T> = (contribution: T, extensionId: string) => void;

class ContributionRegistry {
  private contributions = new Map<ContributionType, Map<string, any[]>>(); // type -> extensionId -> items
  private handlers = new Map<ContributionType, ContributionHandler<any>[]>();

  constructor() {
    const types: ContributionType[] = ['commands', 'menus', 'keybindings', 'views', 'themes', 'languages', 'snippets', 'configuration', 'taskProviders', 'debuggers'];
    types.forEach(t => { this.contributions.set(t, new Map()); this.handlers.set(t, []); });
  }

  /** 注册贡献点处理器 */
  onContribution<T>(type: ContributionType, handler: ContributionHandler<T>): () => void {
    this.handlers.get(type)!.push(handler);
    return () => { const handlers = this.handlers.get(type)!; this.handlers.set(type, handlers.filter(h => h !== handler)); };
  }

  /** 注册扩展贡献 */
  register(extensionId: string, manifest: ContributionManifest): void {
    if (manifest.commands) this.addContributions('commands', extensionId, manifest.commands);
    if (manifest.menus) Object.entries(manifest.menus).forEach(([, items]) => this.addContributions('menus', extensionId, items));
    if (manifest.keybindings) this.addContributions('keybindings', extensionId, manifest.keybindings);
    if (manifest.views) Object.entries(manifest.views).forEach(([, items]) => this.addContributions('views', extensionId, items));
    if (manifest.themes) this.addContributions('themes', extensionId, manifest.themes);
    if (manifest.languages) this.addContributions('languages', extensionId, manifest.languages);
    if (manifest.snippets) this.addContributions('snippets', extensionId, manifest.snippets);
    if (manifest.configuration) this.addContributions('configuration', extensionId, [manifest.configuration]);
  }

  /** 注销扩展贡献 */
  unregister(extensionId: string): void {
    for (const typeMap of this.contributions.values()) typeMap.delete(extensionId);
  }

  /** 获取所有贡献 */
  getAll<T>(type: ContributionType): T[] {
    const typeMap = this.contributions.get(type);
    if (!typeMap) return [];
    return Array.from(typeMap.values()).flat();
  }

  /** 获取扩展的贡献 */
  getByExtension<T>(type: ContributionType, extensionId: string): T[] {
    return this.contributions.get(type)?.get(extensionId) || [];
  }

  private addContributions<T>(type: ContributionType, extensionId: string, items: T[]): void {
    const typeMap = this.contributions.get(type)!;
    const existing = typeMap.get(extensionId) || [];
    typeMap.set(extensionId, [...existing, ...items]);
    const handlers = this.handlers.get(type)!;
    items.forEach(item => handlers.forEach(h => h(item, extensionId)));
  }
}

export const contributionRegistry = new ContributionRegistry();

// ============ 菜单位置常量 ============
export const MenuLocations = {
  EDITOR_CONTEXT: 'editor/context',
  EDITOR_TITLE: 'editor/title',
  EXPLORER_CONTEXT: 'explorer/context',
  VIEW_TITLE: 'view/title',
  COMMAND_PALETTE: 'commandPalette',
  STATUSBAR: 'statusBar',
  ACTIVITY_BAR: 'activityBar',
} as const;

// ============ 视图容器常量 ============
export const ViewContainers = {
  SIDEBAR: 'sidebar',
  PANEL: 'panel',
  ACTIVITY_BAR: 'activitybar',
} as const;

export default contributionRegistry;
