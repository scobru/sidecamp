import React from 'react';
import classNames from 'classnames';
import styles from './Typography.module.css';

export interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'small' | 'caption';
  color?: 'primary' | 'secondary' | 'tertiary' | 'accent-cyan' | 'accent-magenta';
  weight?: 'normal' | 'medium' | 'bold';
  align?: 'left' | 'center' | 'right';
  as?: React.ElementType;
}

export const Typography = React.forwardRef<HTMLElement, TypographyProps>(
  (
    {
      children,
      variant = 'body',
      color = 'primary',
      weight,
      align = 'left',
      as,
      className,
      ...props
    },
    ref
  ) => {
    const Component = as || getElementForVariant(variant);

    return (
      <Component
        ref={ref as React.Ref<any>}
        className={classNames(
          styles.text,
          styles[variant],
          styles[`color-${color}`],
          styles[`align-${align}`],
          {
            [styles[`weight-${weight}`]]: weight,
          },
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Typography.displayName = 'Typography';

function getElementForVariant(variant: TypographyProps['variant']): React.ElementType {
  switch (variant) {
    case 'h1': return 'h1';
    case 'h2': return 'h2';
    case 'h3': return 'h3';
    case 'h4': return 'h4';
    case 'small': return 'small';
    case 'caption': return 'span';
    case 'body':
    default:
      return 'p';
  }
}
