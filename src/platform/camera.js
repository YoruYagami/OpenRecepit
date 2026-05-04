// Cross-platform image picker. Returns an array of { dataUrl, name } objects,
// or null if the caller should fall back to a hidden <input type="file">.
import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();

async function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/**
 * @param {{ source: 'camera' | 'gallery' }} opts
 * @returns {Promise<Array<{dataUrl: string, name: string}> | null>}
 */
export async function pickImagesNative({ source }) {
  if (!isNative()) return null;
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

  if (source === 'camera') {
    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      saveToGallery: false,
    });
    return [
      {
        dataUrl: photo.dataUrl,
        name: `photo_${Date.now()}.${photo.format || 'jpg'}`,
      },
    ];
  }

  // Multi-select from gallery
  const result = await Camera.pickImages({
    quality: 85,
    limit: 0, // 0 = unlimited
  });
  if (!result?.photos?.length) return [];
  const out = [];
  for (let i = 0; i < result.photos.length; i++) {
    const p = result.photos[i];
    const url = p.webPath || p.path;
    if (!url) continue;
    const resp = await fetch(url);
    const blob = await resp.blob();
    const dataUrl = await blobToDataURL(blob);
    out.push({ dataUrl, name: `gallery_${Date.now()}_${i}.${p.format || 'jpg'}` });
  }
  return out;
}
