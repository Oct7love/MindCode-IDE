import React from 'react';

interface IconProps {
  size?: number;
  color?: string;
  className?: string;
}

export const FileIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
    <path d="M13 4.5V14.5C13 14.7761 12.7761 15 12.5 15H3.5C3.22386 15 3 14.7761 3 14.5V1.5C3 1.22386 3.22386 1 3.5 1H9.5L13 4.5Z" stroke={color} strokeWidth="1.2"/>
    <path d="M9 1V5H13" stroke={color} strokeWidth="1.2"/>
  </svg>
);

export const FolderIcon: React.FC<IconProps> = ({ size = 16, color = '#dcb67a', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
    <path d="M1.5 3C1.5 2.44772 1.94772 2 2.5 2H6L7.5 4H13.5C14.0523 4 14.5 4.44772 14.5 5V13C14.5 13.5523 14.0523 14 13.5 14H2.5C1.94772 14 1.5 13.5523 1.5 13V3Z" fill={color}/>
  </svg>
);

export const FolderOpenIcon: React.FC<IconProps> = ({ size = 16, color = '#dcb67a', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
    <path d="M1.5 3C1.5 2.44772 1.94772 2 2.5 2H6L7.5 4H13.5C14.0523 4 14.5 4.44772 14.5 5V6H3L1.5 13V3Z" fill={color}/>
    <path d="M2 14L3.5 7H15L13.5 14H2Z" fill={color}/>
  </svg>
);

export const SearchIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
    <circle cx="8.5" cy="8.5" r="5.5" stroke={color} strokeWidth="1.5"/>
    <path d="M12.5 12.5L17 17" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const GitBranchIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
    <circle cx="6" cy="4" r="2" stroke={color} strokeWidth="1.5"/>
    <circle cx="6" cy="16" r="2" stroke={color} strokeWidth="1.5"/>
    <circle cx="14" cy="8" r="2" stroke={color} strokeWidth="1.5"/>
    <path d="M6 6V14M6 8C6 8 6 8 8 8H12" stroke={color} strokeWidth="1.5"/>
  </svg>
);

export const ExtensionIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
    <rect x="2" y="8" width="6" height="10" rx="1" stroke={color} strokeWidth="1.5"/>
    <rect x="8" y="2" width="10" height="6" rx="1" stroke={color} strokeWidth="1.5"/>
    <rect x="8" y="8" width="10" height="10" rx="1" stroke={color} strokeWidth="1.5"/>
  </svg>
);

export const ExplorerIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
    <rect x="2" y="2" width="16" height="4" rx="1" stroke={color} strokeWidth="1.5"/>
    <rect x="2" y="8" width="16" height="4" rx="1" stroke={color} strokeWidth="1.5"/>
    <rect x="2" y="14" width="16" height="4" rx="1" stroke={color} strokeWidth="1.5"/>
  </svg>
);

export const ChatIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
    <path d="M3 4C3 2.89543 3.89543 2 5 2H15C16.1046 2 17 2.89543 17 4V12C17 13.1046 16.1046 14 15 14H7L3 18V4Z" stroke={color} strokeWidth="1.5"/>
    <path d="M6 7H14M6 10H11" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const SendIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
    <path d="M14 8L2 2V6L8 8L2 10V14L14 8Z" fill={color}/>
  </svg>
);

export const CloseIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
    <path d="M4 4L12 12M12 4L4 12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
    <path d="M8 3V13M3 8H13" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const TrashIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
    <path d="M3 4H13M5 4V3C5 2.44772 5.44772 2 6 2H10C10.5523 2 11 2.44772 11 3V4M6 7V11M10 7V11M4 4L5 14H11L12 4" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

export const UserIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
    <circle cx="8" cy="5" r="3" stroke={color} strokeWidth="1.2"/>
    <path d="M3 14C3 11.2386 5.23858 9 8 9C10.7614 9 13 11.2386 13 14" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

export const AIIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
    <rect x="2" y="2" width="12" height="12" rx="2" stroke={color} strokeWidth="1.2"/>
    <circle cx="5.5" cy="6" r="1" fill={color}/>
    <circle cx="10.5" cy="6" r="1" fill={color}/>
    <path d="M5 10C5 10 6 11.5 8 11.5C10 11.5 11 10 11 10" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

export const ChevronRightIcon: React.FC<IconProps> = ({ size = 12, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" className={className}>
    <path d="M4 2L8 6L4 10" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const ChevronDownIcon: React.FC<IconProps> = ({ size = 12, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" className={className}>
    <path d="M2 4L6 8L10 4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const SettingsIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
    <circle cx="10" cy="10" r="3" stroke={color} strokeWidth="1.5"/>
    <path d="M10 2V4M10 16V18M18 10H16M4 10H2M15.66 4.34L14.24 5.76M5.76 14.24L4.34 15.66M15.66 15.66L14.24 14.24M5.76 5.76L4.34 4.34" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const AtIcon: React.FC<IconProps> = ({ size = 14, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={className}>
    <circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.2"/>
    <circle cx="7" cy="7" r="2" stroke={color} strokeWidth="1.2"/>
    <path d="M9 7V9C9 10 10 10.5 11 10" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

export const AttachIcon: React.FC<IconProps> = ({ size = 14, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={className}>
    <path d="M7 2V10C7 11.1046 6.10457 12 5 12C3.89543 12 3 11.1046 3 10V4C3 2.34315 4.34315 1 6 1H8C9.65685 1 11 2.34315 11 4V10" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
