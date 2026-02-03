/**
 * 扩展市场服务
 * 提供扩展浏览、搜索、安装、激活功能
 */

export interface ExtensionInfo {
  id: string;
  name: string;
  displayName: string;
  description: string;
  version: string;
  author: string;
  icon?: string;
  category: 'theme' | 'language' | 'snippet' | 'tool' | 'ai' | 'other';
  tags: string[];
  downloads: number;
  rating: number;
  repository?: string;
  installed?: boolean;
  enabled?: boolean;
  config?: Record<string, any>; // 扩展特定配置
}

// 扩展功能实现
type ExtensionActivator = (ext: ExtensionInfo) => void;
type ExtensionDeactivator = (ext: ExtensionInfo) => void;

// 推荐扩展列表（模拟市场数据）
const FEATURED_EXTENSIONS: ExtensionInfo[] = [
  { id: 'mindcode.theme-dracula', name: 'theme-dracula', displayName: 'Dracula Theme Pro', description: '流行的暗色主题，支持多种语言高亮', version: '2.0.0', author: 'MindCode', icon: '🧛', category: 'theme', tags: ['theme', 'dark'], downloads: 150000, rating: 4.8 },
  { id: 'mindcode.theme-nord', name: 'theme-nord', displayName: 'Nord Theme', description: '北欧风格冷色调主题', version: '1.5.0', author: 'MindCode', icon: '❄️', category: 'theme', tags: ['theme', 'dark', 'nord'], downloads: 80000, rating: 4.7 },
  { id: 'mindcode.snippets-react', name: 'snippets-react', displayName: 'React Snippets', description: 'React/JSX 代码片段集合，提高开发效率', version: '3.0.0', author: 'MindCode', icon: '⚛️', category: 'snippet', tags: ['react', 'snippet', 'jsx'], downloads: 200000, rating: 4.9 },
  { id: 'mindcode.snippets-vue', name: 'snippets-vue', displayName: 'Vue Snippets', description: 'Vue 3 代码片段，支持 Composition API', version: '2.5.0', author: 'MindCode', icon: '💚', category: 'snippet', tags: ['vue', 'snippet'], downloads: 120000, rating: 4.8 },
  { id: 'mindcode.python-tools', name: 'python-tools', displayName: 'Python Tools', description: 'Python 开发工具包：格式化、lint、虚拟环境', version: '1.2.0', author: 'MindCode', icon: '🐍', category: 'language', tags: ['python', 'formatter'], downloads: 95000, rating: 4.6 },
  { id: 'mindcode.ai-codehelper', name: 'ai-codehelper', displayName: 'AI Code Helper', description: 'AI 辅助：代码注释生成、单元测试生成', version: '1.0.0', author: 'MindCode', icon: '🤖', category: 'ai', tags: ['ai', 'automation'], downloads: 50000, rating: 4.5 },
  { id: 'mindcode.git-lens', name: 'git-lens', displayName: 'Git Lens', description: 'Git 增强：行级 blame、提交历史浏览', version: '2.0.0', author: 'MindCode', icon: '🔍', category: 'tool', tags: ['git', 'scm'], downloads: 180000, rating: 4.9 },
  { id: 'mindcode.bracket-pair', name: 'bracket-pair', displayName: 'Bracket Pair Colorizer', description: '括号配对彩色高亮', version: '1.8.0', author: 'MindCode', icon: '🌈', category: 'tool', tags: ['bracket', 'colorizer'], downloads: 250000, rating: 4.7 },
  { id: 'mindcode.todo-tree', name: 'todo-tree', displayName: 'TODO Tree', description: 'TODO/FIXME 注释树形视图', version: '1.5.0', author: 'MindCode', icon: '📋', category: 'tool', tags: ['todo', 'productivity'], downloads: 130000, rating: 4.6 },
  { id: 'mindcode.live-server', name: 'live-server', displayName: 'Live Server', description: '本地开发服务器，支持热重载', version: '2.1.0', author: 'MindCode', icon: '🌐', category: 'tool', tags: ['server', 'web'], downloads: 170000, rating: 4.8 },
];

class MarketplaceService {
  private installed = new Map<string, ExtensionInfo>();
  private activators = new Map<string, ExtensionActivator>();
  private deactivators = new Map<string, ExtensionDeactivator>();
  private listeners = new Set<(event: string, ext: ExtensionInfo) => void>();

  constructor() {
    this.loadInstalled();
    this.registerBuiltinExtensions();
  }

