import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', color: '#e5484d', background: '#1a1a1a', minHeight: '100vh', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          <h2>Sidecamp crashed</h2>
          <p>{this.state.error.message}</p>
          <p style={{ opacity: 0.7, fontSize: '0.8rem' }}>{this.state.error.stack}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
