import React from "react";
import { AppIcons } from "./icons";
import { Terminal } from "./Terminal";
import { DiagnosticsPanel } from "./LSP";

export type BottomPanelTab = "terminal" | "diagnostics";

interface BottomPanelProps {
  height: number;
  activeTab: BottomPanelTab;
  workspacePath: string;
  isVisible: boolean;
  onTabChange: (tab: BottomPanelTab) => void;
  onClose: () => void;
  onResizeStart: (e: React.MouseEvent) => void;
  onOpenFile: (path: string, name: string) => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  height,
  activeTab,
  workspacePath,
  isVisible,
  onTabChange,
  onClose,
  onResizeStart,
  onOpenFile,
}) => (
  <div className="bottom-panel" style={{ height }}>
    <div className="bottom-panel-resizer" onMouseDown={onResizeStart} />
    <div className="bottom-panel-tabs">
      <button
        className={`bottom-tab ${activeTab === "terminal" ? "active" : ""}`}
        onClick={() => onTabChange("terminal")}
      >
        <AppIcons.Terminal16 />
        <span>Terminal</span>
      </button>
      <button
        className={`bottom-tab ${activeTab === "diagnostics" ? "active" : ""}`}
        onClick={() => onTabChange("diagnostics")}
      >
        <span>⚠️</span>
        <span>Problems</span>
      </button>
      <button className="bottom-tab-close" onClick={onClose} title="Close Panel">
        <AppIcons.Close16 />
      </button>
    </div>
    <div className="bottom-panel-content">
      {activeTab === "terminal" && (
        <Terminal workspacePath={workspacePath} isVisible={isVisible} onClose={onClose} />
      )}
      {activeTab === "diagnostics" && (
        <DiagnosticsPanel
          onJumpToLocation={(file, _line, _column) => {
            onOpenFile(file, file.split(/[/\\]/).pop() || file);
          }}
        />
      )}
    </div>
  </div>
);
