import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LogViewer } from './LogViewer';

describe('LogViewer Component', () => {
  it('renders empty state when there are no lines', () => {
    render(<LogViewer lines={[]} />);
    expect(screen.getByText('No logs available...')).toBeInTheDocument();
  });

  it('renders log lines correctly', () => {
    const lines = ['First log entry', 'Second log entry'];
    render(<LogViewer lines={lines} />);
    
    expect(screen.queryByText('No logs available...')).not.toBeInTheDocument();
    expect(screen.getByText('First log entry')).toBeInTheDocument();
    expect(screen.getByText('Second log entry')).toBeInTheDocument();
  });

  it('highlights matching log lines', () => {
    const lines = ['Normal log line', 'Error occurred in connection', 'Another normal line'];
    const { container } = render(<LogViewer lines={lines} highlight="Error" />);
    
    const highlighted = container.querySelector('.highlighted');
    expect(highlighted).toBeInTheDocument();
    expect(highlighted?.textContent).toBe('Error occurred in connection');
  });

  it('limits the display of logs to maxLines', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `Log line ${i}`);
    render(<LogViewer lines={lines} maxLines={10} />);
    
    // Line 0 to 39 should not be in the document
    expect(screen.queryByText('Log line 0')).not.toBeInTheDocument();
    expect(screen.queryByText('Log line 39')).not.toBeInTheDocument();
    
    // Line 40 to 49 should be in the document
    expect(screen.getByText('Log line 40')).toBeInTheDocument();
    expect(screen.getByText('Log line 49')).toBeInTheDocument();
  });
});
