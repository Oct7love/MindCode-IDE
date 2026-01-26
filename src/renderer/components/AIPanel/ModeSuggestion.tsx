// 模式切换智能提示组件
import React, { useState, useEffect, useMemo } from 'react';
import { useAIStore, AIMode } from '../../stores';

interface ModeSuggestionProps { input: string; onSwitch: (mode: AIMode) => void; }

const modeConfig: Record<AIMode, { icon: string; name: string; desc: string }> = {
  chat: { icon: '💬', name: 'Chat', desc: '对话问答' },
  plan: { icon: '📋', name: 'Plan', desc: '方案规划' },
  agent: { icon: '🤖', name: 'Agent', desc: '代码执行' },
  debug: { icon: '🐛', name: 'Debug', desc: '问题调试' },
};

const intentPatterns: { pattern: RegExp; mode: AIMode; hint: string }[] = [ // 意图检测模式
  { pattern: /(?:修改|改一下|改成|更新|添加|删除|重构|实现|创建|写一个|帮我写).*(?:代码|文件|函数|组件|模块|类)/i, mode: 'agent', hint: '检测到代码修改需求，Agent 可以自动执行' },
  { pattern: /(?:报错|错误|异常|bug|失败|不工作|崩溃|无法|出问题)/i, mode: 'debug', hint: '检测到错误信息，Debug 模式可以系统排查' },
  { pattern: /(?:规划|计划|设计|方案|架构|步骤|怎么做|如何实现).*(?:功能|系统|项目|模块)/i, mode: 'plan', hint: '检测到规划需求，Plan 模式可以制定方案' },
  { pattern: /(?:执行|运行|部署|安装|配置|命令)/i, mode: 'agent', hint: '检测到执行需求，Agent 可以运行命令' },
  { pattern: /(?:TypeError|SyntaxError|ReferenceError|Error:|Exception|Traceback|FAILED|npm ERR)/i, mode: 'debug', hint: '检测到错误日志，Debug 模式可以帮你分析' },
];

export const ModeSuggestion: React.FC<ModeSuggestionProps> = ({ input, onSwitch }) => {
  const { mode } = useAIStore();
  const [dismissed, setDismissed] = useState(false);

  const suggestion = useMemo(() => { // 检测建议的模式
    if (!input || input.length < 5) return null;
    for (const { pattern, mode: suggestedMode, hint } of intentPatterns) {
      if (pattern.test(input) && suggestedMode !== mode) return { mode: suggestedMode, hint };
    }
    return null;
  }, [input, mode]);

  useEffect(() => { setDismissed(false); }, [input]); // 输入变化时重置

  if (!suggestion || dismissed) return null;

  const config = modeConfig[suggestion.mode];

  return (
    <div className="ai-mode-suggestion">
      <div className="ai-mode-suggestion-content">
        <span className="ai-mode-suggestion-icon">{config.icon}</span>
        <span className="ai-mode-suggestion-text">{suggestion.hint}</span>
      </div>
      <div className="ai-mode-suggestion-actions">
        <button className="ai-mode-suggestion-btn" onClick={() => setDismissed(true)}>忽略</button>
        <button className="ai-mode-suggestion-btn primary" onClick={() => { onSwitch(suggestion.mode); setDismissed(true); }}>切换到 {config.name}</button>
      </div>
    </div>
  );
};

export default ModeSuggestion;
