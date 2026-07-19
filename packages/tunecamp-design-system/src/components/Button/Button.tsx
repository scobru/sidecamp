import React from 'react';
import classNames from 'classnames';
import styles from './Button.module.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  isFullWidth?: boolean;
  glowColor?: 'cyan' | 'magenta' | 'none';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isFullWidth = false,
      glowColor = 'none',
      leftIcon,
      rightIcon,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={classNames(
          styles.button,
          styles[variant],
          styles[size],
          {
            [styles.fullWidth]: isFullWidth,
            [styles[`glow-${glowColor}`]]: glowColor !== 'none' && variant === 'primary',
          },
          className
        )}
        {...props}
      >
        {leftIcon && <span className={styles.icon}>{leftIcon}</span>}
        <span className={styles.content}>{children}</span>
        {rightIcon && <span className={styles.icon}>{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
