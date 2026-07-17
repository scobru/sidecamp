import { useEffect, useRef, useState } from 'react';

interface ProgressBarProps {
  progress: number;        // 0..1
  label?: string;
  speed?: string;
  downloaded?: number;
  total?: number;
  animated?: boolean;
  className?: string;
  showPercent?: boolean;
}

export function ProgressBar({ 
  progress = 0, 
  label, 
  speed, 
  downloaded, 
  total,
  animated = true,
  className = '',
  showPercent = true
}: ProgressBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [displayProgress, setDisplayProgress] = useState(progress);

  // Smooth progress animation
  useEffect(() => {
    if (!barRef.current) return;
    const duration = 300;
    const start = displayProgress;
    const end = Math.max(0, Math.min(1, progress));
    const startTime = Date.now();
    let frameId: number;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplayProgress(start + (end - start) * eased);
      if (t < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [progress]);

  const pct = (displayProgress * 100).toFixed(1);
  
  return (
    <div className={`progress-container ${className}`}>
      {label && (
        <div className="progress-header">
          <span className="progress-label">{label}</span>
          {speed && <span className="progress-speed">{speed}</span>}
        </div>
      )}
      <div className="progress-bar-track">
        <div 
          ref={barRef}
          className={`progress-bar-fill ${animated && progress > 0 && progress < 1 ? 'animated' : ''}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={Math.round(displayProgress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label || 'Download progress'}
        >
          {showPercent && (
            <span className="progress-percent" aria-hidden="true">{pct}%</span>
          )}
        </div>
      </div>
      {(downloaded !== undefined || total !== undefined) && (
        <div className="progress-meta">
          {downloaded !== undefined && <span>{formatBytes(downloaded)}</span>}
          {total !== undefined && (
            <>
              {downloaded !== undefined && <span className="divider">/</span>}
              <span>{formatBytes(total)}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}