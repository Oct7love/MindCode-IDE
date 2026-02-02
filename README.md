# MindCode IDE

> 🧠 AI-Powered Code Editor - 智能代码编辑器

[![CI](https://github.com/Oct7love/MindCode-IDE/actions/workflows/ci.yml/badge.svg)](https://github.com/Oct7love/MindCode-IDE/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## ✨ 特性

### 编辑器
- 🎨 Monaco Editor 内核 - VS Code 同款编辑体验
- 📁 文件树 + 多标签 + 分屏
- 🔍 全局搜索 + 符号跳转
- 📝 代码片段 + 书签管理
- 🎯 Outline 大纲视图

### AI 能力
- 💬 多模型对话 (Claude/GPT/Gemini/DeepSeek)
- ✨ 智能代码补全 (Ghost Text)
- 🔧 代码解释/修复/重构
- 🤖 Agent 工具调用
- 📊 思考过程可视化

### 开发工具
- 🔀 Git 集成 (分支/提交/暂存/冲突解决)
- 🐙 GitHub 集成 (PR/Issue/CI)
- 🔌 插件系统
- 🖥️ 终端管理
- 📦 任务运行器

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
│   ├── ai/         # AI 服务
│   ├── agent/      # Agent/Composer
│   ├── indexing/   # 代码索引
│   ├── lsp/        # LSP 客户端
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
| `Ctrl+Shift+I` | Composer |
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

## 📊 统计

- 组件: 50+
- Hooks: 20+
- 类型定义: 50+
- CSS 变量: 80+
- 图标: 60+
- 主题: 6

## 📄 许可

MIT License - 详见 [LICENSE](LICENSE)

## 🤝 贡献

欢迎 PR！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)
