import { uid } from "./formatters.js";
import { getImage, putImage } from "./imageStore.js";

// Full images go to the image store; only the reference lands in the expense.
// On a store failure (quota) the image stays inline so nothing is lost.
export async function storeFullImage(dataUrl) {
  if (!dataUrl) return {};
  try {
    return { fullRef: await putImage(dataUrl) };
  } catch {
    return { full: dataUrl };
  }
}

export async function buildExpenseFromQueueItem(item) {
  const {
    duplicateOf: _duplicateOf,
    duplicateLabel: _duplicateLabel,
    ...savedData
  } = item.data || {};
  const primary = await storeFullImage(item.full);
  const extraImages = [];
  for (const im of item.extraImages || []) {
    const stored = im.fullRef ? { fullRef: im.fullRef } : await storeFullImage(im.full);
    extraImages.push({ thumb: im.thumb, imageHash: im.imageHash, ...stored });
  }
  return {
    id: uid(),
    ...savedData,
    thumb: item.thumb,
    ...primary,
    imageHash: item.imageHash,
    ...(extraImages.length > 0 ? { extraImages } : {}),
    createdAt: Date.now(),
  };
}

/** Resolve an expense's full-resolution image regardless of storage generation. */
export async function loadFullImage(expense) {
  if (expense.full) return expense.full;
  if (expense.fullRef) return getImage(expense.fullRef).catch(() => null);
  return null;
}
