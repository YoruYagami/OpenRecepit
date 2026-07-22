import React from "react";
import { Icon } from "../ui/Icon.jsx";

export function BottomTabBar({ active, onChange, scanEnabled }) {
  const tabs = [
    { id: "trips", icon: "folder", label: "Trasferte" },
    { id: "scan", icon: "camera", label: "Scansiona", center: true },
    { id: "settings", icon: "settings", label: "Impostazioni" },
  ];

  return (
    <div className="shrink-0 h-16 bg-paper border-t border-line flex items-center justify-around px-2 relative z-30">
      {tabs.map((t) => {
        const isActive = active === t.id;
        if (t.center) {
          const disabled = !scanEnabled;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              disabled={disabled}
              className={`w-14 h-14 -mt-6 rounded-full flex items-center justify-center shadow-soft transition active:scale-95 ${
                disabled
                  ? "bg-surface-2 text-ink/30 cursor-not-allowed"
                  : isActive
                    ? "bg-ink text-paper"
                    : "bg-ink text-paper"
              }`}
              aria-label={t.label}
            >
              <span className={isActive && !disabled ? "scale-110 transition-transform" : ""}>
                <Icon name={t.icon} className="w-6 h-6" />
              </span>
            </button>
          );
        }
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
              isActive ? "text-ink font-bold" : "text-ink/40 font-medium hover:text-ink/60"
            }`}
          >
            <span
              className={`${isActive ? "scale-110" : "scale-100"} transition-transform`}
            >
              <Icon name={t.icon} className="w-5 h-5" />
            </span>
            <span className="text-[10px] uppercase tracking-wider">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
