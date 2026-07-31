import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';

vi.mock('fs-extra');
vi.mock('os', () => ({
    default: {
        homedir: vi.fn(() => '/mock/home')
    }
}));

import { loadConfig, saveConfig, requireServerAuth, downloadDir } from './config';

describe('config', () => {
    const mockHomedir = '/mock/home';
    const mockConfigDir = path.join(mockHomedir, '.sidecamp-cli');
    const mockConfigPath = path.join(mockConfigDir, 'config.json');

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('loadConfig', () => {
        it('should return empty object if config file does not exist', () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);
            const config = loadConfig();
            expect(config).toEqual({});
            expect(fs.existsSync).toHaveBeenCalledWith(mockConfigPath);
            expect(fs.readJsonSync).not.toHaveBeenCalled();
        });

        it('should return config object if config file exists', () => {
            const mockConfig = { server: 'http://localhost:3000', token: 'test-token' };
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readJsonSync).mockReturnValue(mockConfig);

            const config = loadConfig();

            expect(config).toEqual(mockConfig);
            expect(fs.existsSync).toHaveBeenCalledWith(mockConfigPath);
            expect(fs.readJsonSync).toHaveBeenCalledWith(mockConfigPath);
        });
    });

    describe('saveConfig', () => {
        it('should ensure config directory exists and write config', () => {
            const mockConfig = { server: 'http://localhost:3000', token: 'test-token' };

            saveConfig(mockConfig);

            expect(fs.ensureDirSync).toHaveBeenCalledWith(mockConfigDir);
            expect(fs.writeJsonSync).toHaveBeenCalledWith(mockConfigPath, mockConfig, { spaces: 2 });
        });
    });

    describe('requireServerAuth', () => {
        it('should throw error if server is missing', () => {
            expect(() => requireServerAuth({ token: 'test' })).toThrow(/Not logged in/);
        });

        it('should throw error if token is missing', () => {
            expect(() => requireServerAuth({ server: 'http://localhost' })).toThrow(/Not logged in/);
        });

        it('should return server and token if both exist', () => {
            const result = requireServerAuth({ server: 'http://localhost', token: 'test' });
            expect(result).toEqual({ server: 'http://localhost', token: 'test' });
        });
    });

    describe('downloadDir', () => {
        it('should return configured downloadDir if set', () => {
            const result = downloadDir({ downloadDir: '/custom/downloads' });
            expect(result).toBe('/custom/downloads');
        });

        it('should return default download directory if not set', () => {
            const result = downloadDir({});
            expect(result).toBe(path.join(mockHomedir, 'sidecamp-downloads'));
        });
    });
});
