import { registerPlugin } from '@capacitor/core';

export interface PeerSharingPlugin {
  start(): Promise<{ success: boolean }>;
  stop(): Promise<{ success: boolean }>;
}

export const PeerSharing = registerPlugin<PeerSharingPlugin>('PeerSharing');
