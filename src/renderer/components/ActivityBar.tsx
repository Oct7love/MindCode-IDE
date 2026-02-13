import React from "react";
import { AppIcons } from "./icons";

export type SidebarTab = "files" | "search" | "git" | "ext" | "debug" | "settings";

interface ActivityBarProps {
  tab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({ tab, onTabChange }) => (
  <div className="activitybar">
    <div className="activitybar-top">
      <button
        className={`activity-action${tab === "files" ? " active" : ""}`}
        onClick={() => onTabChange("files")}
        title="Explorer"
      >
        <AppIcons.Files />
      </button>
      <button
        className={`activity-action${tab === "search" ? " active" : ""}`}
        onClick={() => onTabChange("search")}
        title="Search"
      >
        <AppIcons.Search />
      </button>
      <button
        className={`activity-action${tab === "git" ? " active" : ""}`}
        onClick={() => onTabChange("git")}
        title="Source Control"
      >
        <AppIcons.GitIcon />
      </button>
      <button
        className={`activity-action${tab === "debug" ? " active" : ""}`}
        onClick={() => onTabChange("debug")}
        title="Run and Debug"
      >
        <AppIcons.Debug16 />
      </button>
      <button
        className={`activity-action${tab === "ext" ? " active" : ""}`}
        onClick={() => onTabChange("ext")}
        title="Extensions"
      >
        <AppIcons.ExtensionsIcon />
      </button>
    </div>
    <div className="activitybar-bottom">
      <button className="activity-action" title="Account">
        <AppIcons.AccountIcon />
      </button>
      <button
        className={`activity-action${tab === "settings" ? " active" : ""}`}
        onClick={() => onTabChange("settings")}
        title="Settings"
      >
        <AppIcons.SettingsGear />
      </button>
    </div>
  </div>
);
