/**
 * PromptLibrary - Prompt 模板库
 * 预设提示词、快速插入
 */

import React, { useState, useMemo, useCallback } from 'react';

export interface PromptTemplate { id: string; name: string; prompt: string; category: string; icon: string; variables?: string[]; }

const DEFAULT_PROMPTS: PromptTemplate[] = [
  // 代码生成
  { id: 'gen-function', name: '生成函数', prompt: '请帮我实现一个 {{language}} 函数：\n\n功能：{{description}}\n输入：{{input}}\n输出：{{output}}', category: '代码生成', icon: '⚡', variables: ['language', 'description', 'input', 'output'] },
  { id: 'gen-class', name: '生成类', prompt: '请用 {{language}} 创建一个类：\n\n类名：{{className}}\n功能：{{description}}\n属性：{{properties}}\n方法：{{methods}}', category: '代码生成', icon: '🔷', variables: ['language', 'className', 'description', 'properties', 'methods'] },
  { id: 'gen-api', name: '生成 API', prompt: '请生成一个 RESTful API 端点：\n\n路径：{{path}}\n方法：{{method}}\n功能：{{description}}\n请求体：{{requestBody}}\n响应：{{response}}', category: '代码生成', icon: '🌐', variables: ['path', 'method', 'description', 'requestBody', 'response'] },
  // 代码解释
  { id: 'explain-code', name: '解释代码', prompt: '请解释以下代码的功能和实现原理：\n\n```\n{{code}}\n```', category: '代码解释', icon: '📖', variables: ['code'] },
  { id: 'explain-error', name: '解释错误', prompt: '请帮我分析这个错误并提供解决方案：\n\n错误信息：\n{{error}}\n\n相关代码：\n```\n{{code}}\n```', category: '代码解释', icon: '🐛', variables: ['error', 'code'] },
  { id: 'explain-concept', name: '解释概念', prompt: '请用简单的语言解释 {{concept}} 这个编程概念，并提供示例代码。', category: '代码解释', icon: '💡', variables: ['concept'] },
  // 代码优化
  { id: 'optimize-perf', name: '性能优化', prompt: '请分析以下代码的性能问题并提供优化建议：\n\n```{{language}}\n{{code}}\n```', category: '代码优化', icon: '🚀', variables: ['language', 'code'] },
  { id: 'optimize-refactor', name: '重构建议', prompt: '请帮我重构以下代码，使其更简洁、可读、可维护：\n\n```{{language}}\n{{code}}\n```', category: '代码优化', icon: '🔧', variables: ['language', 'code'] },
  { id: 'optimize-security', name: '安全审查', prompt: '请检查以下代码的安全问题并提供修复建议：\n\n```{{language}}\n{{code}}\n```', category: '代码优化', icon: '🔒', variables: ['language', 'code'] },
  // 测试
  { id: 'test-unit', name: '单元测试', prompt: '请为以下代码生成完整的单元测试：\n\n```{{language}}\n{{code}}\n```\n\n使用测试框架：{{framework}}', category: '测试', icon: '🧪', variables: ['language', 'code', 'framework'] },
  { id: 'test-e2e', name: 'E2E 测试', prompt: '请为以下功能生成 E2E 测试用例：\n\n功能描述：{{description}}\n测试场景：{{scenarios}}', category: '测试', icon: '🎯', variables: ['description', 'scenarios'] },
  // 文档
  { id: 'doc-readme', name: 'README', prompt: '请为以下项目生成 README.md：\n\n项目名：{{projectName}}\n描述：{{description}}\n技术栈：{{techStack}}\n功能：{{features}}', category: '文档', icon: '📄', variables: ['projectName', 'description', 'techStack', 'features'] },
  { id: 'doc-api', name: 'API 文档', prompt: '请为以下代码生成 API 文档（JSDoc/TSDoc 格式）：\n\n```{{language}}\n{{code}}\n```', category: '文档', icon: '📝', variables: ['language', 'code'] },
  // 转换
  { id: 'convert-lang', name: '语言转换', prompt: '请将以下 {{fromLang}} 代码转换为 {{toLang}}：\n\n```{{fromLang}}\n{{code}}\n```', category: '转换', icon: '🔄', variables: ['fromLang', 'toLang', 'code'] },
  { id: 'convert-style', name: '代码风格', prompt: '请将以下代码转换为 {{style}} 风格：\n\n```\n{{code}}\n```', category: '转换', icon: '🎨', variables: ['style', 'code'] },
];

