# MindCode 快速开始指南

> 版本: 0.1.0（以 `package.json` 为准）  
> 状态: 开发中，仅本地 `npm run dev`。**不是**生产就绪。

---

## 🚀 快速启动

### 1. 安装依赖

```bash
npm install
cp .env.example .env
# 在 .env 中填入至少一个 MINDCODE_*_API_KEY。不要编辑 src/core/ai/config.ts。
```

### 2. 启动开发模式

```bash
npm run dev
```

应用将在 `http://localhost:5173` 启动

### 3. 构建（开发验证）

```bash
npm run build
```

`npm run dist` 目前会因缺少 `resources/icons` 失败，且打包后读不到仓库根 `.env`。在发行工程完成前不要当作可分发安装包。

---

## ⌨️ 核心快捷键

### 编辑器

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+P` | 快速打开文件 |
| `Ctrl+Shift+P` | 命令面板 |
| `Ctrl+Shift+F` | 全局搜索 |
| `Ctrl+S` | 保存文件 |
| `Ctrl+W` | 关闭文件 |
| `Ctrl+B` | 切换侧边栏 |

### LSP功能

| 快捷键 | 功能 |
|--------|------|
| `F12` | 跳转到定义 |
| `Shift+F12` | 查找所有引用 |
| `Ctrl+Shift+O` | 文档符号 (大纲) |
| 鼠标悬停 | 显示类型信息 |
| 输入时 | 自动补全 |

### 调试器

| 快捷键 | 功能 |
|--------|------|
| `F5` | 启动调试 |
| `F9` | 切换断点 |
| `F10` | 单步跳过 |
| `F11` | 单步进入 |
| `Shift+F11` | 单步跳出 |
| `Shift+F5` | 停止调试 |
| `Ctrl+Shift+F5` | 重启调试 |

### AI功能

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+L` | 打开AI对话 |
| `Ctrl+K` | 内联编辑 (选中代码) |
| `Ctrl+I` | 内联对话 |
| `Ctrl+Shift+I` | Composer (项目重构) |
| `Tab` | 接受AI补全 |
| `@` | 触发上下文选择器 |

### Git

| 快捷键 | 功能 |
|--------|------|
| 侧边栏Git图标 | 打开Git面板 |
| 查看Diff | 点击修改的文件 |

### 终端

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+\`` | 打开/关闭底部面板 |
| `Ctrl+J` | 打开/关闭底部面板 (备选) |

---

## 📁 项目结构

```
MindCode/
├── src/
│   ├── main/              # Electron主进程
│   │   ├── index.ts       # 主入口 + IPC处理
│   │   ├── lsp-manager.ts # LSP管理器
│   │   └── preload.ts     # API暴露
│   ├── renderer/          # React渲染进程
│   │   ├── App.tsx        # 主应用
│   │   ├── components/    # UI组件
│   │   ├── services/      # 服务层
│   │   ├── stores/        # 状态管理
│   │   └── styles/        # 样式文件
│   └── core/              # 核心模块
│       ├── ai/            # AI服务
│       ├── lsp/           # LSP客户端
│       ├── debugger/      # 调试器
│       ├── indexing/      # 代码索引
│       ├── composer/      # Composer
│       ├── agent/         # Agent系统
│       └── plugins/       # 插件系统
└── docs/                  # 文档
```

---

## 🎯 功能使用

### LSP (语言服务器)

**支持的语言:**
- TypeScript / JavaScript
- Python
- Go
- Rust
- 更多语言即将支持...

**使用方法:**
1. 打开 `.ts/.js/.py` 等文件
2. LSP自动启动 (状态栏右侧显示)
3. 输入代码时自动提供补全
4. `F12` 跳转到定义
5. 鼠标悬停查看类型信息

**诊断面板:**
- `Ctrl+\`` 打开底部面板
- 切换到 "Problems" 标签
- 查看所有错误和警告
- 点击问题跳转到代码

---

### 调试器

**支持的调试器:**
- Node.js (JavaScript/TypeScript)
- Python (需安装debugpy)

