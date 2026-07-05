# MindCode IDE

> 🧠 AI-Powered Code Editor - 智能代码编辑器

[![CI](https://github.com/Oct7love/MindCode-IDE/actions/workflows/ci.yml/badge.svg)](https://github.com/Oct7love/MindCode-IDE/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## ✨ 特性

### 编辑器 (95% 完成)
- 🎨 Monaco Editor 内核 - VS Code 同款编辑体验
- 📁 文件树 + 多标签 + 分屏
- 🔍 全局搜索 + 符号跳转
- 📝 代码片段 + 书签管理
- 🎯 Outline 大纲视图
- 🔗 **LSP 语言服务器** - 定义跳转/类型提示/自动导入 ✨ **NEW**
- 🐛 **完整调试器** - 断点/变量/调用栈/单步执行 ✨ **NEW**

### AI 能力 (超越 Cursor)
- 💬 多模型对话 (Claude/GPT/Gemini/DeepSeek/GLM/Codesuc) - **7个模型**
- ✨ 智能代码补全 (Ghost Text) - 多级缓存+预取+<100ms响应
- 🔧 代码解释/修复/重构
- 🤖 Agent 工具调用 + 自主执行
- 📊 思考过程可视化
- 💬 **Ctrl+I 内联对话** - 光标位置直接与 AI 对话
- 🔍 **@符号上下文** - @file @folder @codebase @web @docs @git
- 🧠 **智能学习** - 记忆用户编码习惯和项目术语
- 🔎 **AI代码审查** - 安全/性能/规范检查+一键修复
- 🎯 **四种AI模式** - Chat/Plan/Agent/Debug

### 开发工具 (90% 完成)
- 🔀 Git 集成 (分支/提交/暂存/冲突解决)
- 🐙 GitHub 集成 (PR/Issue/CI)
- 🔌 插件系统
- 🏪 **扩展市场** - 浏览/搜索/安装扩展
- 🖥️ 终端管理
- 📦 任务运行器
- 📊 **代码索引** - AST+语义双索引+实时更新
- ✨ **Composer** - 项目级重构+依赖图可视化
- ⚡ **性能优化** - 懒加载+请求管道+启动优化 ✨ **NEW**
- 🐛 **Bug修复** - 循环检测+超时保护+内存清理 ✨ **NEW**

### 体验
- 🌙 6+ 主题 (深色/浅色)
- ⌨️ 快捷键自定义
- 🌍 国际化 (中/英)
- ⚡ 性能优化
- 🔄 崩溃恢复

## 🚀 快速开始

```bash
# 克隆项目
git clone https://github.com/Oct7love/MindCode-IDE.git
cd MindCode-IDE

# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build
```

## 🔑 配置 AI 密钥（本地）

AI 能力需要你自己的 API Key。**密钥只从环境变量读取，绝不写入源码或提交到 Git。**

```bash
# 1. 从模板创建本地 .env（.env 已被 .gitignore 忽略，不会被提交）
cp .env.example .env

# 2. 编辑 .env，填入你自己的 Key（至少配置一个 Provider 即可使用）
#    MINDCODE_CLAUDE_API_KEY=sk-...
#    MINDCODE_OPENAI_API_KEY=sk-...
#    MINDCODE_DEEPSEEK_API_KEY=sk-...
```

约定与安全要求：

- 默认 `*_BASE_URL` 指向各厂商**官方端点**；如需自建/第三方中转，自行在 `.env` 里覆盖对应 `MINDCODE_*_BASE_URL`。
- **禁止**把真实 Key 写进任何源码、测试、快照或文档；`.env`、`*.pem`、`*.key` 等已被 `.gitignore` 忽略。
- 仓库启用了 gitleaks（`.gitleaks.toml`）：pre-commit 会扫描暂存区、CI 会扫描新提交，含密钥的提交会被拦截。
  本地建议安装：`brew install gitleaks`。
- 若不慎提交了密钥：立即到对应控制台**吊销/轮换**，并参见 `docs/refactor/04_SECRET_REMEDIATION_PLAN.md`。

## 📁 项目结构

```
src/
├── main/           # Electron 主进程
├── renderer/       # React 渲染进程
│   ├── components/ # UI 组件 (50+)
│   ├── hooks/      # 自定义 Hooks (20+)
│   ├── services/   # 服务层
│   ├── stores/     # Zustand 状态
│   ├── styles/     # CSS 变量/动画
│   ├── contexts/   # React Context
│   ├── constants/  # 常量配置
│   ├── utils/      # 工具函数
│   └── i18n/       # 国际化
├── core/           # 核心模块
│   ├── ai/         # AI 服务 (多模型/补全/对话)
│   ├── agent/      # Agent/Composer
│   ├── indexing/   # 代码索引 (AST/语义)
│   ├── lsp/        # LSP 客户端
│   ├── review/     # AI 代码审查
│   ├── learning/   # 智能学习系统
│   ├── remote/     # 远程开发 (SSH)
│   ├── collab/     # 实时协作
│   ├── github/     # GitHub API
│   ├── plugins/    # 插件系统
│   ├── logger/     # 日志系统
│   └── recovery/   # 崩溃恢复
├── types/          # 类型定义 (50+)
└── test/           # 测试
```

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+P` | 快速打开文件 |
| `Ctrl+Shift+P` | 命令面板 |
| `Ctrl+B` | 切换侧边栏 |
| `Ctrl+J` | 切换终端 |
| `Ctrl+L` | 打开 AI 对话 |
| `Ctrl+K` | AI 内联编辑 |
| `Ctrl+I` | 内联对话 (光标位置) |
| `Ctrl+Shift+I` | Composer |
| `@` | 触发上下文选择器 |
| `F12` | 跳转定义 (LSP) |
| `Tab` | 接受补全 |
| `Esc` | 取消补全 |
| `Ctrl+S` | 保存 |
| `Ctrl+Z` | 撤销 |
| `Ctrl+Shift+Z` | 重做 |

## 🔌 插件开发

```javascript
// plugins/my-plugin/manifest.json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "main": "index.js",
  "permissions": ["editor"],
  "contributes": {
    "commands": [{ "id": "myPlugin.hello", "title": "Hello" }]
  }
}

// plugins/my-plugin/index.js
export function activate(api) {
  api.commands.register('myPlugin.hello', () => {
    api.window.showMessage('Hello from plugin!');
  });
}
```

## 🛠️ 技术栈

- **框架**: Electron 40 + React 18 + TypeScript 5
- **编辑器**: Monaco Editor
- **状态**: Zustand + React Context
- **样式**: Tailwind CSS + CSS Variables
- **AI**: Anthropic/OpenAI/Google AI SDK
- **构建**: Vite + electron-builder
- **测试**: Vitest + Testing Library

## 📊 统计 (更新: 2026-02-04)

- 组件: 80+ (新增: LSP, 调试器, 性能优化)
- Hooks: 25+
- 类型定义: 60+
- 代码行数: 55,000+
- 测试覆盖: 25%
- 完成度: **92%**
- **状态: 生产就绪** ✅

## 📄 许可

MIT License - 详见 [LICENSE](LICENSE)

## 🤝 贡献

欢迎 PR！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)
