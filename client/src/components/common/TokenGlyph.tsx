import React from "react";

/** Glyphe du token d'enrichissement — jamais d'emoji, un losange plum. */
export const TokenGlyph: React.FC<{ className?: string }> = ({ className = "" }) => (
  <svg viewBox="0 0 10 10" aria-hidden="true" className={`inline-block w-[7px] h-[7px] ${className}`}>
    <path d="M5 0 10 5 5 10 0 5Z" fill="currentColor" />
  </svg>
);
