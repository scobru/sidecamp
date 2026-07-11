<<<<<<< SEARCH
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
=======
        try {
            await fs.promises.access(filePath);
        } catch {
            throw new Error(`File not found: ${filePath}`);
        }
>>>>>>> REPLACE
