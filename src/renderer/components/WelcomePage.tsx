/**
 * WelcomePage - 欢迎页组件
 *
 * 应用启动时或无文件打开时显示的欢迎页面。
 * 包含：最近项目列表、快捷操作、版本信息。
 */
import React, { useState } from "react";
import { AppIcons } from "./icons";
import { MindCodeLogo } from "./MindCodeLogo";
import {
  getRecentWorkspaces,
  formatTimeAgo,
  type RecentWorkspace,
} from "../services/recentWorkspaces";

/** 欢迎页最多显示的最近项目数 */
const MAX_RECENT_PROJECTS = 5;

/** 应用版本号 - 集中管理 */
export const APP_VERSION = "v0.3.0";

export interface WelcomePageProps {
  onOpenAI: () => void;
  onQuickOpen: () => void;
  onOpenTerminal: () => void;
  onOpenFolder: () => void;
  onOpenRecentFolder: (path: string) => void;
}

export const WelcomePage: React.FC<WelcomePageProps> = React.memo(
  ({ onOpenAI, onQuickOpen, onOpenTerminal, onOpenFolder, onOpenRecentFolder }) => {
    const [recentWorkspaces] = useState<RecentWorkspace[]>(() => {
      try {
        return getRecentWorkspaces();
      } catch (err) {
        console.warn(
          "[WelcomePage] Failed to load recent workspaces:",
          err instanceof Error ? err.message : err,
        );
        return [];
      }
    });

    return (
      <div className="editor-scroll">
        <div className="welcome">
          <div className="welcome-logo-container">
            <MindCodeLogo size={80} />
          </div>
          <h1>MindCode</h1>
          <p className="welcome-subtitle">AI-NATIVE CODE EDITOR</p>

          {/* Recent Workspaces */}
          {recentWorkspaces.length > 0 && (
            <div className="welcome-recent-section">
              <div className="welcome-recent-title">Recent Projects</div>
              <div className="welcome-recent-list">
                {recentWorkspaces.slice(0, MAX_RECENT_PROJECTS).map((w) => (
                  <div
                    key={w.path}
                    className="welcome-recent-item"
                    onClick={() => onOpenRecentFolder(w.path)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && onOpenRecentFolder(w.path)}
                  >
                    <span className="welcome-recent-icon">
                      <AppIcons.Folder16 />
                    </span>
                    <div className="welcome-recent-info">
                      <div className="welcome-recent-name">{w.name}</div>
                      <div className="welcome-recent-path">{w.path}</div>
                    </div>
                    <span className="welcome-recent-time">{formatTimeAgo(w.lastOpened)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Open Folder Button */}
          <div className="welcome-open-folder">
            <button className="welcome-open-btn" onClick={onOpenFolder}>
              Open Folder
            </button>
          </div>

          {/* Shortcuts */}
          <div className="welcome-shortcuts">
            <div className="shortcut" onClick={onOpenAI} role="button" tabIndex={0}>
              <span className="shortcut-text">AI Chat</span>
              <div className="shortcut-keys">
                <kbd>Ctrl</kbd>
                <kbd>L</kbd>
              </div>
            </div>
            <div className="shortcut" role="button" tabIndex={0}>
              <span className="shortcut-text">Inline Edit</span>
              <div className="shortcut-keys">
                <kbd>Ctrl</kbd>
                <kbd>K</kbd>
              </div>
            </div>
            <div className="shortcut" onClick={onQuickOpen} role="button" tabIndex={0}>
              <span className="shortcut-text">Quick Open</span>
              <div className="shortcut-keys">
                <kbd>Ctrl</kbd>
                <kbd>P</kbd>
              </div>
            </div>
            <div className="shortcut" onClick={onOpenTerminal} role="button" tabIndex={0}>
              <span className="shortcut-text">Terminal</span>
              <div className="shortcut-keys">
                <kbd>Ctrl</kbd>
                <kbd>`</kbd>
              </div>
            </div>
          </div>

          <div className="welcome-version">
            <span>{APP_VERSION}</span>
            <span className="welcome-dot">&#183;</span>
            <span>Powered by Claude</span>
          </div>
        </div>
      </div>
    );
  },
);

WelcomePage.displayName = "WelcomePage";
