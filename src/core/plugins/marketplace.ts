/**
 * 扩展市场服务
 * 集成 Open VSX Registry (VSCode 兼容扩展市场)
 * API: https://open-vsx.org/api
 */

const OPEN_VSX_API = "https://open-vsx.org/api";

export interface ExtensionInfo {
  id: string; // namespace.name 格式
  name: string;
  displayName: string;
  description: string;
  version: string;
  author: string;
  icon?: string;
  iconUrl?: string; // Open VSX 图标 URL
  category: "theme" | "language" | "snippet" | "tool" | "ai" | "other";
  tags: string[];
  downloads: number;
  rating: number;
  repository?: string;
  installed?: boolean;
  enabled?: boolean;
  downloadUrl?: string; // .vsix 下载地址
  namespace?: string; // 发布者命名空间
}

// Open VSX API 响应类型
interface OpenVSXExtension {
  namespace: string;
  name: string;
  displayName?: string;
  description?: string;
  version: string;
  publishedBy?: { loginName: string };
  files?: { icon?: string; download?: string };
  downloadCount?: number;
  averageRating?: number;
  categories?: string[];
  tags?: string[];
  repository?: string;
}

interface OpenVSXSearchResult {
  extensions: OpenVSXExtension[];
  totalSize: number;
}

// 扩展功能实现
type ExtensionActivator = (ext: ExtensionInfo) => void;
type ExtensionDeactivator = (ext: ExtensionInfo) => void;

// 热门扩展 ID 列表（用于首页推荐）
const POPULAR_EXTENSIONS = [
  "dracula-theme.theme-dracula",
  "arcticicestudio.nord-visual-studio-code",
  "dsznajder.es7-react-js-snippets",
  "Vue.volar",
  "esbenp.prettier-vscode",
  "dbaeumer.vscode-eslint",
  "eamodio.gitlens",
  "PKief.material-icon-theme",
];

// 离线备用数据（当 API 不可用时显示）
const FALLBACK_EXTENSIONS: ExtensionInfo[] = [
  {
    id: "dracula-theme.theme-dracula",
    name: "theme-dracula",
    displayName: "Dracula Official",
    description: "Official Dracula Theme",
    version: "2.24.3",
    author: "Dracula Theme",
    icon: "🧛",
    category: "theme",
    tags: ["theme", "dark"],
    downloads: 5000000,
    rating: 4.8,
  },
  {
    id: "arcticicestudio.nord-visual-studio-code",
    name: "nord-visual-studio-code",
    displayName: "Nord",
    description: "An arctic, north-bluish clean theme",
    version: "0.19.0",
    author: "arcticicestudio",
    icon: "❄️",
    category: "theme",
    tags: ["theme", "dark", "nord"],
    downloads: 2000000,
    rating: 4.7,
  },
  {
    id: "dsznajder.es7-react-js-snippets",
    name: "es7-react-js-snippets",
    displayName: "ES7+ React Snippets",
    description: "Extensions for React, Redux snippets",
    version: "4.4.3",
    author: "dsznajder",
    icon: "⚛️",
    category: "snippet",
    tags: ["react", "snippet"],
    downloads: 8000000,
    rating: 4.9,
  },
  {
    id: "Vue.volar",
    name: "volar",
    displayName: "Vue - Official",
    description: "Language Support for Vue",
    version: "2.0.0",
    author: "Vue",
    icon: "💚",
    category: "language",
    tags: ["vue", "language"],
    downloads: 6000000,
    rating: 4.8,
  },
  {
    id: "esbenp.prettier-vscode",
    name: "prettier-vscode",
    displayName: "Prettier",
    description: "Code formatter using prettier",
    version: "10.1.0",
    author: "Prettier",
    icon: "🎨",
    category: "tool",
    tags: ["formatter", "prettier"],
    downloads: 30000000,
    rating: 4.7,
  },
  {
    id: "dbaeumer.vscode-eslint",
    name: "vscode-eslint",
    displayName: "ESLint",
    description: "Integrates ESLint into VS Code",
    version: "2.4.2",
    author: "Microsoft",
    icon: "🔧",
    category: "tool",
    tags: ["linter", "eslint"],
    downloads: 25000000,
    rating: 4.6,
  },
  {
    id: "eamodio.gitlens",
    name: "gitlens",
    displayName: "GitLens",
    description: "Supercharge Git capabilities",
    version: "14.0.0",
    author: "GitKraken",
    icon: "🔍",
    category: "tool",
    tags: ["git", "scm"],
    downloads: 20000000,
    rating: 4.9,
  },
  {
    id: "PKief.material-icon-theme",
    name: "material-icon-theme",
    displayName: "Material Icon Theme",
    description: "Material Design Icons for VS Code",
    version: "4.30.0",
    author: "Philipp Kief",
    icon: "📁",
    category: "theme",
    tags: ["icons", "theme"],
    downloads: 15000000,
    rating: 4.8,
  },
];

