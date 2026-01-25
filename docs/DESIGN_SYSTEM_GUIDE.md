# MindCode 设计系统使用指南

## 快速开始

### 1. 引入设计系统 CSS

在 `src/renderer/main.tsx` 或主样式文件中引入：

```typescript
import './styles/design-system-v2.css';
```

### 2. 使用设计 Tokens

所有设计 tokens 已定义为 CSS 变量，可直接使用：

```css
.my-component {
  background: var(--bg-1);
  color: var(--text-primary);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  border: var(--border-width-thin) solid var(--border-default);
}
```

### 3. AI Panel 组件结构

#### 基础容器
```tsx
<div className="ai-panel-v2">
  {/* Header */}
  <div className="ai-panel-header">
    <div className="ai-panel-header-icon">...</div>
    <div className="ai-panel-header-title">MindCode AI</div>
    <div className="ai-panel-header-actions">...</div>
  </div>

  {/* Mode Switcher */}
  <div className="ai-mode-switcher">
    <button className="ai-mode-tab active">Chat</button>
    <button className="ai-mode-tab">Plan</button>
    <button className="ai-mode-tab">Agent</button>
    <button className="ai-mode-tab badge">Debug</button>
  </div>

  {/* Context Area */}
  <div className="ai-context-area">
    <div className="ai-context-chip type-file">...</div>
  </div>

  {/* Content Area */}
  <div className="ai-chat-view">...</div>
  {/* 或 ai-plan-view, ai-agent-view, ai-debug-view */}
</div>
```

## 组件使用示例

### Context Chip
```tsx
<div className="ai-context-chip type-file">
  <span className="ai-context-chip-icon">📄</span>
  <span className="ai-context-chip-label">src/index.ts</span>
  <button className="ai-context-chip-remove">×</button>
</div>
```

### Chat Message
```tsx
<div className="ai-message assistant">
  <div className="ai-message-header">
    <div className="ai-message-avatar">AI</div>
    <span className="ai-message-name">Assistant</span>
    <span className="ai-message-time">10:30</span>
  </div>
  <div className="ai-message-body">
    Message content...
    <div className="ai-message-code-block">
      <div className="ai-message-code-toolbar">
        <button className="ai-message-code-toolbar-btn">Copy</button>
        <button className="ai-message-code-toolbar-btn">Insert</button>
      </div>
      <pre className="ai-message-code-content">code...</pre>
    </div>
  </div>
</div>
```

### Plan Card
```tsx
<div className="ai-plan-card">
  <div className="ai-plan-header">
    <div className="ai-plan-title">Feature Implementation</div>
    <div className="ai-plan-version">
      <button className="ai-plan-version-btn active">v1</button>
      <button className="ai-plan-version-btn">v2</button>
    </div>
  </div>
  <div className="ai-plan-section">
    <div className="ai-plan-section-title">🎯 Goal</div>
    <div className="ai-plan-section-content">...</div>
  </div>
  <div className="ai-plan-actions">
    <button className="ai-plan-btn">Edit</button>
    <button className="ai-plan-btn">Lock Plan</button>
    <button className="ai-plan-btn primary">Execute</button>
  </div>
</div>
```

### Agent Stepper
```tsx
<div className="ai-agent-stepper">
  <div className="ai-agent-step">
    <div className="ai-agent-step-icon succeeded">✓</div>
    <div className="ai-agent-step-label">Read file.ts</div>
    <div className="ai-agent-step-status">Done</div>
  </div>
  <div className="ai-agent-step">
    <div className="ai-agent-step-icon running">⟳</div>
    <div className="ai-agent-step-label">Modify file.ts</div>
    <div className="ai-agent-step-status">Running</div>
  </div>
</div>
```

### Debug Issue
```tsx
<div className="ai-debug-issue-card">
  <div className="ai-debug-issue-title">
    🐛 TypeError: Cannot read property
  </div>
  <div className="ai-debug-issue-description">...</div>
</div>

<div className="ai-debug-section">
  <div className="ai-debug-section-title">📊 Observations</div>
  <div className="ai-debug-section-content">...</div>
</div>

<div className="ai-debug-fix-option">
  <div className="ai-debug-fix-option-title">Fix Option 1</div>
  <div className="ai-debug-fix-actions">
    <button className="ai-debug-fix-btn">Preview</button>
    <button className="ai-debug-fix-btn primary">Apply</button>
    <button className="ai-debug-fix-btn">Copy</button>
  </div>
</div>
```