  /** 加载已安装扩展 */
  private loadInstalled(): void {
    try {
      const data = localStorage.getItem('mindcode-installed-extensions');
      if (data) {
        const list: ExtensionInfo[] = JSON.parse(data);
        list.forEach(ext => this.installed.set(ext.id, { ...ext, installed: true }));
      }
    } catch {}
  }

  /** 保存已安装扩展 */
  private saveInstalled(): void {
    try { localStorage.setItem('mindcode-installed-extensions', JSON.stringify(Array.from(this.installed.values()))); } catch {}
  }

  /** 注册内置扩展激活器 */
  private registerBuiltinExtensions(): void {
    // 主题扩展 - Dracula
    this.activators.set('mindcode.theme-dracula', () => {
      document.documentElement.setAttribute('data-theme', 'dracula');
      localStorage.setItem('mindcode-theme', 'dracula');
      console.log('[Extension] Dracula Theme activated');
    });
    this.deactivators.set('mindcode.theme-dracula', () => {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('mindcode-theme', 'dark');
    });

    // 主题扩展 - Nord
    this.activators.set('mindcode.theme-nord', () => {
      document.documentElement.setAttribute('data-theme', 'nord');
      localStorage.setItem('mindcode-theme', 'nord');
      console.log('[Extension] Nord Theme activated');
    });
    this.deactivators.set('mindcode.theme-nord', () => {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('mindcode-theme', 'dark');
    });

    // 括号彩色高亮
    this.activators.set('mindcode.bracket-pair', () => {
      document.documentElement.classList.add('bracket-pair-enabled');
      console.log('[Extension] Bracket Pair Colorizer activated');
    });
    this.deactivators.set('mindcode.bracket-pair', () => {
      document.documentElement.classList.remove('bracket-pair-enabled');
    });

    // React Snippets - 注册到 Monaco
    this.activators.set('mindcode.snippets-react', () => {
      this.registerMonacoSnippets('typescriptreact', REACT_SNIPPETS);
      this.registerMonacoSnippets('javascriptreact', REACT_SNIPPETS);
      console.log('[Extension] React Snippets activated');
    });

    // Vue Snippets
    this.activators.set('mindcode.snippets-vue', () => {
      this.registerMonacoSnippets('vue', VUE_SNIPPETS);
      console.log('[Extension] Vue Snippets activated');
    });
  }

  /** 注册 Monaco 代码片段 */
  private registerMonacoSnippets(language: string, snippets: Record<string, { prefix: string; body: string[]; description: string }>): void {
    if (typeof window === 'undefined' || !(window as any).monaco) return;
    const monaco = (window as any).monaco;
    monaco.languages.registerCompletionItemProvider(language, {
      provideCompletionItems: () => ({
        suggestions: Object.entries(snippets).map(([name, snippet]) => ({
          label: snippet.prefix,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: snippet.body.join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: snippet.description,
          detail: name,
        })),
      }),
    });
  }

  /** 获取推荐扩展 */
  getFeatured(): ExtensionInfo[] {
    return FEATURED_EXTENSIONS.map(ext => ({ ...ext, installed: this.installed.has(ext.id), enabled: this.installed.get(ext.id)?.enabled }));
  }

  /** 搜索扩展 */
  search(query: string, category?: string): ExtensionInfo[] {
    const q = query.toLowerCase();
    return FEATURED_EXTENSIONS.filter(ext => {
      if (category && category !== 'all' && ext.category !== category) return false;
      return ext.name.toLowerCase().includes(q) || ext.displayName.toLowerCase().includes(q) || ext.description.toLowerCase().includes(q) || ext.tags.some(t => t.includes(q));
    }).map(ext => ({ ...ext, installed: this.installed.has(ext.id), enabled: this.installed.get(ext.id)?.enabled }));
  }

  /** 按分类获取 */
  getByCategory(category: string): ExtensionInfo[] {
    return category === 'all' ? this.getFeatured() : FEATURED_EXTENSIONS.filter(ext => ext.category === category).map(ext => ({ ...ext, installed: this.installed.has(ext.id) }));
  }

  /** 获取已安装扩展 */
  getInstalled(): ExtensionInfo[] { return Array.from(this.installed.values()); }

  /** 安装并激活扩展 */
  async install(extensionId: string): Promise<boolean> {
    const ext = FEATURED_EXTENSIONS.find(e => e.id === extensionId);
    if (!ext) return false;
    const installedExt = { ...ext, installed: true, enabled: true };
    this.installed.set(ext.id, installedExt);
    this.saveInstalled();
    this.activate(extensionId); // 自动激活
    this.emit('install', installedExt);
    console.log(`[Marketplace] 安装扩展: ${ext.displayName}`);
    return true;
  }

