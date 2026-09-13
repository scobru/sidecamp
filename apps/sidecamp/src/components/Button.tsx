import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  icon?: ReactNode;
  glowColor?: string;
  children?: ReactNode;
  style?: CSSProperties;
}

const VARIANT_STYLES: Record<Variant, CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, var(--primary, #a855f7) 0%, #ec4899 100%)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    boxShadow: '0 2px 10px rgba(168, 85, 247, 0.25)',
  },
  secondary: {
    background: 'rgba(255, 255, 255, 0.05)',
    color: 'var(--text-main, #ffffff)',
    border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.12))',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
  },
  accent: {
    background: 'linear-gradient(135deg, var(--accent, #06b6d4) 0%, var(--primary, #a855f7) 100%)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    boxShadow: '0 2px 10px rgba(6, 182, 212, 0.25)',
  },
  danger: {
    background: 'var(--danger, #ef4444)',
    color: '#ffffff',
    border: 'none',
    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-muted, #94a3b8)',
    border: '1px solid transparent',
  },
};

const SIZE_STYLES: Record<Size, CSSProperties> = {
  sm: { padding: '0.4rem 0.8rem', fontSize: '0.82rem', borderRadius: '8px' },
  md: { padding: '0.55rem 1.15rem', fontSize: '0.88rem', borderRadius: '10px' },
  lg: { padding: '0.75rem 1.5rem', fontSize: '0.98rem', borderRadius: '12px' },
};

export function Button({
  variant = 'secondary',
  size = 'md',
  leftIcon,
  rightIcon,
  icon,
  glowColor,
  children,
  style,
  disabled,
  className = '',
  ...rest
}: ButtonProps) {
  const leadingIcon = leftIcon || icon;
  const glowStyle: CSSProperties = glowColor
    ? { boxShadow: `0 0 14px ${glowColor}` }
    : {};

  return (
    <button
      disabled={disabled}
      className={`app-btn ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.45rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        fontFamily: 'inherit',
        fontWeight: 600,
        lineHeight: 1,
        userSelect: 'none',
        whiteSpace: 'nowrap',
        ...VARIANT_STYLES[variant],
        ...SIZE_STYLES[size],
        ...glowStyle,
        ...style,
      }}
      {...rest}
    >
      {leadingIcon}
      {children}
      {rightIcon}
    </button>
  );
}
