import { useEffect, useRef, useState } from 'react';

interface LogViewerProps {
  lines: string[];
  highlight?: string;
  maxLines?: number;
  height?: string;
}

export function LogViewer({ lines, highlight, maxLines = 200, height = '220px' }: LogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldScroll, setShouldScroll] = useState(true);

  useEffect(() => {
    if (shouldScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, shouldScroll]);

  const visibleLines = lines.slice(-maxLines);

  return (
    <div className="log-viewer" style={{ height }}>
      <div 
        ref={containerRef}
        className="log-body"
        onWheel={() => setShouldScroll(false)}
        onScroll={() => {
          if (!containerRef.current) return;
          const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
          setShouldScroll(scrollTop + clientHeight >= scrollHeight - 20);
        }}
      >
        {visibleLines.length === 0 && (
          <div className="log-line empty-state">
            <span className="empty-icon">📭</span>
            <span>No logs available...</span>
          </div>
        )}
        {visibleLines.map((log, i) => (
          <div 
            key={i} 
            className={`log-line ${highlight && log.includes(highlight) ? 'highlighted' : ''}`}
          >
            {log}
          </div>
        ))}
      </div>
    </div>
  );
}