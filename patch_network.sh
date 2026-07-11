<<<<<<< SEARCH
    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
    }
=======
    try {
      await fs.promises.access(this.downloadDir);
    } catch {
      await fs.promises.mkdir(this.downloadDir, { recursive: true });
    }
>>>>>>> REPLACE
