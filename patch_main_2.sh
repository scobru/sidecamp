<<<<<<< SEARCH
ipcMain.handle('downloads:rename', async (event, filePath, newFilename) => {
  const dir = path.dirname(filePath);
  const destPath = path.join(dir, newFilename);
  fs.renameSync(filePath, destPath);
  return destPath;
});

ipcMain.handle('downloads:move', async (event, filePath, destFolder) => {
  const fileName = path.basename(filePath);
  const destPath = path.join(destFolder, fileName);
  fs.mkdirSync(destFolder, { recursive: true });
  fs.renameSync(filePath, destPath);
  return destPath;
});
=======
ipcMain.handle('downloads:rename', async (event, filePath, newFilename) => {
  const dir = path.dirname(filePath);
  const destPath = path.join(dir, newFilename);
  await fs.promises.rename(filePath, destPath);
  return destPath;
});

ipcMain.handle('downloads:move', async (event, filePath, destFolder) => {
  const fileName = path.basename(filePath);
  const destPath = path.join(destFolder, fileName);
  await fs.promises.mkdir(destFolder, { recursive: true });
  await fs.promises.rename(filePath, destPath);
  return destPath;
});
>>>>>>> REPLACE
