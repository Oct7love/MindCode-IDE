import React, { useState, useEffect } from 'react';
import { useAIStore, AgentStep } from '../../stores';
import './AgentView.css';

interface FileChange { id: string; fileName: string; additions: number; deletions: number; isNew: boolean; content?: string; }

// Agent 工具定义
const agentTools = {
  readFile: { name: 'readFile', description: '读取文件内容', requiresConfirmation: false },
  writeFile: { name: 'writeFile', description: '写入文件内容', requiresConfirmation: true },
  runCommand: { name: 'runCommand', description: '执行终端命令', requiresConfirmation: true },
  searchSymbol: { name: 'searchSymbol', description: '搜索符号定义', requiresConfirmation: false },
};

export const AgentView: React.FC = () => {
  const { currentPlan, agentSteps, setAgentSteps, updateAgentStep, setPlan, setMode } = useAIStore();
  const [changes, setChanges] = useState<FileChange[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<{ step: AgentStep; action: () => Promise<void> } | null>(null);

  useEffect(() => { // 从 Plan 生成初始 Agent 步骤
    if (currentPlan && agentSteps.length === 0) {
      const steps: AgentStep[] = currentPlan.tasks.filter(t => !t.completed).map((t, i) => ({ id: t.id, label: t.label, status: 'queued' as const }));
      if (steps.length > 0) setAgentSteps(steps);
    }
  }, [currentPlan]);

  const executeStep = async (step: AgentStep) => { // 执行单个步骤
    updateAgentStep(step.id, 'running');
    try {
      await new Promise(r => setTimeout(r, 1000)); // 模拟执行
      // TODO: 实际执行工具调用 - 调用 window.mindcode.fs/terminal API
      updateAgentStep(step.id, 'succeeded');
      return true;
    } catch (e) {
      updateAgentStep(step.id, 'failed');
      return false;
    }
  };

  const executeAll = async () => { // 执行所有步骤
    setIsExecuting(true);
    for (const step of agentSteps) {
      if (step.status !== 'queued') continue;
      const success = await executeStep(step);
      if (!success) break;
    }
    setIsExecuting(false);
    if (agentSteps.every(s => s.status === 'succeeded') && currentPlan) setPlan({ ...currentPlan, status: 'completed' });
  };

  const cancelExecution = () => {
    setIsExecuting(false);
    agentSteps.filter(s => s.status === 'running' || s.status === 'queued').forEach(s => updateAgentStep(s.id, 'cancelled'));
  };

  const rollback = () => { // 回滚所有更改
    setChanges([]);
    setAgentSteps([]);
    if (currentPlan) setPlan({ ...currentPlan, status: 'locked' });
  };

  const applyChange = async (change: FileChange) => { // 应用单个文件更改
    if (window.mindcode?.fs?.writeFile && change.content) {
      await window.mindcode.fs.writeFile(change.fileName, change.content);
      setChanges(cs => cs.filter(c => c.id !== change.id));
    }
  };

  const statusIcons: Record<string, string> = { queued: '○', running: '⟳', succeeded: '✓', failed: '✗', cancelled: '⊘' };
  const statusColors: Record<string, string> = { queued: 'var(--text-muted)', running: 'var(--accent-primary)', succeeded: 'var(--semantic-success)', failed: 'var(--semantic-error)', cancelled: 'var(--text-muted)' };

  if (!currentPlan || agentSteps.length === 0) {
    return (
      <div className="ai-empty-state">
        <div className="ai-empty-state-icon"><svg viewBox="0 0 48 48" fill="currentColor"><path d="M24 4L6 16v16l18 12 18-12V16L24 4zm0 3.5L38.5 18v12L24 35.5 9.5 30V18L24 7.5z"/></svg></div>
        <div className="ai-empty-state-text">请先创建并锁定 Plan，然后点击"执行"</div>
        <button className="ai-plan-btn primary" onClick={() => setMode('plan')}>创建 Plan</button>
      </div>
    );
  }

  return (
    <div className="ai-agent-view">
      <div style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>执行 Plan: {currentPlan.title}</div>

      <div className="ai-agent-stepper">
        {agentSteps.map(step => (
          <div key={step.id} className="ai-agent-step">
            <div className="ai-agent-step-icon" style={{ color: statusColors[step.status], animation: step.status === 'running' ? 'spin 1s linear infinite' : 'none' }}>{statusIcons[step.status]}</div>
            <div className="ai-agent-step-label">{step.label}</div>
            <div className="ai-agent-step-status">{step.status}</div>
          </div>
        ))}
      </div>

      {changes.length > 0 && (
        <div className="ai-agent-changes">
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-ui-weight-semibold)', color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>变更预览:</div>
          {changes.map(change => (
            <div key={change.id} className="ai-agent-change-item">
              <div className="ai-agent-change-info">
                <span style={{ marginRight: 'var(--space-2)' }}>📄</span>
                <div className="ai-agent-change-name">{change.fileName}</div>
                <div className="ai-agent-change-count">{change.isNew ? 'new' : `+${change.additions}, -${change.deletions}`}</div>
              </div>
              <button className="ai-agent-change-btn" onClick={() => applyChange(change)}>应用</button>
            </div>
          ))}
        </div>
      )}

      <div className="ai-agent-actions">
        <button className="ai-agent-btn" onClick={cancelExecution} disabled={!isExecuting}>取消</button>
        <button className="ai-agent-btn primary" onClick={executeAll} disabled={isExecuting || agentSteps.every(s => s.status !== 'queued')}>{isExecuting ? '执行中...' : '执行全部'}</button>
        <button className="ai-agent-btn danger" onClick={rollback}>回滚</button>
      </div>

      {pendingConfirm && (
        <div className="ai-confirm-modal" style={{ position: 'absolute', inset: 0, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-2)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', maxWidth: '300px' }}>
            <div style={{ marginBottom: 'var(--space-3)' }}>确认执行: {pendingConfirm.step.label}?</div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button className="ai-agent-btn" onClick={() => setPendingConfirm(null)}>取消</button>
              <button className="ai-agent-btn primary" onClick={() => { pendingConfirm.action(); setPendingConfirm(null); }}>确认</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
