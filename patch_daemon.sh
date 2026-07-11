<<<<<<< SEARCH
        for (const folder of allFolders) {
            if (fs.existsSync(folder)) {
                this.walkDir(folder, files);
            }
        }
=======
        for (const folder of allFolders) {
            try {
                await fs.promises.access(folder);
                await this.walkDir(folder, files);
            } catch {
                // ignore if folder doesn't exist
            }
        }
>>>>>>> REPLACE
<<<<<<< SEARCH
    private walkDir(dir: string, files: string[] = []) {
        const list = fs.readdirSync(dir);
        for (const item of list) {
            const itemPath = path.join(dir, item);
            try {
                const stat = fs.statSync(itemPath);
                if (stat.isDirectory()) {
                    this.walkDir(itemPath, files);
                } else {
                    files.push(itemPath);
                }
            } catch (e) {}
        }
    }
=======
    private async walkDir(dir: string, files: string[] = []) {
        const list = await fs.promises.readdir(dir);
        for (const item of list) {
            const itemPath = path.join(dir, item);
            try {
                const stat = await fs.promises.stat(itemPath);
                if (stat.isDirectory()) {
                    await this.walkDir(itemPath, files);
                } else {
                    files.push(itemPath);
                }
            } catch (e) {}
        }
    }
>>>>>>> REPLACE
