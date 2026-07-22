import React from "react";

export function PrimaryButton({ children, onClick, disabled, className = "", type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl font-semibold bg-ink text-paper disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition shadow-soft ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick, disabled, className = "", type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl font-semibold bg-surface text-ink border border-line disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition shadow-soft ${className}`}
    >
      {children}
    </button>
  );
}
