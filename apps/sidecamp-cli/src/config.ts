import fs from 'fs-extra';
import os from 'os';
import path from 'path';

const CONFIG_DIR = path.join(os.homedir(), '.sidecamp-cli');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

export interface CliConfig {
    server?: string;
    token?: string;
    downloadDir?: string;
}

export function loadConfig(): CliConfig {
    if (!fs.existsSync(CONFIG_PATH)) return {};
    return fs.readJsonSync(CONFIG_PATH);
}

export function saveConfig(config: CliConfig): void {
    fs.ensureDirSync(CONFIG_DIR);
    fs.writeJsonSync(CONFIG_PATH, config, { spaces: 2 });
}

export function requireServerAuth(config: CliConfig): { server: string; token: string } {
    if (!config.server || !config.token) {
        throw new Error('Not logged in. Run: sidecamp login <server> <username> <password>');
    }
    return { server: config.server, token: config.token };
}

export function downloadDir(config: CliConfig): string {
    return config.downloadDir || path.join(os.homedir(), 'sidecamp-downloads');
}
