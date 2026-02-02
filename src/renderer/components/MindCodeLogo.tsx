/** MindCode Logo - 液态玻璃3D钻石M图标，科技紫蓝色调，主题自适应 */
import React from 'react';
interface MindCodeLogoProps { size?: number; className?: string; }

export const MindCodeLogo: React.FC<MindCodeLogoProps> = ({ size = 72, className = '' }) => {
  const uid = React.useId().replace(/:/g, '');
  return (
    <svg className={`mindcode-logo ${className}`} viewBox="0 0 100 100" width={size} height={size}
      style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4)) drop-shadow(0 0 20px var(--logo-glow, rgba(139,92,246,0.3)))' }}>
      <defs>
        {/* 液态玻璃效果滤镜 */}
        <filter id={`glass-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur"/>
          <feOffset in="blur" dx="1" dy="2" result="offsetBlur"/>
          <feComposite in="SourceGraphic" in2="offsetBlur" operator="over"/>
        </filter>
        {/* 内发光效果 */}
        <filter id={`innerGlow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feComposite in2="SourceAlpha" operator="in"/>
          <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        {/* 玻璃主体渐变 - 半透明科技感 */}
        <linearGradient id={`glassMain-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--logo-base-light, #e8e8f0)" stopOpacity="0.95"/>
          <stop offset="30%" stopColor="var(--logo-accent-1, #8b5cf6)" stopOpacity="0.15"/>
          <stop offset="70%" stopColor="var(--logo-accent-2, #3b82f6)" stopOpacity="0.12"/>
          <stop offset="100%" stopColor="var(--logo-base-mid, #9090a8)" stopOpacity="0.9"/>
        </linearGradient>
        {/* 顶部高光面 - 玻璃反射 */}
        <linearGradient id={`glassTop-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5"/>
          <stop offset="50%" stopColor="var(--logo-accent-1, #a78bfa)" stopOpacity="0.2"/>
          <stop offset="100%" stopColor="var(--logo-base-mid, #b0b0c0)" stopOpacity="0.7"/>
        </linearGradient>
        {/* 左侧面 - 青色玻璃折射 */}
        <linearGradient id={`glassLeft-${uid}`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--logo-base-light, #d0d0e0)" stopOpacity="0.85"/>
          <stop offset="40%" stopColor="var(--logo-accent-3, #06b6d4)" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="var(--logo-base-dark, #606878)" stopOpacity="0.8"/>
        </linearGradient>
        {/* 右侧面 - 蓝色玻璃折射 */}
        <linearGradient id={`glassRight-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--logo-base-mid, #b8b8c8)" stopOpacity="0.85"/>
          <stop offset="50%" stopColor="var(--logo-accent-2, #3b82f6)" stopOpacity="0.2"/>
          <stop offset="100%" stopColor="var(--logo-base-dark, #505868)" stopOpacity="0.75"/>
        </linearGradient>
        {/* 底部深色玻璃 */}
        <linearGradient id={`glassBot-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--logo-base-dark, #505060)" stopOpacity="0.9"/>
          <stop offset="50%" stopColor="var(--logo-accent-1, #8b5cf6)" stopOpacity="0.1"/>
          <stop offset="100%" stopColor="var(--logo-base-shadow, #303040)" stopOpacity="0.95"/>
        </linearGradient>
        {/* M字母玻璃渐变 */}
        <linearGradient id={`glassM-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--logo-base-light, #d8d8e8)" stopOpacity="0.95"/>
          <stop offset="30%" stopColor="var(--logo-accent-1, #a78bfa)" stopOpacity="0.3"/>
          <stop offset="70%" stopColor="var(--logo-accent-2, #60a5fa)" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="var(--logo-base-mid, #8888a0)" stopOpacity="0.9"/>
        </linearGradient>
        {/* M高光 */}
        <linearGradient id={`mHighlight-${uid}`} x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="var(--logo-accent-2, #60a5fa)" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.6"/>
        </linearGradient>
        {/* 边缘光晕 */}
        <linearGradient id={`edgeGlow-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--logo-accent-1, #8b5cf6)" stopOpacity="0.6"/>
          <stop offset="50%" stopColor="var(--logo-accent-2, #3b82f6)" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="var(--logo-accent-3, #06b6d4)" stopOpacity="0.5"/>
        </linearGradient>
      </defs>
      <g filter={`url(#glass-${uid})`}>
        {/* 外框玻璃底层 */}
        <polygon points="50,2 82,14 98,50 82,86 50,98 18,86 2,50 18,14" fill={`url(#glassMain-${uid})`}/>
        {/* 顶部高光切面 */}
        <polygon points="50,2 82,14 50,32" fill={`url(#glassTop-${uid})`}/>
        <polygon points="50,2 50,32 18,14" fill={`url(#glassTop-${uid})`}/>
        {/* 上侧面 */}
        <polygon points="82,14 98,50 50,32" fill="var(--logo-base-light, #c8c8d8)" fillOpacity="0.85"/>
        <polygon points="18,14 50,32 2,50" fill="var(--logo-base-light, #d8d8e8)" fillOpacity="0.9"/>
        {/* 中部玻璃切面 */}
        <polygon points="98,50 82,86 50,50 50,32" fill={`url(#glassRight-${uid})`}/>
        <polygon points="2,50 50,32 50,50 18,86" fill={`url(#glassLeft-${uid})`}/>
        {/* 底部切面 */}
        <polygon points="50,50 82,86 50,98" fill={`url(#glassBot-${uid})`}/>
        <polygon points="50,50 50,98 18,86" fill="var(--logo-base-shadow, #383848)" fillOpacity="0.9"/>
        {/* 玻璃内部反射线 */}
        <line x1="50" y1="2" x2="50" y2="32" stroke={`url(#edgeGlow-${uid})`} strokeWidth="0.8"/>
        <line x1="50" y1="32" x2="82" y2="14" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5"/>
        <line x1="50" y1="32" x2="18" y2="14" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5"/>
        <line x1="50" y1="32" x2="98" y2="50" stroke="var(--logo-accent-2, #3b82f6)" strokeWidth="0.4" strokeOpacity="0.4"/>
        <line x1="50" y1="32" x2="2" y2="50" stroke="var(--logo-accent-3, #06b6d4)" strokeWidth="0.4" strokeOpacity="0.4"/>
        <line x1="50" y1="32" x2="50" y2="50" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4"/>
        <line x1="50" y1="50" x2="82" y2="86" stroke="var(--logo-accent-2, #3b82f6)" strokeWidth="0.4" strokeOpacity="0.3"/>
        <line x1="50" y1="50" x2="18" y2="86" stroke="var(--logo-accent-3, #06b6d4)" strokeWidth="0.4" strokeOpacity="0.3"/>
        <line x1="50" y1="50" x2="50" y2="98" stroke={`url(#edgeGlow-${uid})`} strokeWidth="0.6" strokeOpacity="0.5"/>
        {/* M字母 - 液态玻璃效果，居中在钻石内 */}
        <polygon points="30,70 30,38 41,38 50,50 59,38 70,38 70,70 61,70 61,50 50,62 39,50 39,70" fill={`url(#glassM-${uid})`}/>
        {/* M顶部高光 */}
        <polygon points="30,38 41,38 41,42 30,42" fill={`url(#mHighlight-${uid})`}/>
        <polygon points="59,38 70,38 70,42 59,42" fill={`url(#mHighlight-${uid})`}/>
        {/* M左侧反射高光 */}
        <polygon points="30,38 33,38 33,70 30,70" fill="rgba(255,255,255,0.35)"/>
        {/* M右侧阴影 */}
        <polygon points="67,38 70,38 70,70 67,70" fill="var(--logo-base-dark, #505060)" fillOpacity="0.5"/>
        {/* M中心V高光 */}
        <polygon points="41,38 50,50 59,38 50,44" fill="rgba(255,255,255,0.45)"/>
        {/* M底部V反射 */}
        <polygon points="50,62 39,50 41,48 50,58 59,48 61,50" fill="var(--logo-accent-2, #3b82f6)" fillOpacity="0.25"/>
        {/* 顶部边缘强高光 */}
        <line x1="50" y1="2" x2="82" y2="14" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/>
        <line x1="50" y1="2" x2="18" y2="14" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5"/>
        {/* 外框发光边 */}
        <polygon points="50,2 82,14 98,50 82,86 50,98 18,86 2,50 18,14" fill="none" stroke={`url(#edgeGlow-${uid})`} strokeWidth="1" strokeOpacity="0.4"/>
        {/* 玻璃光斑 */}
        <ellipse cx="35" cy="22" rx="8" ry="4" fill="rgba(255,255,255,0.15)" transform="rotate(-25 35 22)"/>
        <ellipse cx="70" cy="35" rx="5" ry="2.5" fill="rgba(255,255,255,0.1)" transform="rotate(30 70 35)"/>
      </g>
    </svg>
  );
};
export default MindCodeLogo;
