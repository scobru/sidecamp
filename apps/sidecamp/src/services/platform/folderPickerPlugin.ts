import { registerPlugin } from '@capacitor/core';

export interface FolderPickerPlugin {
  pick(): Promise<{ uri: string }>;
  list(options: { uri: string }): Promise<{ files: { name: string; uri: string; isDirectory: boolean; size: number }[] }>;
  readFile(options: { uri: string }): Promise<{ data: string }>;
}

export const FolderPicker = registerPlugin<FolderPickerPlugin>('FolderPicker');
