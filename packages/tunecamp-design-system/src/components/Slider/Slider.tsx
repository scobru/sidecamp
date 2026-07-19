import React, { forwardRef } from 'react';
import classNames from 'classnames';
import styles from './Slider.module.css';

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  glowColor?: 'cyan' | 'magenta' | 'none';
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      className,
      glowColor = 'cyan',
      ...props
    },
    ref
  ) => {
    // Generate a style object to handle dynamic progress bar via CSS vars
    const max = Number(props.max) || 100;
    const min = Number(props.min) || 0;
    const value = Number(props.value) || 0;
    const percentage = ((value - min) / (max - min)) * 100;

    return (
      <div className={classNames(styles.wrapper, className)}>
        <input
          type="range"
          ref={ref}
          className={classNames(styles.slider, styles[`glow-${glowColor}`])}
          style={{ '--slider-progress': `${percentage}%` } as React.CSSProperties}
          {...props}
        />
      </div>
    );
  }
);

Slider.displayName = 'Slider';
