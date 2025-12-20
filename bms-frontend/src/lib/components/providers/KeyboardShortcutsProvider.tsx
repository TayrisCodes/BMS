'use client';

import { useState, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts';
import { CommandPalette } from '@/lib/components/search/CommandPalette';
import { KeyboardShortcutsDialog } from '@/lib/components/ui/keyboard-shortcuts-dialog';

interface KeyboardShortcutsProviderProps {
  children: ReactNode;
}

export function KeyboardShortcutsProvider({ children }: KeyboardShortcutsProviderProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);

  const shortcuts = useKeyboardShortcuts([
    {
      key: 'k',
      ctrlKey: true,
      action: () => setCommandPaletteOpen(true),
      description: 'Open command palette',
    },
    {
      key: '/',
      ctrlKey: true,
      action: () => setShortcutsHelpOpen(true),
      description: 'Show keyboard shortcuts',
    },
    {
      key: 'Escape',
      action: () => {
        setCommandPaletteOpen(false);
        setShortcutsHelpOpen(false);
      },
      description: 'Close dialogs',
    },
    {
      key: 'd',
      ctrlKey: true,
      action: () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
      },
      description: 'Toggle dark mode',
    },
  ]);

  return (
    <>
      {children}
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      <KeyboardShortcutsDialog open={shortcutsHelpOpen} onOpenChange={setShortcutsHelpOpen} />
    </>
  );
}
