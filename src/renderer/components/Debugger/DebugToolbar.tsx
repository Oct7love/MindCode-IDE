/**
 * 调试工具栏
 * 包含调试控制按钮
 */

import React from 'react';
import type { DebugSession } from '../../../core/debugger';

interface DebugToolbarProps {
  session: DebugSession | null;
  onStart: () => void;
  onContinue: () => void;
  onPause: () => void;
  onStepOver: () => void;
  onStepInto: () => void;
  onStepOut: () => void;
  onStop: () => void;
  onRestart: () => void;
}

export const DebugToolbar: React.FC<DebugToolbarProps> = ({
  session,
  onStart,
  onContinue,
  onPause,
  onStepOver,
  onStepInto,
  onStepOut,
  onStop,
  onRestart
}) => {
  const isRunning = session?.state === 'running';
  const isPaused = session?.state === 'paused';
  const hasSession = !!session;

  return (
    <div className="debug-toolbar">
      {!hasSession ? (
        <button className="toolbar-btn start" onClick={onStart} title="Start Debugging (F5)">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
            <path d="M4 3l8 5-8 5V3z"/>
          </svg>
          <span>Start</span>
        </button>
      ) : (
        <>
          {isPaused ? (
            <button className="toolbar-btn continue" onClick={onContinue} title="Continue (F5)">
              <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                <path d="M4 3l8 5-8 5V3z"/>
              </svg>
            </button>
          ) : (
            <button className="toolbar-btn pause" onClick={onPause} title="Pause (F6)">
              <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                <rect x="4" y="3" width="3" height="10"/>
                <rect x="9" y="3" width="3" height="10"/>
              </svg>
            </button>
          )}

          <button 
            className="toolbar-btn step-over" 
            onClick={onStepOver} 
            disabled={!isPaused}
            title="Step Over (F10)"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M12 6L8 10l-4-4 1-1 3 3 3-3 1 1z"/>
            </svg>
          </button>

          <button 
            className="toolbar-btn step-into" 
            onClick={onStepInto} 
            disabled={!isPaused}
            title="Step Into (F11)"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M8 3v7l-3-3-1 1 4 4 4-4-1-1-3 3V3z"/>
            </svg>
          </button>

          <button 
            className="toolbar-btn step-out" 
            onClick={onStepOut} 
            disabled={!isPaused}
            title="Step Out (Shift+F11)"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M8 13V6l-3 3-1-1 4-4 4 4-1 1-3-3v7z"/>
            </svg>
          </button>

          <div className="toolbar-separator" />

          <button className="toolbar-btn restart" onClick={onRestart} title="Restart (Ctrl+Shift+F5)">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M12.75 8a4.75 4.75 0 0 1-8.61 2.63l-.62.75A6 6 0 1 0 8 2V0l3 3-3 3V4a4 4 0 1 1-4 4H3a5 5 0 1 0 9.75 0h-.25z"/>
            </svg>
          </button>

          <button className="toolbar-btn stop" onClick={onStop} title="Stop (Shift+F5)">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <rect x="4" y="4" width="8" height="8" rx="1"/>
            </svg>
          </button>
        </>
      )}
    </div>
  );
};
