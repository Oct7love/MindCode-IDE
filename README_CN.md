# MindCode — AI 原生代码编辑器

> **版本**: `package.json` 为 **0.1.0**（文档里出现的 0.2.0 / 0.3.0 已过时）  
> **状态**: **开发中**，可本地 `npm run dev` 启动；**不是**生产就绪、也未提供可安装发行包  
> **事实来源**: 以当前代码和 `docs/refactor/` 为准，不要把下文旧功能清单当成已全部落地

---

## 🌟 项目亮点

### 已实现或规划中的能力（清单不等于全部可用）

1. **多AI模型支持** (7个模型)
   - Claude (Opus 4.5, Sonnet 4.5)
   - GPT (GPT-4, GPT-3.5)
   - Gemini (2.5 Flash, 3 Pro)
   - DeepSeek
   - GLM
   - Codesuc

2. **四种AI模式**
   - **Chat** - 日常对话
   - **Plan** - 规划模式
   - **Agent** - 自主执行
   - **Debug** - 调试辅助

3. **AI代码审查**
   - 安全漏洞检测
   - 性能问题识别
   - 代码规范检查
   - 一键修复建议

4. **智能学习系统**
   - 学习编码习惯
   - 项目术语记忆
   - 个性化补全

5. **双索引系统**
   - AST精确索引
   - 语义相关索引
   - 混合搜索

---

## ✨ 核心功能清单（历史文档，含未完成项）

### 编辑器 (95%)
- ✅ Monaco Editor 内核
- ✅ 多文件Tab管理
- ✅ 命令面板 (Ctrl+P)
- ✅ 全局搜索 (Ctrl+Shift+F)
- ✅ 代码折叠和高亮
- ✅ 多光标编辑

### LSP语言服务器 (95%) ✨ 完整实现
- ✅ **代码补全** - 输入时自动提示
- ✅ **定义跳转** - F12跳转到定义
- ✅ **悬停提示** - 鼠标查看类型
- ✅ **查找引用** - Shift+F12
- ✅ **文档符号** - Ctrl+Shift+O (大纲)
- ✅ **实时诊断** - 错误/警告实时显示
- ✅ **5种语言** - TypeScript, JavaScript, Python, Go, Rust

### 调试器 (90%) ✨ 完整实现
- ✅ **断点调试** - F9切换断点
- ✅ **单步执行** - F10/F11/Shift+F11
- ✅ **变量查看** - 树形展示所有变量
- ✅ **调用栈** - 完整调用链显示
- ✅ **调试控制台** - 表达式求值
- ✅ **条件断点** - 支持条件和日志
- ✅ **多会话** - 同时调试多个程序

### AI功能 (95%)
- ✅ **AI对话** - Ctrl+L打开
- ✅ **AI补全** - Ghost Text + Tab接受
- ✅ **内联编辑** - Ctrl+K选中编辑
- ✅ **Apply Changes** - 一键应用AI代码
- ✅ **Diff预览** - 修改前后对比
- ✅ **Composer** - 项目级重构
- ✅ **工具调用** - Agent自主执行
- ✅ **@上下文** - @file @folder @codebase

### Git集成 (90%)
- ✅ 文件状态显示
- ✅ Diff查看
- ✅ 暂存和提交
- ✅ 分支管理
- ✅ 提交历史
- ✅ 冲突解决

### 其他功能
- ✅ 集成终端
- ✅ 代码索引
- ✅ 项目规则
- ✅ 插件系统
- ✅ 主题切换
- ✅ 快捷键自定义

---

## 🚀 快速开始

### 安装

```bash
git clone https://github.com/Oct7love/MindCode-IDE.git
cd MindCode-IDE
npm install
cp .env.example .env   # 按需填入 MINDCODE_*_API_KEY，不要改源码
```

### 启动

```bash
npm run dev
```

### 构建

```bash
# 构建所有平台
npm run build && npm run dist

# 仅Windows
npm run dist:win
```

---

## ⌨️ 核心快捷键

### 编辑器
| 快捷键 | 功能 |
|--------|------|
| `Ctrl+P` | 快速打开文件 |
| `Ctrl+Shift+P` | 命令面板 |
| `Ctrl+Shift+F` | 全局搜索 |
| `Ctrl+S` | 保存 |
| `Ctrl+W` | 关闭文件 |

### LSP ✨ NEW
| 快捷键 | 功能 |
|--------|------|
| `F12` | 跳转到定义 |
| `Shift+F12` | 查找所有引用 |
| `Ctrl+Shift+O` | 文档符号 (大纲) |
| 鼠标悬停 | 显示类型信息 |
| 输入时 | 自动补全 |

### 调试器 ✨ NEW
| 快捷键 | 功能 |
|--------|------|
| `F5` | 启动/继续调试 |
| `F9` | 切换断点 |
| `F10` | 单步跳过 |
| `F11` | 单步进入 |
| `Shift+F11` | 单步跳出 |
| `Shift+F5` | 停止调试 |

