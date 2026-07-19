import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

// Define a variable to store the captured handler
let openHandler: (event: any, filePath: string) => Promise<boolean>;

const mockShell = {
  openPath: vi.fn(),
};

const mockIpcMain = {
  handle: vi.fn((event, handler) => {
    if (event === 'downloads:open') {
      openHandler = handler;
    }
  }),
};

const mockApp = {
  getPath: vi.fn((name) => {
    if (name === 'downloads') return '/test/downloads';
    if (name === 'music') return '/test/music';
    return '/test/' + name;
  }),
  whenReady: vi.fn().mockResolvedValue(undefined),
  isPackaged: false,
  on: vi.fn(),
};

class MockBrowserWindow {
  webContents = {
    on: vi.fn(),
    send: vi.fn(),
    openDevTools: vi.fn()
  };
  loadURL = vi.fn();
  loadFile = vi.fn();
}

vi.mock('electron', () => ({
  app: mockApp,
  ipcMain: mockIpcMain,
  shell: mockShell,
  BrowserWindow: MockBrowserWindow,
  protocol: {
    registerSchemesAsPrivileged: vi.fn(),
    handle: vi.fn(),
  },
  net: { fetch: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  Menu: {
    buildFromTemplate: vi.fn(),
    setApplicationMenu: vi.fn(),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn().mockReturnValue(false),
    encryptString: vi.fn(),
    decryptString: vi.fn(),
  },
}));

describe('Downloads IPC Handlers', () => {

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import main.ts to register handlers
    await import('./main');

    if (!openHandler) throw new Error("Handler not registered");
  });

  it('should allow opening a file inside the download directory', async () => {
    const safePath = path.join('/test/downloads/Sidecamp', 'safe.txt');
    const result = await openHandler({}, safePath);
    expect(result).toBe(true);
    expect(mockShell.openPath).toHaveBeenCalledWith(path.resolve(safePath));
  });

  it('should block opening a file outside the download directory (directory traversal)', async () => {
    const maliciousPath = path.join('/test/downloads/Sidecamp', '../../etc/passwd');
    await expect(openHandler({}, maliciousPath)).rejects.toThrow('Access denied: Path is outside the download directory');
    expect(mockShell.openPath).not.toHaveBeenCalled();
  });

  it('should block opening a file outside the download directory (absolute path)', async () => {
    const maliciousPath = '/etc/passwd';
    await expect(openHandler({}, maliciousPath)).rejects.toThrow('Access denied: Path is outside the download directory');
    expect(mockShell.openPath).not.toHaveBeenCalled();
  });

  it('should block opening a file in a sibling directory (prefix attack)', async () => {
    // A path like /test/downloads/Sidecamp-Malicious/file.txt
    const siblingPath = '/test/downloads/Sidecamp-Malicious/file.txt';
    await expect(openHandler({}, siblingPath)).rejects.toThrow('Access denied: Path is outside the download directory');
    expect(mockShell.openPath).not.toHaveBeenCalled();
  });
});
