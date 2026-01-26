import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useAIStore, Plan } from '../../stores';
import { ModelPicker } from './ModelPicker';
import { MarkdownRenderer } from '../MarkdownRenderer';
import './PlanView.css';

interface PlanMessage { id: string; role: 'user' | 'assistant'; content: string; plan?: Plan; timestamp: number; }

export const PlanView: React.FC = memo(() => {
  const { currentPlan, setPlan, setMode, model, setModel } = useAIStore();
  const [messages, setMessages] = useState<PlanMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingText]);
  useEffect(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'; } }, [input]);

  const parsePlan = useCallback((text: string): Plan | null => {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*"title"[\s\S]*"tasks"[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
      const json = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(json);
      return {
        id: Date.now().toString(), title: parsed.title || '开发计划', goal: parsed.goal || '', status: 'draft', version: 1,
        assumptions: parsed.assumptions || [], risks: parsed.risks || [],
        milestones: (parsed.milestones || []).map((m: any, i: number) => ({ id: m.id || `m${i}`, label: m.label || m, estimated: m.estimated || '', completed: false })),
        tasks: (parsed.tasks || []).map((t: any, i: number) => ({ id: t.id || `t${i}`, label: t.label || t, completed: false }))
      };
    } catch { return null; }
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isGenerating) return;
    const userMsg: PlanMessage = { id: `msg-${Date.now()}`, role: 'user', content: input.trim(), timestamp: Date.now() };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setIsGenerating(true);
    setStreamingText('');

    const systemPrompt = `你是一个专业的软件架构师和项目规划专家。你的任务是帮助用户制定清晰、可执行的开发计划。

【输出格式】
当用户描述需求后，请以 Markdown 格式回复，包含：
1. 对需求的理解和分析
2. 一个 JSON 格式的计划（用代码块包裹）

JSON 计划结构：
\`\`\`json
{
  "title": "计划标题",
  "goal": "目标描述",
  "assumptions": ["假设1", "假设2"],
  "milestones": [{"id": "m1", "label": "里程碑1", "estimated": "1天"}],
  "tasks": [{"id": "t1", "label": "任务1"}, {"id": "t2", "label": "任务2"}],
  "risks": ["风险1", "风险2"]
}
\`\`\`

【注意事项】
- 任务要具体可执行
- 里程碑要有明确的交付物
- 考虑技术风险和依赖关系`;

    const chatHistory = messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    const apiMessages = [{ role: 'system' as const, content: systemPrompt }, ...chatHistory, { role: 'user' as const, content: userMsg.content }];

    let fullText = '';
    if (window.mindcode?.ai?.chatStream) {
      await new Promise<void>((resolve) => {
        window.mindcode.ai.chatStream(model, apiMessages, {
          onToken: (token: string) => { fullText += token; setStreamingText(prev => prev + token); },
          onComplete: () => resolve(),
          onError: (err: string) => { fullText = `错误: ${err}`; resolve(); }
        });
      });
    } else { fullText = '[开发模式] 请在 Electron 中运行'; }

    const plan = parsePlan(fullText);
    const assistantMsg: PlanMessage = { id: `msg-${Date.now()}`, role: 'assistant', content: fullText, plan: plan || undefined, timestamp: Date.now() };
    setMessages(m => [...m, assistantMsg]);
    if (plan) setPlan(plan);
    setStreamingText('');
    setIsGenerating(false);
  }, [input, isGenerating, model, messages, parsePlan, setPlan]);

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  const toggleTask = useCallback((taskId: string) => { if (currentPlan) setPlan({ ...currentPlan, tasks: currentPlan.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t) }); }, [currentPlan, setPlan]);
  const toggleMilestone = useCallback((mId: string) => { if (currentPlan) setPlan({ ...currentPlan, milestones: currentPlan.milestones.map(m => m.id === mId ? { ...m, completed: !m.completed } : m) }); }, [currentPlan, setPlan]);
  const executeInAgent = useCallback(() => { if (currentPlan) { setPlan({ ...currentPlan, status: 'executing' }); setMode('agent'); } }, [currentPlan, setPlan, setMode]);
  const clearChat = useCallback(() => { setMessages([]); setStreamingText(''); setPlan(null); }, [setPlan]);

  const completedTasks = currentPlan?.tasks.filter(t => t.completed).length || 0;
  const totalTasks = currentPlan?.tasks.length || 0;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="ai-plan-view">
      <div className="ai-plan-messages">
        {messages.length === 0 && !streamingText && (
          <div className="ai-empty-state">
            <div className="ai-empty-icon">📋</div>
            <div className="ai-empty-title">Plan 模式</div>
            <div className="ai-empty-desc">描述你的需求，我会帮你制定详细的开发计划<br/>计划确认后可以一键切换到 Agent 执行</div>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`ai-plan-msg ai-plan-msg-${msg.role}`}>
            <div className="ai-plan-msg-avatar">{msg.role === 'user' ? '👤' : '📋'}</div>
            <div className="ai-plan-msg-body">
              <div className="ai-plan-msg-content"><MarkdownRenderer content={msg.content} /></div>
            </div>
          </div>
        ))}
        {streamingText && (
          <div className="ai-plan-msg ai-plan-msg-assistant">
            <div className="ai-plan-msg-avatar">📋</div>
            <div className="ai-plan-msg-body"><div className="ai-plan-msg-content"><MarkdownRenderer content={streamingText} /></div></div>
          </div>
        )}
        {isGenerating && !streamingText && <div className="ai-plan-loading"><span /><span /><span /></div>}
        <div ref={messagesEndRef} />
      </div>

      {currentPlan && (
        <div className="ai-plan-card">
          <div className="ai-plan-card-header">
            <div className="ai-plan-card-title">{currentPlan.title}</div>
            <div className="ai-plan-card-status">{currentPlan.status === 'executing' ? '执行中' : currentPlan.status === 'locked' ? '已锁定' : '草稿'}</div>
          </div>
          {currentPlan.goal && <div className="ai-plan-card-goal">{currentPlan.goal}</div>}
          <div className="ai-plan-card-progress">
            <div className="ai-plan-card-progress-bar"><div className="ai-plan-card-progress-fill" style={{ width: `${progress}%` }} /></div>
            <span className="ai-plan-card-progress-text">{completedTasks}/{totalTasks} 任务</span>
          </div>
          <div className="ai-plan-card-tasks">
            {currentPlan.tasks.slice(0, 5).map(t => (
              <div key={t.id} className={`ai-plan-card-task ${t.completed ? 'completed' : ''}`} onClick={() => toggleTask(t.id)}>
                <span className="ai-plan-card-task-check">{t.completed ? '✓' : '○'}</span>
                <span className="ai-plan-card-task-label">{t.label}</span>
              </div>
            ))}
            {currentPlan.tasks.length > 5 && <div className="ai-plan-card-more">+{currentPlan.tasks.length - 5} 更多任务</div>}
          </div>
          <div className="ai-plan-card-actions">
            <button className="ai-plan-card-btn" onClick={() => setPlan({ ...currentPlan, status: currentPlan.status === 'locked' ? 'draft' : 'locked' })}>{currentPlan.status === 'locked' ? '解锁' : '锁定'}</button>
            <button className="ai-plan-card-btn primary" onClick={executeInAgent} disabled={currentPlan.status === 'executing'}>在 Agent 中执行</button>
          </div>
        </div>
      )}

      <div className="ai-plan-composer">
        <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="描述你要开发的功能... (Enter 发送)" disabled={isGenerating} rows={1} />
        <div className="ai-plan-composer-footer">
          <div className="ai-plan-composer-left">
            <ModelPicker model={model} onModelChange={setModel} disabled={isGenerating} />
            {messages.length > 0 && <button className="ai-plan-clear-btn" onClick={clearChat} disabled={isGenerating}>清空</button>}
          </div>
          <button className="ai-plan-send-btn" onClick={handleSend} disabled={!input.trim() || isGenerating}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M1.17 2.32L14.5 8l-13.33 5.68.17-4.18L8.5 8l-7.16-1.5-.17-4.18z"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
});
