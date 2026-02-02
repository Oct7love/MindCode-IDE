/**
 * Copy 功能测试用例
 * 
 * 覆盖场景：
 * - 消息级复制
 * - 代码块复制
 * - 格式转换
 * - 边界情况
 */

import { 
  copyToClipboard,
  serializeToPlainText,
  serializeToMarkdown,
  extractCodeBlocks,
  parseMarkdownContent
} from '../utils/copyService';

// ============================================
// 测试数据
// ============================================

const SAMPLE_MARKDOWN = `
# 标题

这是一个段落，包含**粗体**和*斜体*文本。

## 列表示例

- 项目 1
- 项目 2
- 项目 3

## 代码示例

\`\`\`python
def hello():
    print("Hello, World!")
    return True
\`\`\`

\`\`\`javascript
const greet = () => {
  console.log("Hello!");
};
\`\`\`

## 引用

> 这是一段引用文字
> 可以有多行

## 链接

[点击这里](https://example.com)

---

这是文档末尾。
`;

const LONG_CODE = Array(100).fill(0).map((_, i) => `// Line ${i + 1}`).join('\n');

const EDGE_CASES = {
  empty: '',
  onlySpaces: '   \n\n   ',
  singleChar: 'x',
  unicodeEmoji: '你好 👋 世界 🌍',
  specialChars: '<script>alert("xss")</script>',
  nestedLists: `
- Level 1
  - Level 2
    - Level 3
- Back to Level 1
`,
  mixedContent: `
Normal paragraph.

\`\`\`
Code without language
\`\`\`

> Quote with \`inline code\`

**Bold with [link](url)**
`,
};

// ============================================
// 测试用例
// ============================================

describe('copyService', () => {
  
  describe('parseMarkdownContent', () => {
    
    it('should parse headings correctly', () => {
      const content = '# Heading 1\n## Heading 2';
      const blocks = parseMarkdownContent(content);
      
      expect(blocks).toContainEqual({
        type: 'heading',
        content: 'Heading 1',
        level: 1
      });
      expect(blocks).toContainEqual({
        type: 'heading',
        content: 'Heading 2',
        level: 2
      });
    });

    it('should parse code blocks with language', () => {
      const content = '```python\nprint("hello")\n```';
      const blocks = parseMarkdownContent(content);
      
      expect(blocks).toContainEqual({
        type: 'code',
        content: 'print("hello")',
        language: 'python'
      });
    });

    it('should parse code blocks without language', () => {
      const content = '```\nsome code\n```';
      const blocks = parseMarkdownContent(content);
      
      expect(blocks[0]).toMatchObject({
        type: 'code',
        language: 'text'
      });
    });

    it('should parse lists', () => {
      const content = '- Item 1\n- Item 2\n- Item 3';
      const blocks = parseMarkdownContent(content);
      
      expect(blocks[0]).toMatchObject({
        type: 'list',
        ordered: false,
        items: ['Item 1', 'Item 2', 'Item 3']
      });
    });

    it('should parse ordered lists', () => {
      const content = '1. First\n2. Second\n3. Third';
      const blocks = parseMarkdownContent(content);
      
      expect(blocks[0]).toMatchObject({
        type: 'list',
        ordered: true,
        items: ['First', 'Second', 'Third']
      });
    });

    it('should parse blockquotes', () => {
      const content = '> Quote line 1\n> Quote line 2';
      const blocks = parseMarkdownContent(content);
      
      expect(blocks[0]).toMatchObject({
        type: 'blockquote'
      });
    });

    it('should handle empty content', () => {
      const blocks = parseMarkdownContent('');
      expect(blocks).toEqual([]);
    });

  });

  describe('serializeToPlainText', () => {

    it('should convert heading to plain text', () => {
      const result = serializeToPlainText('# Hello World');
      expect(result).toBe('Hello World');
    });

    it('should preserve list structure', () => {
      const result = serializeToPlainText('- Item 1\n- Item 2');
      expect(result).toContain('- Item 1');
      expect(result).toContain('- Item 2');
    });

    it('should strip markdown formatting', () => {
      const result = serializeToPlainText('**bold** and *italic*');
      expect(result).toBe('bold and italic');
    });

    it('should convert links to text (URL) format', () => {
      const result = serializeToPlainText('[Google](https://google.com)');
      expect(result).toContain('Google');
      expect(result).toContain('https://google.com');
    });

    it('should preserve code without fences', () => {
      const result = serializeToPlainText('```js\nconsole.log("hi")\n```');
      expect(result).toContain('console.log("hi")');
      expect(result).not.toContain('```');
    });

    it('should handle unicode and emoji', () => {
      const result = serializeToPlainText(EDGE_CASES.unicodeEmoji);
      expect(result).toContain('你好');
      expect(result).toContain('👋');
    });

  });

  describe('serializeToMarkdown', () => {

    it('should preserve heading syntax', () => {
      const result = serializeToMarkdown('## Heading');
      expect(result).toBe('## Heading');
    });

    it('should preserve code block with language', () => {
      const result = serializeToMarkdown('```python\ncode\n```');
      expect(result).toContain('```python');
      expect(result).toContain('```');
    });

    it('should normalize list format', () => {
      const result = serializeToMarkdown('* Item 1\n* Item 2');
      // Should convert * to - (normalized)
      expect(result).toMatch(/^- Item 1/m);
    });

    it('should preserve blockquotes', () => {
      const result = serializeToMarkdown('> Quote');
      expect(result).toContain('> Quote');
    });

  });

  describe('extractCodeBlocks', () => {

    it('should extract all code blocks', () => {
      const blocks = extractCodeBlocks(SAMPLE_MARKDOWN);
      
      expect(blocks.length).toBe(2);
      expect(blocks[0].language).toBe('python');
      expect(blocks[1].language).toBe('javascript');
    });

    it('should return empty array when no code blocks', () => {
      const blocks = extractCodeBlocks('Just text, no code.');
      expect(blocks).toEqual([]);
    });

    it('should handle code block without language', () => {
      const blocks = extractCodeBlocks('```\ncode\n```');
      expect(blocks[0].language).toBe('text');
    });

  });

  describe('copyToClipboard', () => {

    // Note: These tests require mocking navigator.clipboard

    beforeEach(() => {
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockResolvedValue(undefined)
        }
      });
    });

    it('should copy text successfully', async () => {
      const result = await copyToClipboard('Test text');
      expect(result.success).toBe(true);
    });

    it('should handle clipboard API failure', async () => {
      (navigator.clipboard.writeText as jest.Mock).mockRejectedValue(new Error('Permission denied'));
      
      // Should fall back to execCommand
      document.execCommand = jest.fn().mockReturnValue(true);
      
      const result = await copyToClipboard('Test text');
      expect(result.success).toBe(true);
    });

    it('should handle empty string', async () => {
      const result = await copyToClipboard('');
      expect(result.success).toBe(true);
    });

    it('should handle very long text', async () => {
      const longText = 'a'.repeat(100000);
      const result = await copyToClipboard(longText);
      expect(result.success).toBe(true);
    });

  });

});

