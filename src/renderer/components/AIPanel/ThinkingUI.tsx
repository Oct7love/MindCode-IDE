/**
 * Cursor-like Thinking UI 组件
 * 显示 AI 思考状态、思考摘要、动作轨迹和最终回答
 */
import React, { useState, useMemo } from 'react';
import './ThinkingUI.css';

// Types
export interface ThinkingUIOutput {
  ui: {
    title: string;
    mode: 'thinking' | 'answering' | 'done';
    model: string;
    language: string;
    time_ms: number;
  };
  thought_summary: string[];
  trace: TraceEvent[];
  final_answer: string;
}

export interface TraceEvent {
  stage: 'read' | 'analyze' | 'search' | 'plan' | 'edit' | 'test' | 'answer';
  label: string;
  status: 'running' | 'ok' | 'warn' | 'fail';
}

interface ThinkingUIProps {
  data: Partial<ThinkingUIOutput>;
  isStreaming?: boolean;
  startTime?: number;
  renderMarkdown?: (content: string) => React.ReactNode;
}

// Stage 图标映射
const STAGE_ICONS: Record<TraceEvent['stage'], string> = {
  read: '📖',
  analyze: '🔍',
  search: '🔎',
  plan: '📋',
  edit: '✏️',
  test: '🧪',
  answer: '💬',
};

// Status 样式映射
const STATUS_CLASSES: Record<TraceEvent['status'], string> = {
  running: 'trace-status-running',
  ok: 'trace-status-ok',
  warn: 'trace-status-warn',
  fail: 'trace-status-fail',
};

/**
 * 思考状态条
 */
export const ThinkingHeader: React.FC<{
  title: string;
  mode: 'thinking' | 'answering' | 'done';
  timeMs: number;
  model?: string;
  isStreaming?: boolean;
}> = ({ title, mode, timeMs, model, isStreaming }) => {
  const [elapsed, setElapsed] = useState(0);
  
  // 实时计时
  React.useEffect(() => {
    if (!isStreaming || mode === 'done') return;
    const start = Date.now() - timeMs;
    const timer = setInterval(() => {
      setElapsed(Date.now() - start);
    }, 100);
    return () => clearInterval(timer);
  }, [isStreaming, mode, timeMs]);
  
  const displayTime = mode === 'done' ? timeMs : elapsed;
  const timeStr = displayTime > 0 ? `${(displayTime / 1000).toFixed(1)}s` : '';
  
  return (
    <div className={`thinking-header thinking-mode-${mode}`}>
      <div className="thinking-status">
        {mode === 'thinking' && <span className="thinking-spinner" />}
        {mode === 'answering' && <span className="answering-pulse" />}
        {mode === 'done' && <span className="done-check">✓</span>}
        <span className="thinking-title">{title}</span>
        {timeStr && <span className="thinking-time">{timeStr}</span>}
      </div>
      {model && <span className="thinking-model">{model}</span>}
    </div>
  );
};

/**
 * 可折叠的思考摘要
 */
export const ThoughtSummary: React.FC<{
  thoughts: string[];
  defaultExpanded?: boolean;
}> = ({ thoughts, defaultExpanded = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  if (!thoughts || thoughts.length === 0) return null;
  
  return (
    <div className="thought-summary">
      <button 
        className="thought-toggle"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className={`thought-arrow ${expanded ? 'expanded' : ''}`}>▶</span>
        <span className="thought-label">Thought</span>
        <span className="thought-count">{thoughts.length} steps</span>
      </button>
      {expanded && (
        <ul className="thought-list">
          {thoughts.map((thought, i) => (
            <li key={i} className="thought-item">
              <span className="thought-bullet">•</span>
              {thought}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * 动作轨迹 Timeline
 */
export const TraceTimeline: React.FC<{
  trace: TraceEvent[];
  compact?: boolean;
}> = ({ trace, compact = false }) => {
  if (!trace || trace.length === 0) return null;
  
  return (
    <div className={`trace-timeline ${compact ? 'trace-compact' : ''}`}>
      {trace.map((event, i) => (
        <div key={i} className={`trace-event ${STATUS_CLASSES[event.status]}`}>
          <span className="trace-icon">{STAGE_ICONS[event.stage] || '•'}</span>
          <span className="trace-label">{event.label}</span>
          {event.status === 'running' && <span className="trace-spinner" />}
          {event.status === 'ok' && <span className="trace-check">✓</span>}
          {event.status === 'warn' && <span className="trace-warn">⚠</span>}
          {event.status === 'fail' && <span className="trace-fail">✗</span>}
        </div>
      ))}
    </div>
  );
};

/**
 * 完整的 Thinking UI 组件
 */
export const ThinkingUI: React.FC<ThinkingUIProps> = ({
  data,
  isStreaming = false,
  startTime,
  renderMarkdown,
}) => {
  const ui = data.ui || { title: 'Thinking…', mode: 'thinking', model: '', language: '', time_ms: 0 };
  const thoughts = data.thought_summary || [];
  const trace = data.trace || [];
  const answer = data.final_answer || '';
  
  // 计算实时耗时
  const timeMs = useMemo(() => {
    if (ui.time_ms > 0) return ui.time_ms;
    if (startTime) return Date.now() - startTime;
    return 0;
  }, [ui.time_ms, startTime]);
  
  return (
    <div className="thinking-ui">
      {/* 状态条 */}
      <ThinkingHeader
        title={ui.title}
        mode={ui.mode}
        timeMs={timeMs}
        model={ui.model}
        isStreaming={isStreaming}
      />
      
      {/* 思考摘要（可折叠） */}
      {thoughts.length > 0 && (
        <ThoughtSummary thoughts={thoughts} />
      )}
      
      {/* 动作轨迹 */}
      {trace.length > 0 && (
        <TraceTimeline trace={trace} compact={trace.length > 6} />
      )}
      
      {/* 最终回答 */}
      {answer && (
        <div className="thinking-answer">
          {renderMarkdown ? renderMarkdown(answer) : (
            <div className="thinking-answer-text">{answer}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default ThinkingUI;
