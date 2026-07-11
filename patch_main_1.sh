<<<<<<< SEARCH
    if (fs.existsSync(normalizedPath)) {
      fs.unlinkSync(normalizedPath);
      // Clean up empty directories
      const dir = path.dirname(normalizedPath);
      if (dir !== downloadDir && fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        if (files.length === 0) {
          fs.rmdirSync(dir);
        }
      }
      return true;
    }
=======
    try {
      await fs.promises.access(normalizedPath);
      await fs.promises.unlink(normalizedPath);
      // Clean up empty directories
      const dir = path.dirname(normalizedPath);
      if (dir !== downloadDir) {
        try {
          await fs.promises.access(dir);
          const files = await fs.promises.readdir(dir);
          if (files.length === 0) {
            await fs.promises.rmdir(dir);
          }
        } catch {
          // ignore
        }
      }
      return true;
    } catch {
      // file does not exist
    }
>>>>>>> REPLACE