  /** 卸载扩展 */
  async uninstall(extensionId: string): Promise<boolean> {
    const ext = this.installed.get(extensionId);
    if (!ext) return false;
    this.deactivate(extensionId); // 先停用
    this.installed.delete(extensionId);
    this.saveInstalled();
    this.emit('uninstall', ext);
    console.log(`[Marketplace] 卸载扩展: ${extensionId}`);
    return true;
  }

  /** 启用/禁用扩展 */
  async setEnabled(extensionId: string, enabled: boolean): Promise<boolean> {
    const ext = this.installed.get(extensionId);
    if (!ext) return false;
    ext.enabled = enabled;
    this.saveInstalled();
    if (enabled) this.activate(extensionId);
    else this.deactivate(extensionId);
    this.emit(enabled ? 'enable' : 'disable', ext);
    return true;
  }

  /** 激活扩展 */
  activate(extensionId: string): void {
    const activator = this.activators.get(extensionId);
    const ext = this.installed.get(extensionId);
    if (activator && ext) activator(ext);
  }

  /** 停用扩展 */
  deactivate(extensionId: string): void {
    const deactivator = this.deactivators.get(extensionId);
    const ext = this.installed.get(extensionId);
    if (deactivator && ext) deactivator(ext);
  }

  /** 初始化 - 激活所有已启用扩展 */
  initializeExtensions(): void {
    this.installed.forEach((ext, id) => {
      if (ext.enabled) this.activate(id);
    });
    console.log(`[Marketplace] 初始化完成，激活 ${this.installed.size} 个扩展`);
  }

  /** 事件监听 */
  on(callback: (event: string, ext: ExtensionInfo) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private emit(event: string, ext: ExtensionInfo): void {
    this.listeners.forEach(cb => cb(event, ext));
  }

  /** 获取分类列表 */
  getCategories(): Array<{ id: string; name: string; icon: string }> {
    return [
      { id: 'all', name: '全部', icon: '📦' },
      { id: 'theme', name: '主题', icon: '🎨' },
      { id: 'language', name: '语言', icon: '📝' },
      { id: 'snippet', name: '代码片段', icon: '✂️' },
      { id: 'tool', name: '工具', icon: '🔧' },
      { id: 'ai', name: 'AI', icon: '🤖' },
    ];
  }
}

// React 代码片段
const REACT_SNIPPETS: Record<string, { prefix: string; body: string[]; description: string }> = {
  'React Function Component': { prefix: 'rfc', body: ['export const ${1:Component} = () => {', '  return (', '    <div>', '      ${2:content}', '    </div>', '  );', '};'], description: '创建 React 函数组件' },
  'useState Hook': { prefix: 'us', body: ['const [${1:state}, set${1/(.*)/${1:/capitalize}/}] = useState(${2:initialValue});'], description: '创建 useState Hook' },
  'useEffect Hook': { prefix: 'ue', body: ['useEffect(() => {', '  ${1:effect}', '  return () => {', '    ${2:cleanup}', '  };', '}, [${3:deps}]);'], description: '创建 useEffect Hook' },
  'useCallback Hook': { prefix: 'ucb', body: ['const ${1:callback} = useCallback(() => {', '  ${2:body}', '}, [${3:deps}]);'], description: '创建 useCallback Hook' },
  'useMemo Hook': { prefix: 'um', body: ['const ${1:value} = useMemo(() => ${2:computation}, [${3:deps}]);'], description: '创建 useMemo Hook' },
};

// Vue 代码片段
const VUE_SNIPPETS: Record<string, { prefix: string; body: string[]; description: string }> = {
  'Vue 3 Setup': { prefix: 'v3setup', body: ['<script setup lang="ts">', '${1:// code}', '</script>', '', '<template>', '  <div>${2:content}</div>', '</template>'], description: 'Vue 3 Setup 组件' },
  'Vue Ref': { prefix: 'vref', body: ['const ${1:name} = ref(${2:initialValue});'], description: '创建 Vue ref' },
  'Vue Reactive': { prefix: 'vreactive', body: ['const ${1:state} = reactive({', '  ${2:key}: ${3:value},', '});'], description: '创建 Vue reactive' },
  'Vue Computed': { prefix: 'vcomputed', body: ['const ${1:name} = computed(() => ${2:expression});'], description: '创建 Vue computed' },
};

export const marketplaceService = new MarketplaceService();
export default marketplaceService;
