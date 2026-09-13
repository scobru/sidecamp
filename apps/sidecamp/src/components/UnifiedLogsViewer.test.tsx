import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UnifiedLogsViewer } from './UnifiedLogsViewer';

describe('UnifiedLogsViewer Component', () => {
  it('renders empty state when there are no logs', () => {
    render(
      <UnifiedLogsViewer
        libraryLogs={[]}
        dlLogs={[]}
        peerLogs={[]}
        onClearCategory={() => {}}
      />
    );
    expect(screen.getByText('No logs recorded in this category...')).toBeInTheDocument();
    expect(screen.getByText('All (0)')).toBeInTheDocument();
  });

  it('renders and displays counts for all categories', () => {
    const libraryLogs = ['[Library] Tag title updated: Cieli neri'];
    const dlLogs = ['[Library] Tag title updated: Cieli neri', '[Soulseek] Download complete: Track.mp3'];
    const peerLogs = ['[Peer] Listening on port 4000'];

    render(
      <UnifiedLogsViewer
        libraryLogs={libraryLogs}
        dlLogs={dlLogs}
        peerLogs={peerLogs}
        onClearCategory={() => {}}
      />
    );

    expect(screen.getByText('All (3)')).toBeInTheDocument();
    expect(screen.getByText('Library (1)')).toBeInTheDocument();
    expect(screen.getByText('Downloads (1)')).toBeInTheDocument();
    expect(screen.getByText('Peer Node (1)')).toBeInTheDocument();

    // Default "all" tab displays all entries
    expect(screen.getByText('[Library] Tag title updated: Cieli neri')).toBeInTheDocument();
    expect(screen.getByText('[Soulseek] Download complete: Track.mp3')).toBeInTheDocument();
    expect(screen.getByText('[Peer] Listening on port 4000')).toBeInTheDocument();
  });

  it('filters logs by clicking category tabs', () => {
    const libraryLogs = ['[Library] Tag title updated: Cieli neri'];
    const dlLogs = ['[Library] Tag title updated: Cieli neri', '[Soulseek] Download complete: Track.mp3'];
    const peerLogs = ['[Peer] Listening on port 4000'];

    render(
      <UnifiedLogsViewer
        libraryLogs={libraryLogs}
        dlLogs={dlLogs}
        peerLogs={peerLogs}
        onClearCategory={() => {}}
      />
    );

    // Click Library tab
    fireEvent.click(screen.getByText('Library (1)'));
    expect(screen.getByText('[Library] Tag title updated: Cieli neri')).toBeInTheDocument();
    expect(screen.queryByText('[Peer] Listening on port 4000')).not.toBeInTheDocument();

    // Click Downloads tab
    fireEvent.click(screen.getByText('Downloads (1)'));
    expect(screen.getByText('[Soulseek] Download complete: Track.mp3')).toBeInTheDocument();
    expect(screen.queryByText('[Peer] Listening on port 4000')).not.toBeInTheDocument();

    // Click Peer Node tab
    fireEvent.click(screen.getByText('Peer Node (1)'));
    expect(screen.getByText('[Peer] Listening on port 4000')).toBeInTheDocument();
    expect(screen.queryByText('[Soulseek] Download complete: Track.mp3')).not.toBeInTheDocument();
  });

  it('filters logs by search query', () => {
    const libraryLogs = ['[Library] Tag title updated: Cieli neri'];
    const dlLogs = ['[Library] Tag title updated: Cieli neri', '[Soulseek] Download complete: Track.mp3'];
    const peerLogs = ['[Peer] Listening on port 4000'];

    render(
      <UnifiedLogsViewer
        libraryLogs={libraryLogs}
        dlLogs={dlLogs}
        peerLogs={peerLogs}
        onClearCategory={() => {}}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search logs...');
    fireEvent.change(searchInput, { target: { value: 'Soulseek' } });

    expect(screen.getByText('[Soulseek] Download complete: Track.mp3')).toBeInTheDocument();
    expect(screen.queryByText('[Peer] Listening on port 4000')).not.toBeInTheDocument();
  });

  it('calls onClearCategory with the active category', () => {
    const onClearCategory = vi.fn();
    const peerLogs = ['[Peer] Listening on port 4000'];

    render(
      <UnifiedLogsViewer
        libraryLogs={[]}
        dlLogs={[]}
        peerLogs={peerLogs}
        onClearCategory={onClearCategory}
      />
    );

    // Switch to peer tab and click Clear
    fireEvent.click(screen.getByText('Peer Node (1)'));
    fireEvent.click(screen.getByText('Clear'));

    expect(onClearCategory).toHaveBeenCalledWith('peer');
  });
});
