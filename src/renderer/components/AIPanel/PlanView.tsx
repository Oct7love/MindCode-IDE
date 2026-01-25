import React, { useState } from 'react';
import { useAIStore, Plan } from '../../stores';
import './PlanView.css';

export const PlanView: React.FC = () => {
  const { currentPlan, setPlan, updatePlanTask, setMode, model } = useAIStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePlan = async () => { // AI 生成计划
    setIsGenerating(true);
    const prompt = '你是一个软件架构师。为当前任务生成一个详细的开发计划，包含目标、假设、里程碑、任务和风险。以 JSON 格式返回: { title, goal, assumptions: [], milestones: [{id, label, estimated}], tasks: [{id, label}], risks: [] }';
    if (window.mindcode?.ai?.chat) {
      try {
        const res = await window.mindcode.ai.chat(model, [{ role: 'user', content: prompt }]);
        const jsonMatch = res.data?.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const plan: Plan = { id: Date.now().toString(), ...parsed, status: 'draft', version: 1, milestones: parsed.milestones?.map((m: any, i: number) => ({ ...m, id: m.id || `m${i}`, completed: false })) || [], tasks: parsed.tasks?.map((t: any, i: number) => ({ ...t, id: t.id || `t${i}`, completed: false })) || [] };
          setPlan(plan);
        }
      } catch (e) { console.error('Plan generation error:', e); }
    }
    setIsGenerating(false);
  };

  const plan = currentPlan;

  if (!plan) {
    return (
      <div className="ai-empty-state">
        <div className="ai-empty-state-icon">
          <svg viewBox="0 0 48 48" fill="currentColor"><path d="M24 4L6 16v16l18 12 18-12V16L24 4zm0 3.5L38.5 18v12L24 35.5 9.5 30V18L24 7.5z"/></svg>
        </div>
        <div className="ai-empty-state-text">{isGenerating ? '正在生成计划...' : '还没有创建计划'}</div>
        <button className="ai-plan-btn primary" onClick={generatePlan} disabled={isGenerating}>{isGenerating ? '生成中...' : '生成计划'}</button>
      </div>
    );
  }
  const isLocked = plan.status === 'locked' || plan.status === 'executing';

  return (
    <div className="ai-plan-view">
      <div className="ai-plan-card">
        <div className="ai-plan-header">
          <div className="ai-plan-title">Plan: {plan.title}</div>
          <div className="ai-plan-version">
            <button className={`ai-plan-version-btn ${plan.version === 1 ? 'active' : ''}`}>
              v1
            </button>
            <button className={`ai-plan-version-btn ${plan.version === 2 ? 'active' : ''}`}>
              v2
            </button>
          </div>
        </div>

        <div className="ai-plan-section">
          <div className="ai-plan-section-title">🎯 Goal</div>
          <div className="ai-plan-section-content">{plan.goal}</div>
        </div>

        <div className="ai-plan-section">
          <div className="ai-plan-section-title">📋 Assumptions</div>
          <div className="ai-plan-section-content">
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {plan.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="ai-plan-section">
          <div className="ai-plan-section-title">📍 Milestones</div>
          <div className="ai-plan-section-content">
            {plan.milestones.map(m => (
              <div key={m.id} className="ai-plan-task">
                <input type="checkbox" className="ai-plan-task-checkbox" checked={m.completed} disabled={!isEditing} onChange={() => setPlan({ ...plan, milestones: plan.milestones.map(ms => ms.id === m.id ? { ...ms, completed: !ms.completed } : ms) })} />
                <span>{m.label} ({m.estimated})</span>
              </div>
            ))}
          </div>
        </div>

        <div className="ai-plan-section">
          <div className="ai-plan-section-title">✅ Tasks</div>
          <div className="ai-plan-section-content">
            {plan.tasks.map(t => (
              <div key={t.id} className="ai-plan-task">
                <input type="checkbox" className="ai-plan-task-checkbox" checked={t.completed} disabled={isLocked && !isEditing} onChange={() => updatePlanTask(t.id, !t.completed)} />
                <span>{t.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="ai-plan-section">
          <div className="ai-plan-section-title">⚠️ Risks</div>
          <div className="ai-plan-section-content">
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {plan.risks.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="ai-plan-actions">
          <button className="ai-plan-btn" onClick={() => setIsEditing(!isEditing)} disabled={isLocked}>{isEditing ? '保存' : '编辑'}</button>
          <button className="ai-plan-btn" onClick={() => setPlan({ ...plan, status: isLocked ? 'draft' : 'locked' })}>{isLocked ? '解锁' : '锁定'}</button>
          <button className="ai-plan-btn primary" onClick={() => { setPlan({ ...plan, status: 'executing' }); setMode('agent'); }} disabled={!isLocked || plan.status === 'executing'}>执行</button>
        </div>
      </div>
    </div>
  );
};
