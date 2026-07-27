#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexPath = path.resolve(__dirname, '../src/index.ts');

const child = spawn(process.execPath, ['--import', 'tsx', indexPath, ...process.argv.slice(2)], {
    stdio: 'inherit',
    cwd: process.cwd(),
});

child.on('exit', (code) => {
    process.exit(code ?? 0);
});
