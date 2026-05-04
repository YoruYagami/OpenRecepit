import React from 'react';

export function ImageViewer({ open, url, caption, filename, onClose }) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-[100] bg-black/95 flex flex-col fade-in" onClick={onClose}>
      <div className="flex items-center justify-between px-4 pt-6 h-20 shrink-0 text-white/80" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{caption || "Dettaglio immagine"}</p>
          {filename && <p className="text-[11px] opacity-60 truncate">{filename}</p>}
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-95 transition ml-2 shrink-0"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 min-h-0 relative px-2 pb-6">
        <div className="w-full h-full relative group">
          <img
            src={url}
            alt={caption || ""}
            className="absolute inset-0 w-full h-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}
