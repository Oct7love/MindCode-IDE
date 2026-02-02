# MindCode 架构文档

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron |
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite |
| 状态管理 | Zustand |
| 编辑器内核 | Monaco Editor |
| 样式方案 | Tailwind CSS + CSS Variables |
| AI 集成 | Anthropic / OpenAI / Codesuc |
| 数据存储 | IndexedDB / LocalStorage |
| 测试框架 | Vitest + Testing Library |

---

## 目录结构

```
src/
├── main/                    # Electron 主进程
│   ├── index.ts            # 主入口
│   └── preload.ts          # 预加载脚本
├── core/                    # 核心业务模块
│   ├── ai/                 # AI 服务
│   │   ├── contextManager.ts
│   │   ├── modelRouter.ts
│   │   └── promptTemplates.ts
│   ├── debugger/           # 调试器
│   ├── extensions/         # 扩展系统
│   ├── github/             # GitHub 集成
│   ├── git/                # Git 操作
│   ├── indexing/           # 代码索引
│   ├── lsp/                # 语言服务
│   ├── plugins/            # 插件系统
│   └── workspace/          # 工作区管理
├── renderer/               # 渲染进程
│   ├── components/         # React 组件
│   ├── config/             # 应用配置
│   ├── contexts/           # React Context
│   ├── hooks/              # 自定义 Hooks
│   ├── services/           # 前端服务
│   ├── stores/             # Zustand Stores
│   ├── styles/             # 样式文件
│   └── utils/              # 工具函数
├── shared/                 # 共享代码
│   └── types/              # 类型定义
└── test/                   # 测试文件
```

---

## 架构分层

```
┌─────────────────────────────────────────────────────────┐
│                     UI Layer (React)                     │
│  Components / Hooks / Contexts / Stores                  │
├─────────────────────────────────────────────────────────┤
│                   Service Layer                          │
│  SearchEngine / CodeNavigation / AutoSave / Cache        │
├─────────────────────────────────────────────────────────┤
│                    Core Layer                            │
│  AI / Git / LSP / Indexing / Plugins / Extensions        │
├─────────────────────────────────────────────────────────┤
│                   IPC Bridge                             │
│  window.mindcode.* (preload exposed API)                 │
├─────────────────────────────────────────────────────────┤
│                 Main Process (Node.js)                   │
│  File System / Child Process / Native Modules            │
└─────────────────────────────────────────────────────────┘
```

---

## 数据流

```
User Action
    │
    ▼
React Component ──► Zustand Store ──► UI Update
    │                    │
    │                    ▼
    │              LocalStorage
    │              (persist)
    │
    ▼
Service Layer ──► IPC Bridge ──► Main Process
    │                                 │
    ▼                                 ▼
IndexedDB                        File System
```

---

## 关键模块设计

### 1. AI 系统

```
┌─────────────────┐
│  ContextManager │  上下文窗口管理
├─────────────────┤
│  ModelRouter    │  模型智能选择
├─────────────────┤
│  PromptTemplates│  提示词模板
├─────────────────┤
│  MessageCompress│  消息压缩
└─────────────────┘
         │
         ▼
┌─────────────────┐
│   AI Provider   │  Anthropic/OpenAI/Codesuc
└─────────────────┘
```

### 2. 插件系统

```
Plugin Manifest (plugin.json)
         │
         ▼
┌─────────────────┐
│  Plugin Loader  │  加载/验证插件
├─────────────────┤
│  Contribution   │  贡献点注册
│  Registry       │  (commands/menus/views)
├─────────────────┤
│  Plugin Manager │  生命周期管理
├─────────────────┤
│  Sandbox        │  隔离执行环境
└─────────────────┘
```

### 3. 编辑器集成

```
Monaco Editor
     │
     ├── InlineCompletionProvider (AI 补全)
     ├── CodeActionProvider (快速修复)
     ├── HoverProvider (悬停信息)
     ├── DefinitionProvider (定义跳转)
     └── DocumentFormattingProvider (格式化)
```

---

## 性能优化策略

| 策略 | 实现 |
|------|------|
| 组件懒加载 | `createLazyComponent` + React.lazy |
| 虚拟列表 | `VirtualList` 组件 |
| 请求缓存 | `CacheManager` (LRU + TTL) |
| 请求去重 | `ApiClient` pending map |
| Web Worker | Token 计算 / 索引构建 |
| 防抖节流 | `useDebounce` / `useThrottle` |
| 按需加载 | Vite manualChunks |

---

## 安全设计

| 风险点 | 防护措施 |
|--------|----------|
| 敏感信息 | keytar 加密存储 |
| 插件权限 | 权限声明 + 用户确认 |
| 工作区信任 | WorkspaceTrust 机制 |
| AI 工具调用 | requireConfirmation 标记 |
| XSS | Content Security Policy |
| 路径遍历 | 路径白名单校验 |

---

## 扩展点

| 扩展点 | 说明 |
|--------|------|
| commands | 命令注册 |
| menus | 菜单项 |
| keybindings | 快捷键绑定 |
| views | 视图面板 |
| themes | 主题 |
| languages | 语言支持 |
| snippets | 代码片段 |
| configuration | 配置项 |

---

## 测试策略

```
Unit Tests (Vitest)
├── Services (searchEngine, cache, etc.)
├── Utils (debounce, formatters, etc.)
└── Stores (Zustand stores)

Component Tests (Testing Library)
├── UI Components
└── Integration Tests

E2E Tests (Playwright - 未来)
└── Full User Flows
```

---

## CI/CD 流程

```
Push/PR
   │
   ▼
GitHub Actions
   │
   ├── Lint (ESLint)
   ├── Test (Vitest)
   └── Build (Electron Builder)
         │
         ▼
   Release (GitHub Releases)
```
