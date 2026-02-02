# 贡献指南

感谢您对 MindCode IDE 的关注！欢迎贡献代码、报告问题或提出建议。

## 🚀 快速开始

```bash
# Fork 并克隆
git clone https://github.com/YOUR_USERNAME/MindCode-IDE.git
cd MindCode-IDE

# 安装依赖
npm install

# 创建分支
git checkout -b feature/your-feature

# 开发
npm run dev
```

## 📋 开发规范

### 代码风格
- 使用 TypeScript 严格模式
- 遵循 ESLint 配置
- 组件使用函数式 + Hooks
- 注释使用中文，代码使用英文

### 提交规范
```
<type>(<scope>): <description>

type: feat|fix|docs|style|refactor|test|chore
scope: editor|ai|git|ui|core|...
```

示例:
```
feat(ai): add streaming response support
fix(editor): resolve cursor position bug
docs: update README
```

### 分支管理
- `main` - 稳定版本
- `develop` - 开发分支
- `feature/*` - 新功能
- `fix/*` - 修复
- `hotfix/*` - 紧急修复

## 🧪 测试

```bash
# 运行测试
npm run test

# 覆盖率
npm run test:coverage

# 监听模式
npm run test:watch
```

## 📁 目录结构

| 目录 | 说明 |
|------|------|
| `src/main/` | Electron 主进程 |
| `src/renderer/components/` | React 组件 |
| `src/renderer/hooks/` | 自定义 Hooks |
| `src/renderer/services/` | 服务层 |
| `src/renderer/stores/` | Zustand Store |
| `src/core/` | 核心模块 |
| `src/types/` | 类型定义 |
| `src/test/` | 测试文件 |

## ✅ PR 检查清单

- [ ] 代码通过 lint
- [ ] 添加/更新测试
- [ ] 更新文档（如需要）
- [ ] 提交信息符合规范
- [ ] 无敏感信息泄露

## 🐛 报告问题

请使用 [Issue 模板](https://github.com/Oct7love/MindCode-IDE/issues/new) 并提供:
- 复现步骤
- 期望行为
- 实际行为
- 环境信息（OS/版本）
- 截图/日志

## 💡 功能建议

欢迎在 [Discussions](https://github.com/Oct7love/MindCode-IDE/discussions) 提出想法！

## 📞 联系

- Issues: [GitHub Issues](https://github.com/Oct7love/MindCode-IDE/issues)
- Discussions: [GitHub Discussions](https://github.com/Oct7love/MindCode-IDE/discussions)

感谢您的贡献！🎉
