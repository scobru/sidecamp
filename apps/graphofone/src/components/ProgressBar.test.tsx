import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with basic props and shows percentage', () => {
    render(<ProgressBar progress={0.5} label="Downloading Test" />);
    
    // Advance fake timers by 300ms to complete animation
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Check if the label is displayed
    expect(screen.getByText('Downloading Test')).toBeInTheDocument();
    
    // Check if progress percent is visible (0.5 * 100 = 50.0)
    expect(screen.getByText('50.0%')).toBeInTheDocument();

    // Check accessibility role and values
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '50');
    expect(progressBar).toHaveAttribute('aria-label', 'Downloading Test');
  });

  it('renders with custom speed and downloaded/total meta sizes', () => {
    render(
      <ProgressBar 
        progress={0.25} 
        label="Syncing" 
        speed="1.2 MB/s" 
        downloaded={1024 * 1024} 
        total={4 * 1024 * 1024} 
      />
    );

    // Advance fake timers to finish animation
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Verify speed
    expect(screen.getByText('1.2 MB/s')).toBeInTheDocument();

    // Verify formatted bytes
    expect(screen.getByText('1.00 MB')).toBeInTheDocument();
    expect(screen.getByText('4.00 MB')).toBeInTheDocument();
  });

  it('hides percent when showPercent is false', () => {
    render(<ProgressBar progress={0.75} showPercent={false} />);
    
    // Advance fake timers to finish animation
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByText('75.0%')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<ProgressBar progress={0.3} className="custom-class" />);
    
    // Advance fake timers to finish animation
    act(() => {
      vi.advanceTimersByTime(300);
    });

    const wrapper = container.querySelector('.progress-container');
    expect(wrapper).toHaveClass('custom-class');
  });
});
