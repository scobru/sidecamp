import React from 'react';
import classNames from 'classnames';
import styles from './Panel.module.css';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'glass' | 'solid' | 'outline';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  isInteractive?: boolean;
}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  (
    {
      children,
      variant = 'glass',
      padding = 'md',
      isInteractive = false,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={classNames(
          styles.panel,
          styles[variant],
          styles[`padding-${padding}`],
          {
            [styles.interactive]: isInteractive,
          },
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Panel.displayName = 'Panel';