// ============================================
// 边界情况清单
// ============================================

/**
 * 边界情况清单 (手动测试)
 * 
 * 1. 超长消息
 *    - 包含 >10000 字符的消息
 *    - 包含 >100 个代码块的消息
 *    - 单个代码块 >1000 行
 *    ✅ 预期: 复制成功，性能无明显卡顿
 * 
 * 2. 多个代码块
 *    - 混合多种语言的代码块
 *    - 连续多个代码块无间隔
 *    - 代码块内有嵌套的 ``` 字符
 *    ✅ 预期: 每个代码块独立复制正确
 * 
 * 3. 复制失败场景
 *    - navigator.clipboard 不可用 (HTTP)
 *    - 用户拒绝剪贴板权限
 *    - 内存不足 (极端情况)
 *    ✅ 预期: 降级到 execCommand 或显示错误提示
 * 
 * 4. 用户选中文字
 *    - 选中部分消息文本后按 Ctrl+C
 *    - 选中跨消息的文本
 *    - 选中代码块内部分代码
 *    ✅ 预期: 使用浏览器默认行为，不劫持
 * 
 * 5. 平台差异
 *    - macOS: Cmd+C
 *    - Windows: Ctrl+C
 *    - Linux: Ctrl+C
 *    - 移动端: 长按显示菜单
 *    ✅ 预期: 各平台快捷键正确响应
 * 
 * 6. 主题对比度
 *    - 暗色主题下按钮可见性
 *    - 亮色主题下按钮可见性
 *    - 高对比度模式
 *    ✅ 预期: 所有主题下按钮清晰可见
 * 
 * 7. 特殊内容
 *    - 包含 HTML 标签的文本
 *    - 包含 emoji 和 unicode
 *    - 包含 RTL 文字 (阿拉伯语等)
 *    - 包含数学公式 (LaTeX)
 *    ✅ 预期: 内容正确复制，不丢失字符
 * 
 * 8. 并发操作
 *    - 快速连续点击 Copy 按钮
 *    - 同时复制多个消息
 *    - 复制过程中切换页面
 *    ✅ 预期: 最后一次操作生效，无 race condition
 * 
 * 9. 流式输出
 *    - AI 正在输出时尝试复制
 *    - 输出刚完成时复制
 *    ✅ 预期: 流式输出时禁用复制，完成后立即可用
 * 
 * 10. 键盘导航
 *     - Tab 键导航到 Copy 按钮
 *     - Enter/Space 触发复制
 *     - Escape 关闭菜单
 *     - 方向键在菜单中导航
 *     ✅ 预期: 完整的键盘可访问性
 */

export {};
