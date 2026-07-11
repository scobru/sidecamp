import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

const TEST_DIR = path.join(process.cwd(), 'bench_test_dir');

async function setup() {
    if (fs.existsSync(TEST_DIR)) {
        await fs.promises.rm(TEST_DIR, { recursive: true, force: true });
    }
    await fs.promises.mkdir(TEST_DIR);
    for (let i = 0; i < 5000; i++) {
        await fs.promises.writeFile(path.join(TEST_DIR, `file_${i}.txt`), 'test');
    }
}

async function cleanup() {
    await fs.promises.rm(TEST_DIR, { recursive: true, force: true });
}

function measureEventLoopLag(ms: number) {
    return new Promise<number>((resolve) => {
        const start = performance.now();
        setTimeout(() => {
            resolve(performance.now() - start - ms);
        }, ms);
    });
}

function walkDirSync(dir: string, files: string[] = []) {
    const list = fs.readdirSync(dir);
    for (const item of list) {
        const itemPath = path.join(dir, item);
        try {
            const stat = fs.statSync(itemPath);
            if (stat.isDirectory()) {
                walkDirSync(itemPath, files);
            } else {
                files.push(itemPath);
            }
        } catch (e) {}
    }
    return files;
}

async function walkDirAsync(dir: string, files: string[] = []) {
    const list = await fs.promises.readdir(dir);
    for (const item of list) {
        const itemPath = path.join(dir, item);
        try {
            const stat = await fs.promises.stat(itemPath);
            if (stat.isDirectory()) {
                await walkDirAsync(itemPath, files);
            } else {
                files.push(itemPath);
            }
        } catch (e) {}
    }
    return files;
}

async function run() {
    console.log("Setting up test directory with 5000 files...");
    await setup();

    console.log("\n--- BENCHMARK ---");

    // Warmup
    walkDirSync(TEST_DIR);
    await walkDirAsync(TEST_DIR);

    // Sync Test
    let lagPromise = measureEventLoopLag(10);
    const startSync = performance.now();
    walkDirSync(TEST_DIR);
    const syncTime = performance.now() - startSync;
    let lagSync = await lagPromise;
    console.log(`Sync method took: ${syncTime.toFixed(2)}ms`);
    console.log(`Event loop blocked for: ${Math.max(0, lagSync).toFixed(2)}ms`);

    // Async Test
    lagPromise = measureEventLoopLag(10);
    const startAsync = performance.now();
    await walkDirAsync(TEST_DIR);
    const asyncTime = performance.now() - startAsync;
    let lagAsync = await lagPromise;
    console.log(`Async method took: ${asyncTime.toFixed(2)}ms`);
    console.log(`Event loop blocked for: ${Math.max(0, lagAsync).toFixed(2)}ms`);

    await cleanup();
}

run().catch(console.error);
