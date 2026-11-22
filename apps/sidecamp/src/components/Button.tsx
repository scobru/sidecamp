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
    background: 'var(--primary)',
    color: 'var(--tc-color-primary-content, #ffffff)',
    border: '1px solid transparent',
    boxShadow: 'none',
  },
  secondary: {
    background: 'rgba(255, 255, 255, 0.05)',
    color: 'var(--text-main, #ffffff)',
    border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.12))',
    boxShadow: 'none',
  },
  accent: {
    background: 'var(--accent)',
    color: 'var(--tc-color-primary-content, #ffffff)',
    border: '1px solid transparent',
    boxShadow: 'none',
  },
  danger: {
    background: 'color-mix(in srgb, var(--danger) 15%, transparent)',
    color: 'var(--danger)',
    border: '1px solid color-mix(in srgb, var(--danger) 35%, transparent)',
    boxShadow: 'none',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-muted, #94a3b8)',
    border: '1px solid transparent',
  },
};

const SIZE_STYLES: Record<Size, CSSProperties> = {
  sm: { padding: '0.3rem 0.62rem', fontSize: '0.76rem', borderRadius: '6px' },
  md: { padding: '0.42rem 0.85rem', fontSize: '0.8rem', borderRadius: '6px' },
  lg: { padding: '0.55rem 1.1rem', fontSize: '0.88rem', borderRadius: '7px' },
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