class MarketplaceService {
  private installed = new Map<string, ExtensionInfo>();
  private activators = new Map<string, ExtensionActivator>();
  private deactivators = new Map<string, ExtensionDeactivator>();
  private listeners = new Set<(event: string, ext: ExtensionInfo) => void>();
  private cache = new Map<string, { data: ExtensionInfo[]; time: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5分钟缓存

  constructor() {
    this.loadInstalled();
    this.registerBuiltinActivators();
  }

  /** 加载已安装扩展 */
  private loadInstalled(): void {
    try {
      const data = localStorage.getItem("mindcode-installed-extensions");
      if (data) {
        const list: ExtensionInfo[] = JSON.parse(data);
        list.forEach((ext) => this.installed.set(ext.id, { ...ext, installed: true }));
      }
    } catch {}
  }

  /** 保存已安装扩展 */
  private saveInstalled(): void {
    try {
      localStorage.setItem(
        "mindcode-installed-extensions",
        JSON.stringify(Array.from(this.installed.values())),
      );
    } catch {}
  }

  /** 注册内置激活器（主题等需要特殊处理） */
  private registerBuiltinActivators(): void {
    // Dracula 主题
    this.activators.set("dracula-theme.theme-dracula", () => {
      document.documentElement.setAttribute("data-theme", "dracula");
      localStorage.setItem("mindcode-theme", "dracula");
    });
    // Nord 主题
    this.activators.set("arcticicestudio.nord-visual-studio-code", () => {
      document.documentElement.setAttribute("data-theme", "nord");
      localStorage.setItem("mindcode-theme", "nord");
    });
  }

  /** 转换 Open VSX 响应为 ExtensionInfo */
  private convertExtension(ext: OpenVSXExtension): ExtensionInfo {
    const category = this.detectCategory(ext.categories || [], ext.tags || []);
    return {
      id: `${ext.namespace}.${ext.name}`,
      name: ext.name,
      namespace: ext.namespace,
      displayName: ext.displayName || ext.name,
      description: ext.description || "",
      version: ext.version,
      author: ext.publishedBy?.loginName || ext.namespace,
      iconUrl: ext.files?.icon,
      downloadUrl: ext.files?.download,
      category,
      tags: ext.tags || [],
      downloads: ext.downloadCount || 0,
      rating: ext.averageRating || 0,
      repository: ext.repository,
      installed: this.installed.has(`${ext.namespace}.${ext.name}`),
      enabled: this.installed.get(`${ext.namespace}.${ext.name}`)?.enabled,
    };
  }

  /** 检测扩展分类 */
  private detectCategory(categories: string[], tags: string[]): ExtensionInfo["category"] {
    const all = [...categories, ...tags].map((s) => s.toLowerCase());
    if (all.some((t) => t.includes("theme"))) return "theme";
    if (all.some((t) => t.includes("snippet"))) return "snippet";
    if (all.some((t) => t.includes("language") || t.includes("linter") || t.includes("formatter")))
      return "language";
    if (all.some((t) => t.includes("ai") || t.includes("copilot"))) return "ai";
    return "tool";
  }

  /** 从 Open VSX 搜索扩展 */
  async searchOnline(query: string, category?: string, size = 20): Promise<ExtensionInfo[]> {
    try {
      const cacheKey = `search:${query}:${category}:${size}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.time < this.cacheTimeout) return cached.data;

      const params = new URLSearchParams({
        query,
        size: size.toString(),
        sortBy: "downloadCount",
        sortOrder: "desc",
      });
      if (category && category !== "all") params.append("category", category);

      const res = await fetch(`${OPEN_VSX_API}/-/search?${params}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data: OpenVSXSearchResult = await res.json();
      const extensions = data.extensions.map((ext) => this.convertExtension(ext));
      this.cache.set(cacheKey, { data: extensions, time: Date.now() });
      return extensions;
    } catch (err) {
      console.warn("[Marketplace] 搜索失败，使用离线过滤:", err);
      // 从备用数据中过滤
      const q = query.toLowerCase();
      return this.getFallbackExtensions().filter(
        (ext) =>
          ext.name.toLowerCase().includes(q) ||
          ext.displayName.toLowerCase().includes(q) ||
          ext.description.toLowerCase().includes(q),
      );
    }
  }

  /** 获取热门扩展（首页推荐） */
  async getFeatured(): Promise<ExtensionInfo[]> {
    const cacheKey = "featured";
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.time < this.cacheTimeout) return cached.data;

    try {
      const extensions = await Promise.all(
        POPULAR_EXTENSIONS.map(async (id) => {
          const [namespace, name] = id.split(".");
          try {
            const res = await fetch(`${OPEN_VSX_API}/${namespace}/${name}`, {
              signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) return null;
            const ext: OpenVSXExtension = await res.json();
            return this.convertExtension(ext);
          } catch {
            return null;
          }
        }),
      );
      const result = extensions.filter((e): e is ExtensionInfo => e !== null);
      if (result.length > 0) {
        this.cache.set(cacheKey, { data: result, time: Date.now() });
        return result;
      }
      // API 返回空则使用备用数据
      console.warn("[Marketplace] API 无数据，使用离线备用");
      return this.getFallbackExtensions();
    } catch (err) {
      console.warn("[Marketplace] API 不可用，使用离线备用:", err);
      return this.getFallbackExtensions();
    }
  }

  /** 获取离线备用扩展列表 */
  private getFallbackExtensions(): ExtensionInfo[] {
    return FALLBACK_EXTENSIONS.map((ext) => ({
      ...ext,
      installed: this.installed.has(ext.id),
      enabled: this.installed.get(ext.id)?.enabled,
    }));
  }

  /** 搜索扩展（本地已安装 + 在线） */
  async search(query: string, category?: string): Promise<ExtensionInfo[]> {
    if (!query.trim()) return this.getFeatured();
    return this.searchOnline(query, category);
  }

  /** 按分类获取 */
  async getByCategory(category: string): Promise<ExtensionInfo[]> {
    if (category === "all") return this.getFeatured();
    return this.searchOnline("", category, 30);
  }

  /** 获取已安装扩展 */
  getInstalled(): ExtensionInfo[] {
    return Array.from(this.installed.values());
  }

  /** 安装并激活扩展（从缓存或在线获取信息） */
  async install(extensionId: string): Promise<boolean> {
    // 先从缓存查找
    let ext: ExtensionInfo | undefined;
    for (const [, cached] of this.cache) {
      ext = cached.data.find((e) => e.id === extensionId);
      if (ext) break;
    }
    // 缓存没有则在线获取
    if (!ext) {
      const [namespace, name] = extensionId.split(".");
      if (!namespace || !name) return false;
      try {
        const res = await fetch(`${OPEN_VSX_API}/${namespace}/${name}`);
        if (!res.ok) return false;
        const data: OpenVSXExtension = await res.json();
        ext = this.convertExtension(data);
      } catch {
        return false;
      }
    }
    const installedExt = { ...ext, installed: true, enabled: true };
    this.installed.set(ext.id, installedExt);
    this.saveInstalled();
    this.activate(extensionId);
    this.emit("install", installedExt);
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
    this.emit("uninstall", ext);
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
    this.emit(enabled ? "enable" : "disable", ext);
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
    this.listeners.forEach((cb) => cb(event, ext));
  }

  /** 获取分类列表 */
  getCategories(): Array<{ id: string; name: string; icon: string }> {
    return [
      { id: "all", name: "全部", icon: "📦" },
      { id: "theme", name: "主题", icon: "🎨" },
      { id: "language", name: "语言", icon: "📝" },
      { id: "snippet", name: "代码片段", icon: "✂️" },
      { id: "tool", name: "工具", icon: "🔧" },
      { id: "ai", name: "AI", icon: "🤖" },
    ];
  }
}

// React 代码片段
const _REACT_SNIPPETS: Record<string, { prefix: string; body: string[]; description: string }> = {
  "React Function Component": {
    prefix: "rfc",
    body: [
      "export const ${1:Component} = () => {",
      "  return (",
      "    <div>",
      "      ${2:content}",
      "    </div>",
      "  );",
      "};",
    ],
    description: "创建 React 函数组件",
  },
  "useState Hook": {
    prefix: "us",
    body: ["const [${1:state}, set${1/(.*)/${1:/capitalize}/}] = useState(${2:initialValue});"],
    description: "创建 useState Hook",
  },
  "useEffect Hook": {
    prefix: "ue",
    body: [
      "useEffect(() => {",
      "  ${1:effect}",
      "  return () => {",
      "    ${2:cleanup}",
      "  };",
      "}, [${3:deps}]);",
    ],
    description: "创建 useEffect Hook",
  },
  "useCallback Hook": {
    prefix: "ucb",
    body: ["const ${1:callback} = useCallback(() => {", "  ${2:body}", "}, [${3:deps}]);"],
    description: "创建 useCallback Hook",
  },
  "useMemo Hook": {
    prefix: "um",
    body: ["const ${1:value} = useMemo(() => ${2:computation}, [${3:deps}]);"],
    description: "创建 useMemo Hook",
  },
};

// Vue 代码片段
const _VUE_SNIPPETS: Record<string, { prefix: string; body: string[]; description: string }> = {
  "Vue 3 Setup": {
    prefix: "v3setup",
    body: [
      '<script setup lang="ts">',
      "${1:// code}",
      "</script>",
      "",
      "<template>",
      "  <div>${2:content}</div>",
      "</template>",
    ],
    description: "Vue 3 Setup 组件",
  },
  "Vue Ref": {
    prefix: "vref",
    body: ["const ${1:name} = ref(${2:initialValue});"],
    description: "创建 Vue ref",
  },
  "Vue Reactive": {
    prefix: "vreactive",
    body: ["const ${1:state} = reactive({", "  ${2:key}: ${3:value},", "});"],
    description: "创建 Vue reactive",
  },
  "Vue Computed": {
    prefix: "vcomputed",
    body: ["const ${1:name} = computed(() => ${2:expression});"],
    description: "创建 Vue computed",
  },
};

export const marketplaceService = new MarketplaceService();
export default marketplaceService;
