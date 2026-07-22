import React from "react";

export function Field({ label, children, hint }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-ink/60 uppercase tracking-wide">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink/50">{hint}</span>}
    </label>
  );
}

export function TextInput(props) {
  return (
    <input
      {...props}
      className={`h-12 px-4 rounded-xl bg-surface border border-line text-ink placeholder:text-ink/45 focus:outline-none focus:ring-2 focus:ring-ink/15 ${props.className || ""}`}
    />
  );
}

export function SelectInput({ children, ...props }) {
  return (
    <select
      {...props}
      className={`h-12 px-3 rounded-xl bg-surface border border-line text-ink focus:outline-none focus:ring-2 focus:ring-ink/15 ${props.className || ""}`}
    >
      {children}
    </select>
  );
}

export function ToggleInput({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div
        className={`relative w-12 h-7 rounded-full transition-colors ${checked ? "bg-ink" : "bg-surface-2"}`}
      >
        <div
          className={`absolute top-1 left-1 bg-surface w-5 h-5 rounded-full transition-transform ${checked ? "translate-x-5" : "translate-x-0"} shadow-sm`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-ink">{label}</p>
        {hint && <p className="text-xs text-ink/60">{hint}</p>}
      </div>
      <input type="checkbox" className="hidden" checked={checked} onChange={onChange} />
    </label>
  );
}
