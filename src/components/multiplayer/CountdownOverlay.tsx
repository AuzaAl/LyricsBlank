'use client';

import React, { useEffect, useState } from 'react';

interface CountdownOverlayProps {
  /** Starting number, e.g. 3. */
  from?: number;
  /** Optional label shown under the number. */
  label?: string;
}

/**
 * Big 3-2-1-GO overlay shown at the start line. Blocks all pointer/keyboard
 * input until it clears (the hidden typing input must not steal the start).
 */
export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({ from = 3, label }) => {
  const [count, setCount] = useState(from);

  useEffect(() => {
    if (count <= 0) return;
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-md select-none">
      <div className="flex flex-col items-center">
        <div
          key={count}
          className="text-[120px] sm:text-[160px] font-bold text-white leading-none animate-line-enter"
        >
          {count > 0 ? count : 'GO!'}
        </div>
        {label && <div className="text-sm text-white/50 mt-4 tracking-wider">{label}</div>}
      </div>
    </div>
  );
};
