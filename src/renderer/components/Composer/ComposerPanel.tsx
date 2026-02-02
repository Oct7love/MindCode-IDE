/**
 * Composer 面板
 * 项目级多文件重构界面
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useFileStore } from '../../stores';
import { 
  generatePlan, 
  analyzeImpact, 
  validatePlan,
  createExecutor,
  type ExecutionPlan,
  type ExecutionStep,
  type RefactorRequest,
  type ImpactAnalysis,
  type ComposerMode,
} from '../../../core/composer';
import './ComposerPanel.css';

interface ComposerPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ComposerPanel: React.FC<ComposerPanelProps> = ({ isOpen, onClose }) => {
  const workspaceRoot = useFileStore(s => s.workspaceRoot);
  
  // 状态
  const [mode, setMode] = useState<ComposerMode>('input');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [impact, setImpact] = useState<ImpactAnalysis | null>(null);
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  
  // 生成计划
  const handleGeneratePlan = useCallback(async () => {
    if (!input.trim() || !workspaceRoot) return;
    
    setIsLoading(true);
    setError(null);
    setMode('analyzing');
    
    try {
      // 创建需求
      const request: RefactorRequest = {
        id: `req-${Date.now()}`,
        description: input,
        createdAt: Date.now(),
      };
      
      // 生成计划
      setMode('planning');
      const newPlan = await generatePlan(request, {
        workspacePath: workspaceRoot,
      });
      
      // 分析影响
      const newImpact = await analyzeImpact(newPlan, workspaceRoot);
      
      // 验证计划
      const validation = validatePlan(newPlan);
      if (!validation.valid) {
        setError(`计划验证失败: ${validation.errors.join(', ')}`);
      }
      
      setPlan(newPlan);
      setImpact(newImpact);
      setMode('reviewing');
      
    } catch (err: any) {
      setError(err.message);
      setMode('error');
    } finally {
      setIsLoading(false);
    }
  }, [input, workspaceRoot]);
  
  // 执行计划
  const handleExecutePlan = useCallback(async () => {
    if (!plan || !workspaceRoot) return;
    
    setIsLoading(true);
    setMode('executing');
    setExecutionLog([]);
    
    try {
      const executor = createExecutor({ workspacePath: workspaceRoot });
      
      // 设置事件监听
      executor.on('onStepStart', (step) => {
        setExecutionLog(prev => [...prev, `▶ 开始: ${step.name}`]);
      });
      
      executor.on('onStepComplete', (step) => {
        setExecutionLog(prev => [...prev, `✓ 完成: ${step.name}`]);
      });
      
      executor.on('onStepError', (step, error) => {
        setExecutionLog(prev => [...prev, `✗ 失败: ${step.name} - ${error.message}`]);
      });
      
      executor.on('onRollback', (step) => {
        setExecutionLog(prev => [...prev, `↩ 回滚: ${step.name}`]);
      });
      
      // 执行
      const result = await executor.execute(plan);
      setPlan(result);
      
      if (result.status === 'completed') {
        setMode('complete');
        setExecutionLog(prev => [...prev, '🎉 重构完成！']);
      } else if (result.status === 'failed' || result.status === 'rolled_back') {
        setMode('error');
        setError('执行失败，已回滚');
      }
      
    } catch (err: any) {
      setError(err.message);
      setMode('error');
    } finally {
      setIsLoading(false);
    }
  }, [plan, workspaceRoot]);
  
  // 重置
  const handleReset = useCallback(() => {
    setMode('input');
    setInput('');
    setPlan(null);
    setImpact(null);
    setError(null);
    setExecutionLog([]);
  }, []);
  
  if (!isOpen) return null;
  
  return (
    <div className="composer-overlay">
      <div className="composer-panel">
        {/* 头部 */}
        <div className="composer-header">
          <h2>✨ Composer</h2>
          <span className="composer-subtitle">项目级智能重构</span>
          <button className="composer-close" onClick={onClose}>×</button>
        </div>
        
        {/* 内容 */}
        <div className="composer-content">
          {/* 输入模式 */}
          {mode === 'input' && (
            <div className="composer-input-section">
              <label>描述你的重构需求：</label>
              <textarea
                className="composer-textarea"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="例如：将所有 REST API 迁移到 GraphQL，保持向后兼容..."
                rows={6}
                autoFocus
              />
              <div className="composer-actions">
                <button
                  className="composer-btn composer-btn-primary"
                  onClick={handleGeneratePlan}
                  disabled={!input.trim() || isLoading || !workspaceRoot}
                >
                  {isLoading ? '分析中...' : '生成计划'}
                </button>
                {!workspaceRoot && (
                  <span className="composer-warning">请先打开工作区</span>
                )}
              </div>
            </div>
          )}
          
          {/* 分析/规划中 */}
          {(mode === 'analyzing' || mode === 'planning') && (
            <div className="composer-loading">
              <div className="composer-spinner" />
              <p>{mode === 'analyzing' ? '正在分析需求...' : '正在生成执行计划...'}</p>
            </div>
          )}
          
          {/* 计划审查 */}
          {mode === 'reviewing' && plan && (
            <div className="composer-review">
              {/* 影响分析 */}
              {impact && (
                <div className="composer-impact">
                  <h3>📊 影响分析</h3>
                  <div className="impact-stats">
                    <div className="stat">
                      <span className="stat-value">{impact.riskSummary.totalFiles}</span>
                      <span className="stat-label">受影响文件</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value stat-risk">{impact.riskSummary.highRiskFiles}</span>
                      <span className="stat-label">高风险</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{impact.riskSummary.estimatedComplexity}</span>
                      <span className="stat-label">复杂度</span>
                    </div>
                  </div>
                  
                  {/* 文件列表 */}
                  <div className="impact-files">
                    {impact.affectedFiles.slice(0, 10).map((file, idx) => (
                      <div key={idx} className={`impact-file risk-${file.riskLevel}`}>
                        <span className="file-icon">
                          {file.changeType === 'create' ? '➕' :
                           file.changeType === 'delete' ? '🗑️' : '📝'}
                        </span>
                        <span className="file-path">{file.filePath}</span>
                        <span className={`risk-badge ${file.riskLevel}`}>{file.riskLevel}</span>
                      </div>
                    ))}
                    {impact.affectedFiles.length > 10 && (
                      <div className="impact-more">+{impact.affectedFiles.length - 10} 更多文件...</div>
                    )}
                  </div>
                </div>
              )}
              
              {/* 执行计划 */}
              <div className="composer-plan">
                <h3>📋 执行计划</h3>
                <div className="plan-steps">
                  {plan.steps.map((step, idx) => (
                    <div key={step.id} className={`plan-step status-${step.status}`}>
                      <div className="step-number">{idx + 1}</div>
                      <div className="step-content">
                        <div className="step-name">{step.name}</div>
                        <div className="step-desc">{step.description}</div>
                        <div className="step-files">
                          {step.files.slice(0, 3).map((f, i) => (
                            <span key={i} className="step-file">{f}</span>
                          ))}
                          {step.files.length > 3 && (
                            <span className="step-file-more">+{step.files.length - 3}</span>
                          )}
                        </div>
                      </div>
                      <div className="step-status">
                        {step.status === 'pending' && '○'}
                        {step.status === 'running' && '◐'}
                        {step.status === 'completed' && '✓'}
                        {step.status === 'failed' && '✗'}
                        {step.status === 'rolled_back' && '↩'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* 操作按钮 */}
              <div className="composer-actions">
                <button className="composer-btn" onClick={handleReset}>
                  返回修改
                </button>
                <button
                  className="composer-btn composer-btn-primary"
                  onClick={handleExecutePlan}
                  disabled={isLoading}
                >
                  执行计划
                </button>
              </div>
            </div>
          )}
          
          {/* 执行中 */}
          {mode === 'executing' && (
            <div className="composer-executing">
              <h3>⚡ 正在执行...</h3>
              <div className="execution-progress">
                <div 
                  className="progress-bar" 
                  style={{ 
                    width: plan ? `${((plan.currentStepIndex + 1) / plan.steps.length) * 100}%` : '0%' 
                  }}
                />
              </div>
              <div className="execution-log">
                {executionLog.map((log, idx) => (
                  <div key={idx} className="log-item">{log}</div>
                ))}
              </div>
            </div>
          )}
          
          {/* 完成 */}
          {mode === 'complete' && (
            <div className="composer-complete">
              <div className="complete-icon">🎉</div>
              <h3>重构完成！</h3>
              <p>所有步骤已成功执行</p>
              <div className="composer-actions">
                <button className="composer-btn composer-btn-primary" onClick={handleReset}>
                  开始新的重构
                </button>
                <button className="composer-btn" onClick={onClose}>
                  关闭
                </button>
              </div>
            </div>
          )}
          
          {/* 错误 */}
          {mode === 'error' && (
            <div className="composer-error">
              <div className="error-icon">❌</div>
              <h3>出现错误</h3>
              <p className="error-message">{error}</p>
              <div className="composer-actions">
                <button className="composer-btn" onClick={handleReset}>
                  重新开始
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComposerPanel;