## 状态管理建议

### 模式切换
```typescript
type AIMode = 'chat' | 'plan' | 'agent' | 'debug';

const [currentMode, setCurrentMode] = useState<AIMode>('chat');

// 切换模式时的上下文处理
const handleModeChange = (newMode: AIMode) => {
  // 根据切换规则处理上下文
  if (currentMode === 'chat' && newMode === 'agent') {
    // 需要先有 Plan
    if (!hasPlan) {
      showNotification('需要先创建 Plan');
      return;
    }
  }
  setCurrentMode(newMode);
};
```

### Context 管理
```typescript
interface ContextItem {
  id: string;
  type: 'file' | 'selection' | 'error' | 'terminal' | 'diff';
  label: string;
  data: any;
  locked?: boolean;
}

const [contexts, setContexts] = useState<ContextItem[]>([]);

const addContext = (item: ContextItem) => {
  setContexts([...contexts, item]);
};

const removeContext = (id: string) => {
  setContexts(contexts.filter(c => c.id !== id && !c.locked));
};
```

## 与编辑器联动

### 引用选区
```typescript
// 在编辑器选中代码后
const handleSelection = (selection: string, file: string, range: Range) => {
  addContext({
    id: generateId(),
    type: 'selection',
    label: `${file}:${range.start.line}-${range.end.line}`,
    data: { selection, file, range }
  });
};
```

### 应用 Diff
```typescript
const applyDiff = (file: string, diff: string) => {
  // 发送 IPC 消息到主进程
  window.mindcode.fs.writeFile(file, diff);
  // 在编辑器中打开文件并显示变更
  window.mindcode.editor.openFile(file);
};
```

## 动效使用

所有动效已内置在 CSS 中，使用 `transition` 属性：

```css
/* 默认过渡 */
.my-element {
  transition: all var(--duration-fast) var(--ease-default);
}

/* 自定义过渡 */
.my-element {
  transition: 
    background var(--duration-normal) var(--ease-default),
    transform var(--duration-fast) var(--ease-out);
}
```

## 风格方向切换

可以通过覆盖 CSS 变量来切换风格方向：

```css
/* 极简风格 */
.ai-panel-v2 {
  --panel-padding: 20px; /* 增加 20% */
  --border-subtle: rgba(255, 255, 255, 0.02); /* 降低透明度 */
  --radius-md: 4px; /* 减少 2px */
}

/* 科技感风格 */
.ai-panel-v2 {
  --bg-1: #0d0d10; /* 增加对比度 */
  --border-default: rgba(255, 255, 255, 0.1); /* 增加透明度 */
  --accent-primary: #60a5fa; /* 更亮的蓝色 */
}

/* 温和风格 */
.ai-panel-v2 {
  --bg-0: #0d0d0f; /* 更暖的深色 */
  --accent-primary: #4a9eff; /* 更柔和的蓝色 */
  --radius-md: 8px; /* 增加 2px */
}
```

## 最佳实践

1. **保持一致性**：始终使用设计 tokens，不要硬编码颜色或尺寸
2. **响应式**：使用相对单位（rem、em）和 flexbox
3. **性能**：避免过度动画，使用 `transform` 和 `opacity` 做动画
4. **无障碍**：确保足够的对比度，支持键盘导航
5. **测试**：在不同屏幕尺寸和缩放级别下测试

## 常见问题

### Q: 如何自定义颜色？
A: 覆盖对应的 CSS 变量即可，不需要修改组件类名。

### Q: 如何添加新的 Context 类型？
A: 添加新的 `type-*` 类，并定义对应的背景和边框色。

### Q: 如何实现模式切换动画？
A: 使用 CSS `transition` 和 `transform`，参考 `messageSlideIn` 动画。

---

**更多信息请参考**：`DESIGN_SYSTEM.md`
