/**
 * Contexts - React 上下文管理
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { Settings, EditorState, FileInfo, AIConfig, LayoutConfig, Theme } from '../../types';

// ==================== App Context ====================
export interface AppContextValue {
  workspacePath: string | null;
  setWorkspacePath: (path: string | null) => void;
  isReady: boolean;
  version: string;
}

const AppContext = createContext<AppContextValue | null>(null);

export const useApp = () => { const ctx = useContext(AppContext); if (!ctx) throw new Error('useApp must be used within AppProvider'); return ctx; };

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => { setIsReady(true); }, []);

  return React.createElement(AppContext.Provider, { value: { workspacePath, setWorkspacePath, isReady, version: '1.0.0' } }, children);
};

// ==================== Editor Context ====================
export interface EditorContextValue {
  activeFile: string | null;
  setActiveFile: (path: string | null) => void;
  openFiles: string[];
  openFile: (path: string) => void;
  closeFile: (path: string) => void;
  closeAllFiles: () => void;
  isDirty: (path: string) => boolean;
  setDirty: (path: string, dirty: boolean) => void;
  getContent: (path: string) => string | undefined;
  setContent: (path: string, content: string) => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export const useEditor = () => { const ctx = useContext(EditorContext); if (!ctx) throw new Error('useEditor must be used within EditorProvider'); return ctx; };

export const EditorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());
  const contentMap = useRef<Map<string, string>>(new Map());

  const openFile = useCallback((path: string) => {
    if (!openFiles.includes(path)) setOpenFiles(prev => [...prev, path]);
    setActiveFile(path);
  }, [openFiles]);

  const closeFile = useCallback((path: string) => {
    setOpenFiles(prev => prev.filter(f => f !== path));
    setDirtyFiles(prev => { const next = new Set(prev); next.delete(path); return next; });
    contentMap.current.delete(path);
    if (activeFile === path) setActiveFile(openFiles.filter(f => f !== path)[0] || null);
  }, [activeFile, openFiles]);

  const closeAllFiles = useCallback(() => {
    setOpenFiles([]);
    setActiveFile(null);
    setDirtyFiles(new Set());
    contentMap.current.clear();
  }, []);

  const isDirty = useCallback((path: string) => dirtyFiles.has(path), [dirtyFiles]);
  const setDirty = useCallback((path: string, dirty: boolean) => {
    setDirtyFiles(prev => { const next = new Set(prev); if (dirty) next.add(path); else next.delete(path); return next; });
  }, []);

  const getContent = useCallback((path: string) => contentMap.current.get(path), []);
  const setContent = useCallback((path: string, content: string) => { contentMap.current.set(path, content); }, []);

  return React.createElement(EditorContext.Provider, { value: { activeFile, setActiveFile, openFiles, openFile, closeFile, closeAllFiles, isDirty, setDirty, getContent, setContent } }, children);
};

// ==================== File Context ====================
export interface FileContextValue {
  files: FileInfo[];
  setFiles: (files: FileInfo[]) => void;
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
  selectedFile: string | null;
  setSelectedFile: (path: string | null) => void;
  refresh: () => void;
}

const FileContext = createContext<FileContextValue | null>(null);

export const useFiles = () => { const ctx = useContext(FileContext); if (!ctx) throw new Error('useFiles must be used within FileProvider'); return ctx; };

export const FileProvider: React.FC<{ children: React.ReactNode; onRefresh?: () => void }> = ({ children, onRefresh }) => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => { const next = new Set(prev); if (next.has(path)) next.delete(path); else next.add(path); return next; });
  }, []);

  const refresh = useCallback(() => { onRefresh?.(); }, [onRefresh]);

  return React.createElement(FileContext.Provider, { value: { files, setFiles, expandedFolders, toggleFolder, selectedFile, setSelectedFile, refresh } }, children);
};

// ==================== Settings Context ====================
export interface SettingsContextValue {
  settings: Settings;
  getSetting: <T>(key: string, defaultValue: T) => T;
  setSetting: (key: string, value: any) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);
const SETTINGS_KEY = 'mindcode_settings';
const DEFAULT_SETTINGS: Settings = {};

export const useSettings = () => { const ctx = useContext(SettingsContext); if (!ctx) throw new Error('useSettings must be used within SettingsProvider'); return ctx; };

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  const getSetting = useCallback(<T,>(key: string, defaultValue: T): T => {
    return settings[key] !== undefined ? settings[key] : defaultValue;
  }, [settings]);

  const setSetting = useCallback((key: string, value: any) => {
    setSettings(prev => { const next = { ...prev, [key]: value }; localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); return next; });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
  }, []);

  return React.createElement(SettingsContext.Provider, { value: { settings, getSetting, setSetting, resetSettings } }, children);
};

// ==================== Combined Provider ====================
export const CombinedProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return React.createElement(AppProvider, null,
    React.createElement(SettingsProvider, null,
      React.createElement(EditorProvider, null,
        React.createElement(FileProvider, null, children)
      )
    )
  );
};

export default { AppProvider, useApp, EditorProvider, useEditor, FileProvider, useFiles, SettingsProvider, useSettings, CombinedProvider };
