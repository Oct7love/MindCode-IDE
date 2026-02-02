/**
 * FileTemplates - 文件模板
 * 快速创建预定义模板文件
 */

import React, { useState, useCallback } from 'react';

export interface FileTemplate { id: string; name: string; extension: string; icon: string; content: string; category: string; }

const DEFAULT_TEMPLATES: FileTemplate[] = [
  // React
  { id: 'react-component', name: 'React 组件', extension: '.tsx', icon: '⚛️', category: 'React', content: `import React from 'react';\n\ninterface {{name}}Props {\n  // props\n}\n\nexport const {{name}}: React.FC<{{name}}Props> = (props) => {\n  return (\n    <div>\n      {{name}}\n    </div>\n  );\n};\n\nexport default {{name}};` },
  { id: 'react-hook', name: 'React Hook', extension: '.ts', icon: '🪝', category: 'React', content: `import { useState, useEffect, useCallback } from 'react';\n\nexport function use{{name}}() {\n  const [state, setState] = useState();\n\n  useEffect(() => {\n    // effect\n  }, []);\n\n  return { state };\n}` },
  // TypeScript
  { id: 'ts-interface', name: 'TypeScript 接口', extension: '.ts', icon: '📝', category: 'TypeScript', content: `export interface {{name}} {\n  id: string;\n  // add properties\n}` },
  { id: 'ts-class', name: 'TypeScript 类', extension: '.ts', icon: '🔷', category: 'TypeScript', content: `export class {{name}} {\n  constructor() {\n    // constructor\n  }\n\n  public method(): void {\n    // method\n  }\n}` },
  { id: 'ts-service', name: 'Service 服务', extension: '.ts', icon: '⚙️', category: 'TypeScript', content: `export class {{name}}Service {\n  private static instance: {{name}}Service;\n\n  private constructor() {}\n\n  public static getInstance(): {{name}}Service {\n    if (!{{name}}Service.instance) {\n      {{name}}Service.instance = new {{name}}Service();\n    }\n    return {{name}}Service.instance;\n  }\n\n  public async fetch(): Promise<void> {\n    // implementation\n  }\n}` },
  // Node.js
  { id: 'node-express', name: 'Express Router', extension: '.ts', icon: '🚀', category: 'Node.js', content: `import { Router, Request, Response } from 'express';\n\nconst router = Router();\n\nrouter.get('/', async (req: Request, res: Response) => {\n  res.json({ message: 'Hello' });\n});\n\nexport default router;` },
  // 测试
  { id: 'test-jest', name: 'Jest 测试', extension: '.test.ts', icon: '🧪', category: '测试', content: `describe('{{name}}', () => {\n  beforeEach(() => {\n    // setup\n  });\n\n  it('should work', () => {\n    expect(true).toBe(true);\n  });\n});` },
  // 其他
  { id: 'json-config', name: 'JSON 配置', extension: '.json', icon: '📋', category: '配置', content: `{\n  "name": "{{name}}",\n  "version": "1.0.0"\n}` },
  { id: 'markdown', name: 'Markdown 文档', extension: '.md', icon: '📄', category: '文档', content: `# {{name}}\n\n## 概述\n\n## 使用方法\n\n## API\n` },
];

interface FileTemplatesProps { isOpen: boolean; onClose: () => void; onCreateFile: (name: string, content: string) => void; }

export const FileTemplates: React.FC<FileTemplatesProps> = ({ isOpen, onClose, onCreateFile }) => {
  const [selected, setSelected] = useState<FileTemplate | null>(null);
  const [fileName, setFileName] = useState('');
  const [filter, setFilter] = useState('');

  // 创建文件
  const handleCreate = useCallback(() => {
    if (!selected || !fileName) return;
    const name = fileName.replace(/\.[^.]+$/, ''); // 移除扩展名
    const content = selected.content.replace(/\{\{name\}\}/g, name);
    const fullName = fileName.endsWith(selected.extension) ? fileName : `${fileName}${selected.extension}`;
    onCreateFile(fullName, content);
    onClose();
    setSelected(null);
    setFileName('');
  }, [selected, fileName, onCreateFile, onClose]);

  // 过滤模板
  const filtered = DEFAULT_TEMPLATES.filter(t => !filter || t.name.toLowerCase().includes(filter.toLowerCase()) || t.category.toLowerCase().includes(filter.toLowerCase()));

  // 按分类分组
  const categories = [...new Set(filtered.map(t => t.category))];

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ width: '60vw', maxWidth: 700, height: '60vh', background: 'var(--color-bg-elevated)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>📄 新建文件</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {/* 搜索 */}
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <input type="text" value={filter} onChange={e => setFilter(e.target.value)} placeholder="搜索模板..." style={{ width: '100%', padding: '8px 12px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 13, color: 'inherit' }} />
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* 模板列表 */}
          <div style={{ width: 280, borderRight: '1px solid var(--color-border)', overflow: 'auto' }}>
            {categories.map(category => (
              <div key={category}>
                <div style={{ padding: '6px 12px', background: 'var(--color-bg-base)', fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500 }}>{category}</div>
                {filtered.filter(t => t.category === category).map(template => (
                  <div key={template.id} onClick={() => { setSelected(template); setFileName(''); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer', background: selected?.id === template.id ? 'var(--color-bg-hover)' : 'transparent', borderBottom: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: 16 }}>{template.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{template.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{template.extension}</div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* 预览/创建 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {selected ? (
              <>
                <div style={{ padding: 16, borderBottom: '1px solid var(--color-border)' }}>
                  <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>文件名</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="text" value={fileName} onChange={e => setFileName(e.target.value)} placeholder={`例如: MyComponent`} autoFocus style={{ flex: 1, padding: '8px 12px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 13, color: 'inherit' }} onKeyDown={e => e.key === 'Enter' && handleCreate()} />
                    <button onClick={handleCreate} disabled={!fileName} style={{ padding: '8px 16px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, opacity: fileName ? 1 : 0.5 }}>创建</button>
                  </div>
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                  <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>模板预览</label>
                  <pre style={{ margin: 0, padding: 12, background: 'var(--color-bg-base)', borderRadius: 6, fontSize: 11, overflow: 'auto', maxHeight: 300 }}>{selected.content}</pre>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>选择模板开始创建</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileTemplates;
