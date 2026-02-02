/**
 * useThinkingUI Hook
 * 管理 Thinking UI 的流式解析和状态
 */
import { useState, useRef, useCallback, useEffect } from 'react';

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

interface UseThinkingUIOptions {
  onComplete?: (output: ThinkingUIOutput) => void;
  onError?: (error: Error) => void;
}

interface UseThinkingUIReturn {
  /** 当前解析的数据 */
  data: Partial<ThinkingUIOutput>;
  /** 是否正在流式接收 */
  isStreaming: boolean;
  /** 开始时间 */
  startTime: number | null;
  /** 追加流式文本 */
  appendChunk: (chunk: string) => void;
  /** 完成流式接收 */
  finish: () => ThinkingUIOutput;
  /** 重置状态 */
  reset: () => void;
  /** 原始累积文本 */
  rawText: string;
}

/**
 * 解析 Thinking UI JSON 输出
 */
function parseThinkingOutput(text: string): ThinkingUIOutput | null {
  try {
    const parsed = JSON.parse(text.trim());
    if (isValidThinkingOutput(parsed)) {
      return parsed;
    }
  } catch {
    // 尝试提取 JSON 对象
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (isValidThinkingOutput(parsed)) {
          return parsed;
        }
      } catch {}
    }
  }
  return null;
}

function isValidThinkingOutput(obj: any): obj is ThinkingUIOutput {
  return (
    obj &&
    typeof obj === 'object' &&
    obj.ui &&
    typeof obj.ui.title === 'string' &&
    Array.isArray(obj.thought_summary) &&
    Array.isArray(obj.trace) &&
    typeof obj.final_answer === 'string'
  );
}

/**
 * Thinking UI Hook
 */
export function useThinkingUI(options: UseThinkingUIOptions = {}): UseThinkingUIReturn {
  const { onComplete, onError } = options;
  
  const [data, setData] = useState<Partial<ThinkingUIOutput>>({
    ui: { title: 'Thinking…', mode: 'thinking', model: '', language: '', time_ms: 0 },
    thought_summary: [],
    trace: [],
    final_answer: '',
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  
  const bufferRef = useRef('');
  
  const appendChunk = useCallback((chunk: string) => {
    // 首次接收时开始计时
    if (!isStreaming) {
      setIsStreaming(true);
      setStartTime(Date.now());
    }
    
    bufferRef.current += chunk;
    const buffer = bufferRef.current;
    
    // 尝试增量解析
    try {
      const newData: Partial<ThinkingUIOutput> = {
        ui: { title: 'Thinking…', mode: 'thinking', model: '', language: '', time_ms: 0 },
        thought_summary: [],
        trace: [],
        final_answer: '',
      };
      
      // 检测 ui.mode
      const modeMatch = buffer.match(/"mode"\s*:\s*"(\w+)"/);
      if (modeMatch && newData.ui) {
        newData.ui.mode = modeMatch[1] as any;
        if (modeMatch[1] === 'done') {
          newData.ui.title = 'Done';
        } else if (modeMatch[1] === 'answering') {
          newData.ui.title = 'Answering…';
        }
      }
      
      // 检测 ui.model
      const modelMatch = buffer.match(/"model"\s*:\s*"([^"]+)"/);
      if (modelMatch && newData.ui) {
        newData.ui.model = modelMatch[1];
      }
      
      // 检测 thought_summary 数组
      const thoughtMatch = buffer.match(/"thought_summary"\s*:\s*\[([\s\S]*?)\]/);
      if (thoughtMatch) {
        try {
          newData.thought_summary = JSON.parse(`[${thoughtMatch[1]}]`);
        } catch {}
      }
      
      // 检测 trace 数组
      const traceMatch = buffer.match(/"trace"\s*:\s*\[([\s\S]*?)\]/);
      if (traceMatch) {
        try {
          newData.trace = JSON.parse(`[${traceMatch[1]}]`);
        } catch {}
      }
      
      // 检测 final_answer（可能不完整）
      const answerMatch = buffer.match(/"final_answer"\s*:\s*"((?:[^"\\]|\\.)*)(?:"|$)/);
      if (answerMatch) {
        newData.final_answer = answerMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
      }
      
      setData(newData);
    } catch (e) {
      // 解析失败时保持现状
    }
  }, [isStreaming]);
  
  const finish = useCallback((): ThinkingUIOutput => {
    setIsStreaming(false);
    const elapsed = startTime ? Date.now() - startTime : 0;
    
    // 尝试完整解析
    const parsed = parseThinkingOutput(bufferRef.current);
    
    if (parsed) {
      // 设置耗时
      parsed.ui.time_ms = elapsed;
      parsed.ui.mode = 'done';
      setData(parsed);
      onComplete?.(parsed);
      return parsed;
    }
    
    // 降级：把原始文本作为答案
    const fallback: ThinkingUIOutput = {
      ui: {
        title: 'Done',
        mode: 'done',
        model: 'unknown',
        language: 'unknown',
        time_ms: elapsed,
      },
      thought_summary: [],
      trace: [{ stage: 'answer', label: '生成回复', status: 'ok' }],
      final_answer: bufferRef.current,
    };
    
    setData(fallback);
    onComplete?.(fallback);
    return fallback;
  }, [startTime, onComplete]);
  
  const reset = useCallback(() => {
    bufferRef.current = '';
    setData({
      ui: { title: 'Thinking…', mode: 'thinking', model: '', language: '', time_ms: 0 },
      thought_summary: [],
      trace: [],
      final_answer: '',
    });
    setIsStreaming(false);
    setStartTime(null);
  }, []);
  
  return {
    data,
    isStreaming,
    startTime,
    appendChunk,
    finish,
    reset,
    rawText: bufferRef.current,
  };
}

export default useThinkingUI;
