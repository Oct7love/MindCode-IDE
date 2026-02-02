# MindCode API 文档

## 核心服务 API

### ConfigManager - 配置管理

```typescript
import { configManager } from '@/renderer/config/app';

configManager.get('editor')        // 获取编辑器配置
configManager.set('ai', { ... })   // 更新 AI 配置
configManager.getAll()             // 获取全部配置
configManager.reset()              // 重置为默认
configManager.onChange(fn)         // 监听变化
```

### SearchEngine - 搜索引擎

```typescript
import { searchEngine } from '@services/searchEngine';

// 全局搜索
const results = await searchEngine.search('keyword', {
  caseSensitive: false,
  wholeWord: true,
  regex: false,
  include: '*.ts',
  exclude: 'node_modules',
  maxResults: 1000
});

// 文件内搜索
const matches = searchEngine.searchInContent(content, 'pattern', options);

// 替换
const replaced = searchEngine.replaceInContent(content, 'old', 'new', options);

// 模糊匹配
const { match, score, indices } = searchEngine.fuzzyMatch('query', 'filename.ts');
```

### CodeNavigation - 代码导航

```typescript
import { codeNavigation } from '@services/codeNavigation';

// 跳转到定义
const location = await codeNavigation.goToDefinition(file, position);

// 查找引用
const refs = await codeNavigation.findReferences(file, position);

// 重命名
const edits = await codeNavigation.renameSymbol(file, position, 'newName');

// 导航历史
codeNavigation.goBack();
codeNavigation.goForward();
```

### CacheManager - 缓存管理

```typescript
import { CacheManager } from '@services/cacheManager';

const cache = new CacheManager({ maxSize: 100, defaultTTL: 60000 });

cache.set('key', 'value', ttl?)    // 设置缓存
cache.get('key')                    // 获取缓存
cache.getOrSet('key', () => value)  // 获取或设置
cache.getOrSetAsync('key', asyncFn) // 异步获取或设置
cache.delete('key')                 // 删除
cache.clear()                       // 清空
cache.getStats()                    // 获取统计
```

### EventBus - 事件总线

```typescript
import { eventBus } from '@services/eventBus';

eventBus.on('file:open', handler)     // 订阅
eventBus.once('event', handler)       // 单次订阅
eventBus.emit('file:open', { path })  // 发布
eventBus.off('event', handler)        // 取消订阅
```

### StateSync - 多窗口同步

```typescript
import { stateSync, sync } from '@services/stateSync';

stateSync.broadcast('type', payload)   // 广播消息
stateSync.on('type', handler)          // 监听消息

// 便捷方法
sync.fileOpened(path);
sync.fileSaved(path);
sync.settingsChanged(key, value);
```

### AutoSave - 自动保存

```typescript
import { autoSave } from '@services/autoSave';

autoSave.init(saveHandler)    // 初始化
autoSave.markDirty(path, content)  // 标记脏文件
autoSave.markClean(path)      // 标记已保存
autoSave.saveAll()            // 保存全部
autoSave.hasDirtyFiles()      // 检查未保存
autoSave.getDraft(path)       // 获取草稿
```

### ShortcutManager - 快捷键管理

```typescript
import { shortcutManager } from '@services/shortcutManager';

// 注册快捷键
shortcutManager.register({
  id: 'my.command',
  keys: 'Ctrl+Shift+X',
  description: '我的命令',
  category: '自定义',
  handler: () => { ... }
});

// 自定义绑定
shortcutManager.setBinding('my.command', 'Ctrl+Alt+Y');
shortcutManager.resetBinding('my.command');

// 格式化显示
shortcutManager.formatKeys('Ctrl+Shift+P')  // ⌃ ⇧ P
```

---

## React Hooks

### useLocalStorage / useSessionStorage

```typescript
const [value, setValue] = useLocalStorage('key', defaultValue);
const [session, setSession] = useSessionStorage('key', defaultValue);
```

### useDebounce / useThrottle

```typescript
const debouncedValue = useDebounce(value, 300);
const throttledValue = useThrottle(value, 100);
```

### useAsync

```typescript
const { data, loading, error, execute } = useAsync(asyncFn);
```

### usePerformanceMetrics

```typescript
const { fps, memory } = usePerformanceMetrics();
```

### useNotifications

```typescript
const { show, dismiss, notifications, unreadCount } = useNotifications();
show({ type: 'success', title: '成功', message: '操作完成' });
```

---

## 组件 API

### StatusBar

```tsx
<StatusBar
  language="TypeScript"
  encoding="UTF-8"
  lineEnding="LF"
  cursorPosition={{ line: 10, column: 5 }}
  gitBranch="main"
  gitStatus={{ changed: 3, staged: 1 }}
  problems={{ errors: 2, warnings: 5 }}
  items={customItems}
/>
```

### BreadcrumbNav

```tsx
<BreadcrumbNav
  items={[
    { id: '1', label: 'src', onClick: () => {} },
    { id: '2', label: 'components', children: [...] }
  ]}
  separator="/"
  maxItems={5}
/>
```

### NotificationProvider

```tsx
<NotificationProvider maxNotifications={50}>
  <App />
  <NotificationContainer />
</NotificationProvider>
```

### VirtualList

```tsx
<VirtualList
  items={largeArray}
  itemHeight={24}
  renderItem={(item, index) => <Row key={index}>{item}</Row>}
  overscan={5}
/>
```

---

## IPC API (Electron)

### 文件系统

```typescript
await window.mindcode.fs.readFile(path)
await window.mindcode.fs.writeFile(path, content)
await window.mindcode.fs.exists(path)
await window.mindcode.fs.stat(path)
await window.mindcode.fs.listDir(path)
```

### Git

```typescript
await window.mindcode.git.status()
await window.mindcode.git.diff(file?)
await window.mindcode.git.commit(message)
await window.mindcode.git.push()
await window.mindcode.git.pull()
```

### AI

```typescript
await window.mindcode.ai.complete(prompt, options)
await window.mindcode.ai.chat(messages, options)
await window.mindcode.ai.stream(messages, onChunk)
```
