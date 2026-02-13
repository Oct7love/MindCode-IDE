/**
 * 诊断列表面板
 * 显示LSP诊断信息(错误、警告、提示)
 */

import React, { useState, useEffect, useCallback } from "react";
import { lspClients } from "../../services/lspProviders";
import type { Diagnostic } from "../../../core/lsp/types";
import "./DiagnosticsPanel.css";

interface DiagnosticsGroup {
  file: string;
  diagnostics: Diagnostic[];
}

interface DiagnosticsPanelProps {
  onJumpToLocation?: (file: string, line: number, column: number) => void;
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({ onJumpToLocation }) => {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsGroup[]>([]);
  const [filter, setFilter] = useState<"all" | "error" | "warning" | "info">("all");
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    // 监听LSP通知
    const cleanupFuncs: (() => void)[] = [];

    lspClients.forEach((client, language) => {
      // TODO: 实现诊断监听
      // 目前需要在LSP Client中添加诊断事件
    });

    return () => {
      cleanupFuncs.forEach((cleanup) => cleanup());
    };
  }, []);

  const getSeverityIcon = (severity: number) => {
    switch (severity) {
      case 1:
        return "❌"; // Error
      case 2:
        return "⚠️"; // Warning
      case 3:
        return "ℹ️"; // Information
      case 4:
        return "💡"; // Hint
      default:
        return "•";
    }
  };

  const getSeverityColor = (severity: number) => {
    switch (severity) {
      case 1:
        return "var(--vscode-errorForeground)";
      case 2:
        return "var(--vscode-warningForeground)";
      case 3:
        return "var(--vscode-infoForeground)";
      case 4:
        return "var(--vscode-descriptionForeground)";
      default:
        return "var(--vscode-foreground)";
    }
  };

  const getSeverityText = (severity: number) => {
    switch (severity) {
      case 1:
        return "Error";
      case 2:
        return "Warning";
      case 3:
        return "Info";
      case 4:
        return "Hint";
      default:
        return "Unknown";
    }
  };

  const shouldShowDiagnostic = (diagnostic: Diagnostic) => {
    if (filter === "all") return true;
    if (filter === "error" && diagnostic.severity === 1) return true;
    if (filter === "warning" && diagnostic.severity === 2) return true;
    if (filter === "info" && (diagnostic.severity === 3 || diagnostic.severity === 4)) return true;
    return false;
  };

  const filteredDiagnostics = diagnostics
    .map((group) => ({
      ...group,
      diagnostics: group.diagnostics.filter(shouldShowDiagnostic),
    }))
    .filter((group) => group.diagnostics.length > 0);

  const toggleFileExpanded = (file: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(file)) {
        next.delete(file);
      } else {
        next.add(file);
      }
      return next;
    });
  };

  const handleDiagnosticClick = (file: string, diagnostic: Diagnostic) => {
    if (onJumpToLocation) {
      onJumpToLocation(file, diagnostic.range.start.line, diagnostic.range.start.character);
    }
  };

  const getTotalCount = () => {
    return diagnostics.reduce((sum, group) => sum + group.diagnostics.length, 0);
  };

  const getErrorCount = () => {
    return diagnostics.reduce(
      (sum, group) => sum + group.diagnostics.filter((d) => d.severity === 1).length,
      0,
    );
  };

  const getWarningCount = () => {
    return diagnostics.reduce(
      (sum, group) => sum + group.diagnostics.filter((d) => d.severity === 2).length,
      0,
    );
  };

  return (
    <div className="diagnostics-panel">
      {/* 头部 */}
      <div className="diagnostics-header">
        <div className="diagnostics-title">Problems</div>
        <div className="diagnostics-stats">
          <span className="stat-item" style={{ color: "var(--vscode-errorForeground)" }}>
            ❌ {getErrorCount()}
          </span>
          <span className="stat-item" style={{ color: "var(--vscode-warningForeground)" }}>
            ⚠️ {getWarningCount()}
          </span>
          <span className="stat-item">Total: {getTotalCount()}</span>
        </div>
      </div>

      {/* 过滤器 */}
      <div className="diagnostics-filters">
        <button
          className={`filter-btn ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        <button
          className={`filter-btn ${filter === "error" ? "active" : ""}`}
          onClick={() => setFilter("error")}
        >
          Errors
        </button>
        <button
          className={`filter-btn ${filter === "warning" ? "active" : ""}`}
          onClick={() => setFilter("warning")}
        >
          Warnings
        </button>
        <button
          className={`filter-btn ${filter === "info" ? "active" : ""}`}
          onClick={() => setFilter("info")}
        >
          Info
        </button>
      </div>

      {/* 诊断列表 */}
      <div className="diagnostics-list">
        {filteredDiagnostics.length === 0 ? (
          <div className="diagnostics-empty">
            <div className="empty-icon">✓</div>
            <div className="empty-text">No problems found</div>
          </div>
        ) : (
          filteredDiagnostics.map((group) => {
            const isExpanded = expandedFiles.has(group.file);
            return (
              <div key={group.file} className="diagnostics-file-group">
                <div className="file-header" onClick={() => toggleFileExpanded(group.file)}>
                  <span className="file-expand-icon">{isExpanded ? "▼" : "▶"}</span>
                  <span className="file-name">{group.file}</span>
                  <span className="file-count">{group.diagnostics.length}</span>
                </div>

                {isExpanded && (
                  <div className="file-diagnostics">
                    {group.diagnostics.map((diagnostic, index) => (
                      <div
                        key={index}
                        className="diagnostic-item"
                        onClick={() => handleDiagnosticClick(group.file, diagnostic)}
                      >
                        <span
                          className="diagnostic-icon"
                          style={{ color: getSeverityColor(diagnostic.severity ?? 1) }}
                        >
                          {getSeverityIcon(diagnostic.severity ?? 1)}
                        </span>
                        <div className="diagnostic-content">
                          <div className="diagnostic-message">{diagnostic.message}</div>
                          <div className="diagnostic-location">
                            Ln {(diagnostic.range?.start?.line ?? 0) + 1}, Col{" "}
                            {(diagnostic.range?.start?.character ?? 0) + 1}
                            {diagnostic.source && (
                              <span className="diagnostic-source"> • {diagnostic.source}</span>
                            )}
                            {diagnostic.code && (
                              <span className="diagnostic-code"> [{diagnostic.code}]</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
