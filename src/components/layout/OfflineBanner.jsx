import React, { useEffect, useState } from "react";

/** Non-blocking connectivity notice: scanning needs the network, manual entry doesn't. */
export function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine !== false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;
  return (
    <div
      role="status"
      className="absolute top-0 inset-x-0 z-30 bg-warn-soft border-b border-warn-line text-warn text-xs font-semibold text-center py-1.5 px-4"
    >
      Sei offline: la scansione non è disponibile, l'inserimento manuale sì.
    </div>
  );
}
