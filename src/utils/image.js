import { b64urlEncode } from "./security.js";
import { readFile } from "./file.js";

function encodeCanvas(source, maxDim, quality) {
  const srcW = source.width;
  const srcH = source.height;
  const longest = Math.max(srcW, srcH);
  const scale = longest > maxDim ? maxDim / longest : 1;
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

async function loadImageElement(file) {
  const dataUrl = await readFile(file, { as: "dataURL" });
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
}

export async function fileToResizedDataURL(file, maxDim = 1280, quality = 0.85) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      try {
        return encodeCanvas(bitmap, maxDim, quality);
      } finally {
        if (typeof bitmap.close === "function") bitmap.close();
      }
    } catch {
      // fall through to HTMLImageElement path
    }
  }
  const img = await loadImageElement(file);
  return encodeCanvas(img, maxDim, quality);
}

export async function fileSha256(file) {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return b64urlEncode(hash);
}
