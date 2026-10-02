'use client';

import React from 'react';
import { AmbientArtBackground } from '@/components/AmbientArtBackground';
import { SidebarNav } from '@/components/SidebarNav';
import { ShortcutsModal } from '@/components/ShortcutsModal';

interface AppChromeProps {
  artUrl?: string;
  fallbackUrl?: string;
  onOpenShortcuts: () => void;
  isShortcutsOpen: boolean;
  onCloseShortcuts: () => void;
  children: React.ReactNode;
  /** Rendered outside the main content column (e.g. result modals). */
  overlay?: React.ReactNode;
}

/**
 * The persistent app frame: ambient art wash, YT Music sidebar rail, and the
 * main content column. Shared by solo and multiplayer shells.
 */
export const AppChrome: React.FC<AppChromeProps> = ({
  artUrl = '',
  fallbackUrl,
  onOpenShortcuts,
  isShortcutsOpen,
  onCloseShortcuts,
  children,
  overlay,
}) => {
  return (
    <main className="relative h-[100dvh] max-h-[100dvh] w-full flex overflow-hidden select-none">
      <AmbientArtBackground artUrl={artUrl} fallbackUrl={fallbackUrl} />

      <SidebarNav onOpenShortcuts={onOpenShortcuts} />

      <div className="relative z-10 flex-1 flex flex-col justify-between h-full min-w-0 overflow-hidden">
        {children}
      </div>

      <ShortcutsModal isOpen={isShortcutsOpen} onClose={onCloseShortcuts} />

      {overlay}
    </main>
  );
};
