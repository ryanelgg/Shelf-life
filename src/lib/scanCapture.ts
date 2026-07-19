import { Camera, CameraSource, CameraResultType } from '@capacitor/camera';

// Shared camera-capture helpers for the receipt/fridge scan flows. Kept in one
// place so the + menu (App.tsx) can open the camera straight from the home page
// while AddItemScreen still owns the review UI.

export function isCancelledError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('cancel') || message.includes('dismiss');
  }
  return false;
}

/**
 * Open the native camera and return the photo as a base64 string, or null if
 * nothing came back. `source` mirrors the two existing flows: receipts are
 * snapped in the moment (Camera), a fridge photo may come from the library
 * (Prompt). Rethrows on real errors; the caller treats a cancel as "stay put".
 */
export async function capturePhotoBase64(source: 'camera' | 'prompt'): Promise<string | null> {
  const photo = await Camera.getPhoto({
    source: source === 'camera' ? CameraSource.Camera : CameraSource.Prompt,
    resultType: CameraResultType.Base64,
    quality: 80,
  });
  return photo.base64String ?? null;
}
