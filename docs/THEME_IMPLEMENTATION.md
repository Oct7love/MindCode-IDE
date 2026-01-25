# 主题切换实现要点

## 1. 菜单栏结构

```
View > Theme >
  ├─ Dark Themes >
  │   ├─ Dark+ (default dark)
  │   ├─ Monokai
  │   ├─ GitHub Dark
  │   ├─ Dracula
  │   └─ One Dark Pro
  ├─ Light Themes >
  │   ├─ Light+ (default light)
  │   ├─ GitHub Light
  │   └─ Quiet Light
  ├─ High Contrast >
  │   ├─ Dark High Contrast
  │   └─ Light High Contrast
  └─ Follow System
```

## 2. 主题数据结构

```typescript
interface Theme {
  id: string;                    // 主题唯一标识
  name: string;                   // 显示名称
  type: 'dark' | 'light' | 'hc';  // 主题类型
  uiTokens: {                     // UI CSS variables
    [key: string]: string;
  };
  editorThemeRef: string;         // Monaco 主题名称 (vs/vs-dark/hc-black/hc-light)
}
```

## 3. 持久化

- 使用 `app.getPath('userData')/settings.json` 存储
- IPC: `settings:get` / `settings:set`
- 启动时通过 `loadTheme()` 读取并应用

## 4. 运行时切换

### UI 切换（CSS Variables）
```typescript
const root = document.documentElement;
Object.entries(theme.uiTokens).forEach(([key, value]) => {
  root.style.setProperty(key, value);
});
```

### Monaco 编辑器切换
```typescript
import('monaco-editor').then(monaco => {
  monaco.editor.setTheme(theme.editorThemeRef);
});
```

## 5. 代码示例

### Main Process (菜单点击)
```typescript
// src/main/index.ts
{
  label: 'Dark+ (default dark)',
  click: () => mainWindow?.webContents.send('theme:change', 'dark-plus')
}
```

### Renderer Process (应用主题)
```typescript
// src/renderer/App.tsx
useEffect(() => {
  // 初始化加载主题
  loadTheme().then(themeId => applyTheme(themeId));
  
  // 监听菜单切换
  const cleanup = window.mindcode?.onThemeChange((themeId) => {
    applyTheme(themeId);
    saveTheme(themeId);
  });
  
  return () => cleanup?.();
}, []);
```

### applyTheme 实现
```typescript
// src/renderer/utils/themes.ts
export function applyTheme(themeId: string): void {
  const theme = getTheme(themeId);
  if (!theme) return;
  
  // 1. 更新 UI CSS variables
  const root = document.documentElement;
  Object.entries(theme.uiTokens).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  
  // 2. 更新 Monaco 主题（全局，影响所有编辑器实例）
  import('monaco-editor').then(monaco => {
    monaco.editor.setTheme(theme.editorThemeRef);
  });
  
  // 3. 触发事件通知组件
  window.dispatchEvent(new CustomEvent('theme-changed', {
    detail: { themeId, editorTheme: theme.editorThemeRef }
  }));
}
```

## 6. 文件清单

- `src/renderer/utils/themes.ts` - 主题定义和工具函数
- `src/main/index.ts` - 菜单定义和 IPC handlers
- `src/main/preload.ts` - 暴露 `onThemeChange` API
- `src/renderer/App.tsx` - 主题初始化和监听
- `src/renderer/components/CodeEditor.tsx` - 监听主题变化更新编辑器
