import { Capacitor } from '@capacitor/core';
import { createCapacitorAdapter } from './capacitorAdapter';

export interface PlatformInfo {
  isElectron: boolean;
  isCapacitor: boolean;
  isNativeMobile: boolean;
  platform: 'electron' | 'android' | 'ios' | 'web';
}

export function detectPlatform(): PlatformInfo {
  const isElectron = typeof window !== 'undefined' && 'electronAPI' in window && !!(window as any).electronAPI;
  const isCapacitor = Capacitor.isNativePlatform();
  const capPlatform = Capacitor.getPlatform();

  let platform: 'electron' | 'android' | 'ios' | 'web' = 'web';
  if (isElectron) {
    platform = 'electron';
  } else if (capPlatform === 'android') {
    platform = 'android';
  } else if (capPlatform === 'ios') {
    platform = 'ios';
  }

  return {
    isElectron,
    isCapacitor,
    isNativeMobile: capPlatform === 'android' || capPlatform === 'ios',
    platform,
  };
}

export const currentPlatform = detectPlatform();
const capacitorAdapter = createCapacitorAdapter();

export const platformAPI: any = currentPlatform.isElectron
  ? (window as any).electronAPI
  : capacitorAdapter;

export default platformAPI;
