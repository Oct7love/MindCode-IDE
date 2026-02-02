/**
 * Icons - SVG 图标系统
 */

import React from 'react';

interface IconProps { size?: number; color?: string; className?: string; }

const createIcon = (path: string, viewBox = '0 0 24 24') => {
  const Icon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
    <svg width={size} height={size} viewBox={viewBox} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={path} />
    </svg>
  );
  return Icon;
};

const createFilledIcon = (path: string, viewBox = '0 0 24 24') => {
  const Icon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
    <svg width={size} height={size} viewBox={viewBox} fill={color} className={className}>
      <path d={path} />
    </svg>
  );
  return Icon;
};

// 文件图标
export const FileIcon = createIcon('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6');
export const FolderIcon = createIcon('M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z');
export const FolderOpenIcon = createIcon('M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v1 M2 10h20l-2 9H4z');

// 操作图标
export const PlusIcon = createIcon('M12 5v14 M5 12h14');
export const MinusIcon = createIcon('M5 12h14');
export const CloseIcon = createIcon('M18 6L6 18 M6 6l12 12');
export const CheckIcon = createIcon('M20 6L9 17l-5-5');
export const SearchIcon = createIcon('M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z');
export const RefreshIcon = createIcon('M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15');
export const SettingsIcon = createIcon('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z');
export const SaveIcon = createIcon('M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z M17 21v-8H7v8 M7 3v5h8');
export const CopyIcon = createIcon('M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1');
export const TrashIcon = createIcon('M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2');
export const EditIcon = createIcon('M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z');
export const DownloadIcon = createIcon('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3');
export const UploadIcon = createIcon('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12');

// 方向图标
export const ChevronUpIcon = createIcon('M18 15l-6-6-6 6');
export const ChevronDownIcon = createIcon('M6 9l6 6 6-6');
export const ChevronLeftIcon = createIcon('M15 18l-6-6 6-6');
export const ChevronRightIcon = createIcon('M9 18l6-6-6-6');
export const ArrowUpIcon = createIcon('M12 19V5 M5 12l7-7 7 7');
export const ArrowDownIcon = createIcon('M12 5v14 M19 12l-7 7-7-7');
export const ArrowLeftIcon = createIcon('M19 12H5 M12 19l-7-7 7-7');
export const ArrowRightIcon = createIcon('M5 12h14 M12 5l7 7-7 7');

// 状态图标
export const InfoIcon = createIcon('M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 16v-4 M12 8h.01');
export const WarningIcon = createIcon('M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01');
export const ErrorIcon = createIcon('M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M15 9l-6 6 M9 9l6 6');
export const SuccessIcon = createIcon('M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3');
export const LoadingIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" className={`animate-spin ${className || ''}`}>
    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
    <path d="M12 2a10 10 0 0 1 10 10" />
  </svg>
);

// Git 图标
export const GitBranchIcon = createIcon('M6 3v12 M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M18 9a9 9 0 0 1-9 9');
export const GitCommitIcon = createIcon('M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M1.05 12H7 M17.01 12h5.95');
export const GitMergeIcon = createIcon('M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 21V9a9 9 0 0 0 9 9');
export const GitPullIcon = createIcon('M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M13 6h3a2 2 0 0 1 2 2v7 M6 9v12');

// AI 图标
export const BotIcon = createIcon('M12 8V4H8 M12 4h4 M12 4v4 M7 12h10 M7 16h10 M5 20h14a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z');
export const SparklesIcon = createIcon('M12 3l1.912 5.813L19 10l-5.088 1.187L12 17l-1.912-5.813L5 10l5.088-1.187z M19 2l.5 1.5L21 4l-1.5.5L19 6l-.5-1.5L17 4l1.5-.5z M5 18l.5 1.5L7 20l-1.5.5L5 22l-.5-1.5L3 20l1.5-.5z');

// 播放控制
export const PlayIcon = createFilledIcon('M8 5v14l11-7z');
export const PauseIcon = createIcon('M6 4h4v16H6z M14 4h4v16h-4z');
export const StopIcon = createFilledIcon('M6 6h12v12H6z');

// 其他
export const MenuIcon = createIcon('M3 12h18 M3 6h18 M3 18h18');
export const MoreHorizontalIcon = createIcon('M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z');
export const MoreVerticalIcon = createIcon('M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M12 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M12 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z');
export const ExternalLinkIcon = createIcon('M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6 M15 3h6v6 M10 14L21 3');
export const LinkIcon = createIcon('M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71');
export const TerminalIcon = createIcon('M4 17l6-6-6-6 M12 19h8');
export const CodeIcon = createIcon('M16 18l6-6-6-6 M8 6l-6 6 6 6');
export const EyeIcon = createIcon('M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z');
export const EyeOffIcon = createIcon('M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24 M1 1l22 22');
export const LockIcon = createIcon('M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z M7 11V7a5 5 0 0 1 10 0v4');
export const UnlockIcon = createIcon('M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z M7 11V7a5 5 0 0 1 9.9-1');
export const StarIcon = createIcon('M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z');
export const HeartIcon = createIcon('M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z');
export const BookmarkIcon = createIcon('M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z');
export const SendIcon = createIcon('M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z');
export const MessageIcon = createIcon('M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z');
export const UserIcon = createIcon('M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z');
export const UsersIcon = createIcon('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75');
export const HomeIcon = createIcon('M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10');
export const CalendarIcon = createIcon('M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z M16 2v4 M8 2v4 M3 10h18');
export const ClockIcon = createIcon('M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2');

export default {
  FileIcon, FolderIcon, FolderOpenIcon, PlusIcon, MinusIcon, CloseIcon, CheckIcon, SearchIcon, RefreshIcon, SettingsIcon, SaveIcon, CopyIcon, TrashIcon, EditIcon, DownloadIcon, UploadIcon,
  ChevronUpIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ArrowUpIcon, ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon,
  InfoIcon, WarningIcon, ErrorIcon, SuccessIcon, LoadingIcon, GitBranchIcon, GitCommitIcon, GitMergeIcon, GitPullIcon, BotIcon, SparklesIcon,
  PlayIcon, PauseIcon, StopIcon, MenuIcon, MoreHorizontalIcon, MoreVerticalIcon, ExternalLinkIcon, LinkIcon, TerminalIcon, CodeIcon,
  EyeIcon, EyeOffIcon, LockIcon, UnlockIcon, StarIcon, HeartIcon, BookmarkIcon, SendIcon, MessageIcon, UserIcon, UsersIcon, HomeIcon, CalendarIcon, ClockIcon,
};