interface PromptLibraryProps { isOpen: boolean; onClose: () => void; onSelect: (prompt: string) => void; }

export const PromptLibrary: React.FC<PromptLibraryProps> = ({ isOpen, onClose, onSelect }) => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<PromptTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});

  // 过滤
  const filtered = useMemo(() => {
    if (!search) return DEFAULT_PROMPTS;
    const lower = search.toLowerCase();
    return DEFAULT_PROMPTS.filter(p => p.name.toLowerCase().includes(lower) || p.category.toLowerCase().includes(lower));
  }, [search]);

  // 分类
  const categories = useMemo(() => [...new Set(filtered.map(p => p.category))], [filtered]);

  // 选择模板
  const handleSelect = useCallback((template: PromptTemplate) => {
    setSelected(template);
    setVariables({});
  }, []);

  // 生成最终 prompt
  const generatePrompt = useCallback(() => {
    if (!selected) return;
    let prompt = selected.prompt;
    for (const [key, value] of Object.entries(variables)) {
      prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `[${key}]`);
    }
    onSelect(prompt);
    onClose();
  }, [selected, variables, onSelect, onClose]);

  // 快速插入（无变量）
  const quickInsert = useCallback((template: PromptTemplate) => {
    if (!template.variables?.length) {
      onSelect(template.prompt);
      onClose();
    } else {
      handleSelect(template);
    }
  }, [onSelect, onClose, handleSelect]);

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ width: '70vw', maxWidth: 800, height: '65vh', background: 'var(--color-bg-elevated)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>📚 Prompt 模板库</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {/* 搜索 */}
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索模板..." autoFocus style={{ width: '100%', padding: '8px 12px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 13, color: 'inherit' }} />
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* 模板列表 */}
          <div style={{ width: 280, borderRight: '1px solid var(--color-border)', overflow: 'auto' }}>
            {categories.map(category => (
              <div key={category}>
                <div style={{ padding: '6px 12px', background: 'var(--color-bg-base)', fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500 }}>{category}</div>
                {filtered.filter(p => p.category === category).map(template => (
                  <div key={template.id} onClick={() => quickInsert(template)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer', background: selected?.id === template.id ? 'var(--color-bg-hover)' : 'transparent', borderBottom: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: 16 }}>{template.icon}</span>
                    <span style={{ flex: 1, fontSize: 12 }}>{template.name}</span>
                    {template.variables?.length && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>⚙️</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* 变量填写 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {selected ? (
              <>
                <div style={{ padding: 16, borderBottom: '1px solid var(--color-border)' }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>{selected.icon} {selected.name}</h3>
                  {selected.variables?.map(v => (
                    <div key={v} style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>{v}</label>
                      <input type="text" value={variables[v] || ''} onChange={e => setVariables({ ...variables, [v]: e.target.value })} placeholder={`输入 ${v}...`} style={{ width: '100%', padding: '6px 8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 12, color: 'inherit' }} />
                    </div>
                  ))}
                  <button onClick={generatePrompt} style={{ marginTop: 8, padding: '8px 16px', background: 'var(--color-accent-primary)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, width: '100%' }}>使用此模板</button>
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                  <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>预览</label>
                  <pre style={{ margin: 0, padding: 12, background: 'var(--color-bg-base)', borderRadius: 6, fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {selected.prompt.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || `[${key}]`)}
                  </pre>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>选择模板或直接点击快速插入</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptLibrary;
