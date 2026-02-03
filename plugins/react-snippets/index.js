/**
 * React Snippets 扩展
 * 提供 React/JSX 代码片段
 */

// 代码片段定义
const SNIPPETS = {
  'rfc': { prefix: 'rfc', body: 'export const ${1:Component} = () => {\n  return (\n    <div>\n      ${2:content}\n    </div>\n  );\n};', description: 'React Function Component' },
  'rfce': { prefix: 'rfce', body: 'const ${1:Component} = () => {\n  return (\n    <div>\n      ${2:content}\n    </div>\n  );\n};\n\nexport default ${1:Component};', description: 'React Function Component Export Default' },
  'useState': { prefix: 'us', body: 'const [${1:state}, set${1/(.*)/${1:/capitalize}/}] = useState(${2:initialValue});', description: 'useState Hook' },
  'useEffect': { prefix: 'ue', body: 'useEffect(() => {\n  ${1:effect}\n  return () => {\n    ${2:cleanup}\n  };\n}, [${3:deps}]);', description: 'useEffect Hook' },
  'useCallback': { prefix: 'ucb', body: 'const ${1:memoizedCallback} = useCallback(() => {\n  ${2:callback}\n}, [${3:deps}]);', description: 'useCallback Hook' },
  'useMemo': { prefix: 'um', body: 'const ${1:memoizedValue} = useMemo(() => {\n  return ${2:computeValue};\n}, [${3:deps}]);', description: 'useMemo Hook' },
  'useRef': { prefix: 'ur', body: 'const ${1:ref} = useRef(${2:null});', description: 'useRef Hook' },
  'useContext': { prefix: 'uctx', body: 'const ${1:value} = useContext(${2:Context});', description: 'useContext Hook' },
  'props': { prefix: 'props', body: 'interface ${1:Component}Props {\n  ${2:prop}: ${3:type};\n}', description: 'TypeScript Props Interface' },
};

// 扩展激活
function activate(api) {
  console.log('[ReactSnippets] 扩展已激活');

  // 注册插入组件命令
  api.commands.registerCommand('reactSnippets.insertComponent', async () => {
    const editor = api.editor.getActiveEditor();
    if (editor) {
      const template = SNIPPETS['rfc'].body.replace(/\$\{1:Component\}/g, 'MyComponent').replace(/\$\{2:content\}/g, 'Hello World');
      // TODO: 插入到编辑器
      api.editor.showMessage('React 组件模板已复制到剪贴板', 'info');
    }
  });

  // 注册插入 Hook 命令
  api.commands.registerCommand('reactSnippets.insertHook', async () => {
    api.editor.showMessage('请选择要插入的 Hook: useState, useEffect, useCallback, useMemo', 'info');
  });

  // 返回导出的片段供其他模块使用
  return { snippets: SNIPPETS };
}

// 扩展停用
function deactivate() {
  console.log('[ReactSnippets] 扩展已停用');
}

module.exports = { activate, deactivate };
