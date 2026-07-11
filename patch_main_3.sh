<<<<<<< SEARCH
  try {
    if (fs.existsSync(dest)) return { error: 'An item with that name already exists there' };
    try {
      await fs.promises.rename(src, dest);
=======
  try {
    try {
      await fs.promises.access(dest);
      return { error: 'An item with that name already exists there' };
    } catch {
      // file does not exist, safe to proceed
    }
    try {
      await fs.promises.rename(src, dest);
>>>>>>> REPLACE
