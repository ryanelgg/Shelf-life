import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { User, PantryItem, WasteLog } from '../types';

interface ExportPayload {
  exportedAt: string;
  appVersion: string;
  user: User | null;
  pantryItems: PantryItem[];
  wasteLogs: WasteLog[];
  preferences: {
    theme: string;
    avoAiConsent: 'granted' | 'declined' | null;
    notificationsEnabled: boolean | null;
  };
}

export interface ExportInput {
  user: User | null;
  pantryItems: PantryItem[];
  wasteLogs: WasteLog[];
  theme: string;
  avoAiConsent: 'granted' | 'declined' | null;
  notificationsEnabled: boolean | null;
}

function buildPayload(input: ExportInput): ExportPayload {
  return {
    exportedAt: new Date().toISOString(),
    appVersion: '1.0.0',
    user: input.user,
    pantryItems: input.pantryItems,
    wasteLogs: input.wasteLogs,
    preferences: {
      theme: input.theme,
      avoAiConsent: input.avoAiConsent,
      notificationsEnabled: input.notificationsEnabled,
    },
  };
}

function timestampedFilename(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `pantre-data-${yyyy}-${mm}-${dd}.json`;
}

export async function exportUserData(input: ExportInput): Promise<void> {
  const payload = buildPayload(input);
  const json = JSON.stringify(payload, null, 2);
  const filename = timestampedFilename();

  if (Capacitor.isNativePlatform()) {
    // Write to documents directory, then open the iOS share sheet so the user
    // can save to Files, AirDrop, email it to themselves, etc.
    const writeRes = await Filesystem.writeFile({
      path: filename,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });

    await Share.share({
      title: 'Your Pantre data',
      text: 'Here is your Pantre data export.',
      url: writeRes.uri,
      dialogTitle: 'Save your data',
    });
  } else {
    // Web fallback: trigger a download via blob URL.
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
