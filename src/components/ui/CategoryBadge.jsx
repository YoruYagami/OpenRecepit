import React from 'react';
import { CATEGORIES } from '../../constants.js';

export function CategoryBadge({ id, size = "md" }) {
  const c = CATEGORIES[id] || CATEGORIES.altro;
  const px = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-full ${px}`}
      style={{ backgroundColor: c.color + "1a", color: c.color }}
    >
      <span aria-hidden>{c.icon}</span>
      <span>{c.label}</span>
    </span>
  );
}
