import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

/*
 * Saving a file to the user's device.
 *
 * The Capacitor WebView does not handle blob/anchor downloads at all, so on
 * the native app we write the file to the app cache and open the system share
 * sheet (from there the user can save to Files/Download, or send it anywhere).
 * On the web it's a regular blob download.
 *
 * Pass exactly one of `text` (UTF-8 string) or `base64` (raw content, no
 * data: prefix). Returns { canceled } — canceled=true when the user dismisses
 * the native share sheet, so callers can skip the success toast.
 */
export async function saveOrShareFile({ fileName, mimeType, text, base64 }) {
  if (Capacitor.isNativePlatform()) {
    const data = base64 ?? utf8ToBase64(text ?? "");
    const written = await Filesystem.writeFile({
      path: fileName,
      data,
      directory: Directory.Cache,
    });
    try {
      await Share.share({ title: fileName, url: written.uri });
      return { canceled: false, method: "share" };
    } catch (e) {
      // Dismissing the Android share sheet rejects — not an error.
      if (/cancel/i.test(e?.message || "")) return { canceled: true, method: "share" };
      throw e;
    }
  }

  const blob =
    base64 != null
      ? base64ToBlob(base64, mimeType)
      : new Blob([text ?? ""], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { canceled: false, method: "download" };
}

/** Convenience for data: URLs (viewer images/PDFs). */
export async function saveOrShareDataUrl(dataUrl, fileName) {
  const comma = dataUrl.indexOf(",");
  const meta = dataUrl.slice(0, comma);
  const mimeType = (meta.match(/^data:([^;]+)/) || [])[1] || "application/octet-stream";
  return saveOrShareFile({ fileName, mimeType, base64: dataUrl.slice(comma + 1) });
}

function utf8ToBase64(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBlob(b64, mimeType) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}