**使用方法:**
1. 点击侧边栏调试图标 (或按 `F5`)
2. 选择调试配置
3. 点击行号左侧设置断点 (或按 `F9`)
4. 点击 "Start" 启动调试
5. 使用工具栏控制调试流程

**调试面板:**
- **Variables** - 查看当前变量
- **Call Stack** - 查看调用栈
- **Breakpoints** - 管理所有断点
- **Debug Console** - 求值表达式

---

### AI功能

**1. AI对话 (Ctrl+L)**
- 在右侧AI面板输入问题
- 使用 `@` 引用上下文
- 支持4种模式切换

**2. AI补全 (自动触发)**
- 输入代码时自动触发
- 显示灰色建议文本
- `Tab` 接受, `Esc` 拒绝

**3. 内联编辑 (Ctrl+K)**
- 选中代码
- 按 `Ctrl+K`
- 输入修改指令
- 预览Diff并应用

**4. Composer (Ctrl+Shift+I)**
- 项目级重构
- 多文件修改
- 依赖图可视化
- 分步执行

**5. @上下文引用**
- `@file` - 引用文件
- `@folder` - 引用文件夹
- `@codebase` - 搜索代码库
- `@web` - 网络搜索
- `@docs` - 文档搜索
- `@git` - Git信息

---

### Git集成

1. 点击侧边栏Git图标
2. 查看文件修改状态
3. 点击文件查看Diff
4. 暂存文件 (+图标)
5. 输入提交信息
6. 点击 "Commit" 提交

**高级功能:**
- 分支切换/创建
- 提交历史查看
- 冲突解决
- Stash管理

---

## 🔧 配置

### AI 密钥配置

**禁止**修改 `src/core/ai/config.ts` 填入 Key。该文件只读环境变量。

```bash
cp .env.example .env
```

在 `.env` 中设置例如：

```
MINDCODE_CLAUDE_API_KEY=
MINDCODE_OPENAI_API_KEY=
MINDCODE_DEEPSEEK_API_KEY=
```

默认走官方端点。若要用中转，显式设置对应 `MINDCODE_*_BASE_URL`。  
`.env` 不会进 Git。误提交后立即吊销，见 `docs/refactor/04_SECRET_REMEDIATION_PLAN.md`。

### LSP配置

编辑 `src/main/lsp-manager.ts`:

```typescript
export const LANGUAGE_SERVERS = {
  typescript: {
    command: 'npx',
    args: ['typescript-language-server', '--stdio']
  },
  python: {
    command: 'pylsp',
    args: []
  },
  // ... 其他语言
};
```

### 项目规则

创建 `.mindcode/rules/coding-style.md`:

```markdown
# 项目编码规范

- 使用 TypeScript
- 2空格缩进
- 单引号字符串
- 禁止使用 any
```

---

## 🐛 常见问题

### Q: LSP没有启动?

**A:** 确保已安装语言服务器:

```bash
# TypeScript
npm install -g typescript-language-server

# Python
pip install python-lsp-server

# Go
go install golang.org/x/tools/gopls@latest

# Rust
rustup component add rust-analyzer
```

### Q: 调试器无法启动?

**A:** 检查调试配置:
1. 确保选择了正确的调试类型
2. 验证program路径正确
3. 检查工作目录设置

### Q: AI补全不触发?

**A:** 检查:
1. 补全服务是否启动 (查看控制台)
2. API Key是否配置
3. 网络连接是否正常

### Q: 性能问题?

**A:** 尝试:
1. 关闭不需要的面板
2. 限制打开的文件数量
3. 清理Monaco Model缓存
4. 重启应用

---

## 📚 更多文档

- [README.md](README.md) — 密钥约定与安全要求
- [docs/refactor/03_REFACTOR_ROADMAP.md](docs/refactor/03_REFACTOR_ROADMAP.md) — 重构路线图
- [docs/refactor/01_BUG_AND_RISK_REGISTER.md](docs/refactor/01_BUG_AND_RISK_REGISTER.md) — 已知风险
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 架构说明（部分过时）

---

## 开始使用

```bash
git clone https://github.com/Oct7love/MindCode-IDE.git
cd MindCode-IDE
npm install
cp .env.example .env
npm run dev
```
