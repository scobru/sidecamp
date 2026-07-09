import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDownloads } from './useDownloads';

describe('useDownloads hook', () => {
  it('should initialize with empty states', () => {
    const { result } = renderHook(() => useDownloads());
    expect(result.current.dlLogs).toEqual([]);
    expect(result.current.activeDownloads).toEqual([]);
    expect(result.current.downloadedFiles).toEqual([]);
  });

  it('should add log and format with timestamp', () => {
    const { result } = renderHook(() => useDownloads());
    
    act(() => {
      result.current.addLog('Started download');
    });

    expect(result.current.dlLogs.length).toBe(1);
    expect(result.current.dlLogs[0]).toContain('Started download');
  });

  it('should limit logs to max 50 items', () => {
    const { result } = renderHook(() => useDownloads());

    act(() => {
      for (let i = 0; i < 60; i++) {
        result.current.addLog(`Log ${i}`);
      }
    });

    expect(result.current.dlLogs.length).toBe(50);
    // The first one should be "Log 10" since 0-9 are discarded
    expect(result.current.dlLogs[0]).toContain('Log 10');
    expect(result.current.dlLogs[49]).toContain('Log 59');
  });

  it('should add and update downloads correctly', () => {
    const { result } = renderHook(() => useDownloads());

    // Add first download
    act(() => {
      result.current.updateDownload({ id: 'test-id-1', progress: 0.1, name: 'File 1' });
    });

    expect(result.current.activeDownloads).toHaveLength(1);
    expect(result.current.activeDownloads[0]).toEqual({
      id: 'test-id-1',
      name: 'File 1',
      progress: 0.1,
      status: 'downloading',
    });

    // Update the download progress
    act(() => {
      result.current.updateDownload({ id: 'test-id-1', progress: 0.5 });
    });

    expect(result.current.activeDownloads).toHaveLength(1);
    expect(result.current.activeDownloads[0].progress).toBe(0.5);
    expect(result.current.activeDownloads[0].status).toBe('downloading');

    // Update the download to completed
    act(() => {
      result.current.updateDownload({ id: 'test-id-1', progress: 1.0 });
    });

    expect(result.current.activeDownloads[0].status).toBe('completed');

    // Update the download to seeding
    act(() => {
      result.current.updateDownload({ id: 'test-id-1', seeding: true });
    });

    expect(result.current.activeDownloads[0].status).toBe('seeding');
  });

  it('should remove download by ID', () => {
    const { result } = renderHook(() => useDownloads());

    act(() => {
      result.current.updateDownload({ id: 'id-1', progress: 0.2 });
      result.current.updateDownload({ id: 'id-2', progress: 0.4 });
    });

    expect(result.current.activeDownloads).toHaveLength(2);

    act(() => {
      result.current.removeDownload('id-1');
    });

    expect(result.current.activeDownloads).toHaveLength(1);
    expect(result.current.activeDownloads[0].id).toBe('id-2');
  });
});
