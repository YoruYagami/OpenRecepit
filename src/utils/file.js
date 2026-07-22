// Shared FileReader-to-Promise wrapper used by backup import, image resize, and
// the web file input. Resolves with the file contents; rejects with an Error.
export function readFile(file, { as = "text" } = {}) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error("Lettura file fallita"));
    if (as === "dataURL") r.readAsDataURL(file);
    else r.readAsText(file);
  });
}
