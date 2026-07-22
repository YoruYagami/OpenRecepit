import React, { useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

/*
 * Promise-based file intake: `pickFiles({ source }) → Promise<File[]>`.
 *
 * Camera on the native app goes through the Capacitor Camera plugin (the
 * WebView's <input capture> is unreliable and often falls back to the
 * gallery); on the web it uses the hidden capture input. Gallery uses the
 * file input everywhere and also accepts PDFs (e.g. Revolut receipts).
 */
export function useFilePicker() {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const pendingRef = useRef(null);

  const settle = (files) => {
    const resolve = pendingRef.current;
    pendingRef.current = null;
    resolve?.(files);
  };

  const pickFiles = useCallback(async ({ source = "gallery" } = {}) => {
    if (source === "camera" && Capacitor.isNativePlatform()) {
      try {
        const photo = await Camera.getPhoto({
          source: CameraSource.Camera,
          resultType: CameraResultType.DataUrl,
          quality: 90,
          correctOrientation: true,
        });
        if (!photo?.dataUrl) return [];
        const blob = await (await fetch(photo.dataUrl)).blob();
        return [
          new File([blob], `scontrino-${Date.now()}.jpg`, { type: blob.type || "image/jpeg" }),
        ];
      } catch {
        return []; // annullato dall'utente o permesso negato
      }
    }
    return new Promise((resolve) => {
      settle([]); // a new pick supersedes any stale pending one
      pendingRef.current = resolve;
      (source === "camera" ? cameraRef : galleryRef).current?.click();
    });
  }, []);

  const onChange = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    settle(files);
  };
  const onCancel = () => settle([]);

  const inputs = (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onChange}
        onCancel={onCancel}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={onChange}
        onCancel={onCancel}
      />
    </>
  );

  return { pickFiles, inputs };
}
