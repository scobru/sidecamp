import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
  style?: CSSProperties;
}

const VARIANT_STYLES: Record<Variant, CSSProperties> = {
  primary:   { background: 'var(--primary, #6366f1)',   color: '#fff',                       border: 'none' },
  secondary: { background: 'var(--glass-bg, rgba(255,255,255,0.08))', color: 'var(--text-main, #fff)', border: '1px solid var(--glass-border, rgba(255,255,255,0.15))' },
  accent:    { background: 'var(--secondary, #8b5cf6)', color: '#fff',                       border: 'none' },
  danger:    { background: 'var(--danger, #e5484d)',    color: '#fff',                       border: 'none' },
  ghost:     { background: 'transparent',               color: 'var(--text-muted, #aaa)',    border: 'none' },
};

const SIZE_STYLES: Record<Size, CSSProperties> = {
  sm: { padding: '0.3rem 0.7rem', fontSize: '0.8rem', borderRadius: '6px' },
  md: { padding: '0.5rem 1rem',   fontSize: '0.9rem', borderRadius: '8px' },
  lg: { padding: '0.7rem 1.4rem', fontSize: '1rem',   borderRadius: '10px' },
};

export function Button({
  variant = 'secondary',
  size = 'md',
  children,
  style,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.4rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'opacity 0.15s, filter 0.15s',
        fontFamily: 'inherit',
        fontWeight: 600,
        lineHeight: 1,
        ...VARIANT_STYLES[variant],
        ...SIZE_STYLES[size],
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
