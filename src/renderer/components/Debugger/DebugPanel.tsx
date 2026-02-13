/**
 * 调试面板 - 主组件
 * 包含工具栏、变量、调用栈、断点等子面板
 */

import React, { useState, useEffect } from "react";
import { DebugToolbar } from "./DebugToolbar";
import { VariablesView } from "./VariablesView";
import { CallStackView } from "./CallStackView";
import { BreakpointsView } from "./BreakpointsView";
import { DebugConsole } from "./DebugConsole";
import type { DebugSession, Breakpoint, Variable, StackFrame } from "../../../core/debugger";
import "./DebugPanel.css";

export const DebugPanel: React.FC = () => {
  const [activeSession, setActiveSession] = useState<DebugSession | null>(null);
  const [sessions, setSessions] = useState<DebugSession[]>([]);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [stackFrames, setStackFrames] = useState<StackFrame[]>([]);
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([]);
  const [selectedPanel, setSelectedPanel] = useState<
    "variables" | "callstack" | "breakpoints" | "console"
  >("variables");

  // 加载调试会话
  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadSessions = async () => {
    const result = await window.mindcode.debug.listSessions();
    if (result.success && result.data) {
      const sessionList = result.data as unknown as DebugSession[];
      setSessions(sessionList);
      if (sessionList.length > 0) {
        const active = sessionList.find((s) => s.state === "running" || s.state === "paused");
        if (active) {
          setActiveSession(active);
          setVariables(active.variables || []);
          setStackFrames(active.stackFrames || []);
        }
      }
    }
  };

  // 加载断点
  useEffect(() => {
    loadBreakpoints();
  }, []);

  const loadBreakpoints = async () => {
    const result = await window.mindcode.debug.getBreakpoints();
    if (result.success && result.data) {
      setBreakpoints(result.data as unknown as Breakpoint[]);
    }
  };

  // 调试控制
  const handleContinue = async () => {
    await window.mindcode.debug.continue(activeSession?.id);
    loadSessions();
  };

  const handlePause = async () => {
    await window.mindcode.debug.pause(activeSession?.id);
    loadSessions();
  };

  const handleStepOver = async () => {
    await window.mindcode.debug.stepOver(activeSession?.id);
    loadSessions();
  };

  const handleStepInto = async () => {
    await window.mindcode.debug.stepInto(activeSession?.id);
    loadSessions();
  };

  const handleStepOut = async () => {
    await window.mindcode.debug.stepOut(activeSession?.id);
    loadSessions();
  };

  const handleStop = async () => {
    await window.mindcode.debug.stop(activeSession?.id);
    setActiveSession(null);
    loadSessions();
  };

  const handleRestart = async () => {
    await window.mindcode.debug.restart(activeSession?.id);
    loadSessions();
  };

  // 启动调试
  const handleStart = async () => {
    // TODO: 显示配置选择对话框
    const config = {
      name: "Debug Node.js",
      type: "node" as const,
      request: "launch" as const,
      program: "${workspaceFolder}/index.js",
      cwd: "${workspaceFolder}",
    };

    const result = await window.mindcode.debug.start(config);
    if (result.success) {
      loadSessions();
    }
  };

  return (
    <div className="debug-panel">
      {/* 工具栏 */}
      <DebugToolbar
        session={activeSession}
        onStart={handleStart}
        onContinue={handleContinue}
        onPause={handlePause}
        onStepOver={handleStepOver}
        onStepInto={handleStepInto}
        onStepOut={handleStepOut}
        onStop={handleStop}
        onRestart={handleRestart}
      />

      {/* 会话选择 */}
      {sessions.length > 0 && (
        <div className="debug-sessions">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`session-item ${session.id === activeSession?.id ? "active" : ""}`}
              onClick={() => setActiveSession(session)}
            >
              <span className="session-name">{session.name}</span>
              <span className={`session-state state-${session.state}`}>{session.state}</span>
            </div>
          ))}
        </div>
      )}

      {/* 标签页切换 */}
      <div className="debug-tabs">
        <button
          className={`tab ${selectedPanel === "variables" ? "active" : ""}`}
          onClick={() => setSelectedPanel("variables")}
        >
          Variables
        </button>
        <button
          className={`tab ${selectedPanel === "callstack" ? "active" : ""}`}
          onClick={() => setSelectedPanel("callstack")}
        >
          Call Stack
        </button>
        <button
          className={`tab ${selectedPanel === "breakpoints" ? "active" : ""}`}
          onClick={() => setSelectedPanel("breakpoints")}
        >
          Breakpoints
        </button>
        <button
          className={`tab ${selectedPanel === "console" ? "active" : ""}`}
          onClick={() => setSelectedPanel("console")}
        >
          Debug Console
        </button>
      </div>

      {/* 内容区域 */}
      <div className="debug-content">
        {selectedPanel === "variables" && (
          <VariablesView variables={variables} onRefresh={loadSessions} />
        )}
        {selectedPanel === "callstack" && (
          <CallStackView
            frames={stackFrames}
            onFrameClick={(frame) => {
              // TODO: 跳转到对应位置
              console.log("Navigate to frame:", frame);
            }}
          />
        )}
        {selectedPanel === "breakpoints" && (
          <BreakpointsView
            breakpoints={breakpoints}
            onRefresh={loadBreakpoints}
            onToggle={async (bp) => {
              await window.mindcode.debug.toggleBreakpoint(bp.file, bp.line);
              loadBreakpoints();
            }}
            onRemove={async (bp) => {
              await window.mindcode.debug.removeBreakpoint(bp.id);
              loadBreakpoints();
            }}
          />
        )}
        {selectedPanel === "console" && (
          <DebugConsole
            session={activeSession}
            onEvaluate={async (expr) => {
              const result = await window.mindcode.debug.evaluate(expr);
              return result.success && result.data ? result.data.result : "Error";
            }}
          />
        )}
      </div>

      {/* 空状态 */}
      {!activeSession && sessions.length === 0 && (
        <div className="debug-empty">
          <div className="empty-icon">🐛</div>
          <div className="empty-text">No active debug session</div>
          <button className="start-debug-btn" onClick={handleStart}>
            Start Debugging
          </button>
        </div>
      )}
    </div>
  );
};

export default DebugPanel;
