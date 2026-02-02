# MindCode UI Design Specification

## 设计理念

MindCode 的 UI 设计借鉴 Cursor、VSCode、Linear 和 Vercel 的设计语言，追求：

1. **深邃沉浸** - 极深的暗色背景，减少视觉疲劳
2. **精致细腻** - 微妙的渐变、光效和动画
3. **层次分明** - 清晰的视觉层级
4. **专业高效** - 不牺牲功能性的美观

---

## 色彩系统

### 背景色阶（由深到浅）

| Token | 值 | 用途 |
|-------|-----|------|
| `--premium-bg-deepest` | `#07070a` | 编辑器背景 |
| `--premium-bg-deep` | `#0a0a0d` | 输入框背景 |
| `--premium-bg-base` | `#0d0d10` | 面板基础背景 |
| `--premium-bg-surface` | `#111114` | 卡片、头部背景 |
| `--premium-bg-elevated` | `#161619` | 悬浮层、高亮 |

### 边框

| Token | 值 | 用途 |
|-------|-----|------|
| `--premium-border` | `rgba(255, 255, 255, 0.06)` | 默认边框 |
| `--premium-border-hover` | `rgba(255, 255, 255, 0.10)` | Hover 边框 |
| `--premium-border-focus` | `#6366f1` | Focus 边框 |

### 文本色

| Token | 值 | 用途 |
|-------|-----|------|
| `--premium-text-primary` | `#f5f5f7` | 主要文本 |
| `--premium-text-secondary` | `#a1a1a6` | 次要文本 |
| `--premium-text-tertiary` | `#6e6e73` | 辅助文本 |
| `--premium-text-muted` | `#48484a` | 静音文本 |

### 强调色

| Token | 值 | 用途 |
|-------|-----|------|
| `--premium-accent` | `#8b5cf6` | 主强调色（紫） |
| `--premium-accent-secondary` | `#6366f1` | 次强调色（靛） |
| `--premium-accent-glow` | `rgba(139, 92, 246, 0.35)` | 光晕效果 |

### 渐变

```css
/* 主强调渐变 */
--premium-gradient-accent: linear-gradient(135deg, #8b5cf6 0%, #6366f1 50%, #3b82f6 100%);

/* 背景微光渐变 */
--premium-gradient-glow: radial-gradient(ellipse at center, rgba(139, 92, 246, 0.15) 0%, transparent 70%);
```

---

## 间距系统

基于 4px 的间距系统：

- `4px` - 极小间距
- `8px` - 小间距
- `12px` - 中小间距
- `16px` - 标准间距
- `20px` - 中间距
- `24px` - 大间距
- `32px` - 特大间距
- `48px` - 区块间距

---

## 圆角系统

| Size | 值 | 用途 |
|------|-----|------|
| `xs` | `2px` | 极小元素 |
| `sm` | `4px` | 小按钮 |
| `md` | `6px` | 输入框、标签 |
| `lg` | `8px` | 卡片、面板 |
| `xl` | `10px` | 大卡片 |
| `2xl` | `12px` | 对话气泡 |
| `3xl` | `16px` | 模态框 |

---

## 阴影系统

### 常规阴影

```css
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(0, 0, 0, 0.4);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.4);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.4);
```

### 光晕阴影

```css
/* AI 紫色光晕 */
--shadow-glow-ai: 0 0 15px rgba(139, 92, 246, 0.35), 0 0 30px rgba(59, 130, 246, 0.15);

/* Focus 蓝色光晕 */
--shadow-focus: 0 0 0 2px rgba(59, 130, 246, 0.3);
```

---

## 动效系统

### 时长

| Token | 值 | 用途 |
|-------|-----|------|
| `fast` | `125ms` | 微交互 |
| `normal` | `175ms` | 标准过渡 |
| `slow` | `250ms` | 强调动画 |
| `emphasis` | `350ms` | 特殊动画 |

### 缓动曲线

```css
/* 流畅出 - 推荐默认使用 */
--ease-out: cubic-bezier(0.22, 1, 0.36, 1);

/* 弹性 - 用于强调 */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

/* 平滑 - 用于复杂动画 */
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
```

---

## 组件规范

### Activity Bar（左侧图标栏）

- 宽度：`48px`
- 背景：`--premium-bg-deep`
- 图标大小：`20px`
- 激活指示器：左侧 `3px` 紫色渐变条

### Sidebar（侧边栏）

- 默认宽度：`240px`
- 背景：`--premium-bg-base`
- 文件行高度：`24px`
- 选中态：左侧 `2px` 紫色指示条 + 微透明蓝色背景

### Editor Tabs（标签栏）

- 高度：`35px`
- 激活标签：底部渐变高亮线
- 关闭按钮：hover 时显示

### AI Panel（AI 面板）

- 默认宽度：`400px`
- 消息气泡圆角：`12px`
- 输入框圆角：`12px`
- Focus 态：紫色渐变边框 + 光晕

### Welcome Page（欢迎页面）

- 背景网格：`50px` 间距，极淡白色
- Logo：SVG 渐变 + 浮动动画
- 快捷键卡片：单列布局，hover 时微上移

---

## 字体规范

### UI 字体栈

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", system-ui, sans-serif;
```

### 代码字体栈

```css
font-family: "JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace;
```

### 字号

- `11px` - 标签、徽章
- `12px` - 次要信息、状态栏
- `13px` - 文件名、按钮
- `14px` - 正文、消息
- `15px` - 标题

### 字重

- `400` - 正常
- `500` - 中等（按钮、标签）
- `600` - 半粗（标题、强调）

---

## 交互规范

### Hover 效果

1. 背景色变化：`rgba(255, 255, 255, 0.03)` → `rgba(255, 255, 255, 0.05)`
2. 边框色变化：增加 4% 不透明度
3. 过渡时间：`150ms`

### Focus 效果

1. 移除默认 outline
2. 添加紫色边框：`border-color: #8b5cf6`
3. 添加光晕：`box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15)`

### Active 效果

1. 微缩放：`transform: scale(0.98)`
2. 背景色加深

---

## 响应式设计

### 最小尺寸

- Sidebar：`120px`
- AI Panel：`320px`
- Editor：`400px`

### 最大尺寸

- Sidebar：`480px`
- AI Panel：`600px`

---

## 可访问性

1. **对比度**：所有文本至少 4.5:1 对比度
2. **Focus 可见**：使用 `:focus-visible` 而非 `:focus`
3. **减少动画**：尊重 `prefers-reduced-motion`
4. **高对比度模式**：支持 `prefers-contrast: high`

---

## 文件结构

```
src/renderer/styles/
├── design-tokens.css      # 设计令牌定义
├── chat-tokens.css        # AI 对话专用令牌
├── cursor-premium.css     # 高级主题覆盖样式
├── main.css               # 主样式入口
├── vscode-theme.css       # VSCode 兼容变量
├── ai-panel.css           # AI 面板样式
├── components.css         # 通用组件样式
└── markdown.css           # Markdown 渲染样式
```

---

## 更新日志

### v3.1.0 (2026-01-27)

- 添加 `cursor-premium.css` 高级主题
- 改进欢迎页面设计（网格背景、Logo 动画）
- 增强 AI 面板样式（渐变边框、消息动画）
- 优化 Activity Bar 和 Sidebar 交互
- 添加滚动条样式统一
