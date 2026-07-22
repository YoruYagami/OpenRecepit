import React, { useCallback, useRef } from "react";

/*
 * Promise-based wrapper around the hidden camera/gallery <input type="file">
 * elements: `pickFiles({ source }) → Promise<File[]>`. Callers decide what the
 * files are for — this replaces the old fileActionRef dispatch in App.
 *
 * If the user cancels the native picker, browsers that fire the `cancel` event
 * resolve with []; on older WebViews the promise stays pending until the next
 * pick resolves it with [] (harmless: nothing awaits it exclusively).
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

  const pickFiles = useCallback(({ source = "gallery" } = {}) => {
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
        accept="image/*"
        multiple
        className="hidden"
        onChange={onChange}
        onCancel={onCancel}
      />
    </>
  );

  return { pickFiles, inputs };
}
