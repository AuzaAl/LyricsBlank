'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface MusicNoteIconProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number;
}

/**
 * Music note glyph used for instrumental breaks (intro / interlude / outro).
 * Animation is applied by the caller via the `.instrumental-note` class so it
 * can be paused with `prefers-reduced-motion`.
 */
const MusicNoteIcon = ({ className, size = 24, ...props }: MusicNoteIconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn(className)}
    {...props}
  >
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

MusicNoteIcon.displayName = 'MusicNoteIcon';

export { MusicNoteIcon };