### AI
| 快捷键 | 功能 |
|--------|------|
| `Ctrl+L` | AI对话 |
| `Ctrl+K` | 内联编辑 |
| `Ctrl+I` | 内联对话 |
| `Ctrl+Shift+I` | Composer |
| `Tab` | 接受AI补全 |
| `@` | 上下文选择 |

### 其他
| 快捷键 | 功能 |
|--------|------|
| `Ctrl+\`` | 打开底部面板 |
| `Ctrl+B` | 切换侧边栏 |

---

## 📊 性能指标

| 指标 | 目标 | 实际 | 状态 |
|------|------|------|------|
| 启动时间 | <2.5s | ~2s | ✅ 优秀 |
| AI响应 | <600ms | ~500ms | ✅ 优秀 |
| 补全延迟 | <150ms | ~100ms | ✅ 优秀 |
| 内存占用 | <600MB | ~450MB | ✅ 优秀 |

---

## 🎯 当前阶段（请勿当作完成度）

编辑器核心路径（打开 / 编辑 / 切 tab / 保存）可用，并有 M5 回归。  
LSP、调试器、插件市场、GitHub、协作、SSH、崩溃恢复等界面仍有半实现或未接线部分，详见 `docs/refactor/01_BUG_AND_RISK_REGISTER.md`。

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 30.5.1 |
| 前端框架 | React 18 + TypeScript 5 |
| 编辑器 | Monaco Editor |
| 状态管理 | Zustand |
| 样式 | Tailwind CSS + CSS Variables |
| 构建工具 | Vite + electron-builder |
| AI集成 | Anthropic/OpenAI/Google AI SDK |
| 测试框架 | Vitest |

---

## 📁 项目结构

```
MindCode/
├── src/
│   ├── main/              # Electron主进程
│   │   ├── index.ts       # 主入口 + 所有IPC
│   │   ├── lsp-manager.ts # LSP管理器 ✨
│   │   └── preload.ts     # API暴露
│   ├── renderer/          # React渲染进程
│   │   ├── App.tsx        # 主应用
│   │   ├── components/    # 80+ UI组件
│   │   │   ├── LSP/       # LSP UI ✨ NEW
│   │   │   ├── Debugger/  # 调试器 UI ✨ NEW
│   │   │   ├── AIPanel/   # AI面板
│   │   │   ├── Git/       # Git面板
│   │   │   └── ...
│   │   ├── services/      # 服务层
│   │   ├── stores/        # Zustand状态
│   │   └── styles/        # 样式
│   └── core/              # 核心模块
│       ├── ai/            # AI服务
│       ├── lsp/           # LSP客户端 ✨
│       ├── debugger/      # 调试器 ✨
│       ├── indexing/      # 代码索引
│       ├── composer/      # Composer
│       └── plugins/       # 插件系统
└── docs/                  # 文档
```

---

## 🔧 配置

### LSP配置

编辑 `src/main/lsp-manager.ts`:

```typescript
export const LANGUAGE_SERVERS = {
  typescript: { 
    command: 'typescript-language-server', 
    args: ['--stdio'] 
  },
  python: { 
    command: 'pylsp', 
    args: [] 
  },
  // ...
};
```

### AI 密钥配置

**禁止**把 API Key 写进 `src/core/ai/config.ts` 或任何源码。`config.ts` 只从环境变量读取。

```bash
cp .env.example .env
# 编辑 .env，至少配置一个：
# MINDCODE_CLAUDE_API_KEY=
# MINDCODE_OPENAI_API_KEY=
# MINDCODE_DEEPSEEK_API_KEY=
```

`.env` 已被 `.gitignore` 忽略。默认 Base URL 是各厂商官方端点；中转必须显式设置对应的 `MINDCODE_*_BASE_URL`。
若不慎提交密钥：立即吊销，并参见 `docs/refactor/04_SECRET_REMEDIATION_PLAN.md`。

---

## 🧪 测试

```bash
# 运行所有测试
npm test

# 运行集成测试
npm test integration

# 查看测试覆盖
npm run test:coverage
```

---

## 📚 文档

- [快速开始](QUICK_START.md)
- [英文 README](README.md)
- [重构路线图](docs/refactor/03_REFACTOR_ROADMAP.md)
- [风险登记](docs/refactor/01_BUG_AND_RISK_REGISTER.md)
- [架构说明](docs/ARCHITECTURE.md)（部分过时，以代码为准）

---

## 🤝 贡献

欢迎提交PR!

```bash
# Fork项目
# 创建分支
git checkout -b feature/my-feature

# 提交更改
git commit -m "feat: add my feature"

# 推送
git push origin feature/my-feature

# 创建Pull Request
```

---

## 📄 许可证

MIT License

---

## 🚀 立即开始

```bash
cp .env.example .env
npm install
npm run dev
```

发行打包（`npm run dist`）当前缺少 `resources/icons`，且打包后无法按开发路径读取 `.env`。在这些修好之前，请只作本地开发使用。
