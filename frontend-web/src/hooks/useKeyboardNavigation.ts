import { useEffect, useCallback, useRef } from 'react';

interface KeyboardNavigationOptions {
  enabled?: boolean;
  onEscape?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onEnter?: () => void;
  onSpace?: () => void;
  onSlash?: () => void;
  customShortcuts?: Record<string, () => void>;
}

export const useKeyboardNavigation = (options: KeyboardNavigationOptions = {}) => {
  const {
    enabled = true,
    onEscape,
    onArrowUp,
    onArrowDown,
    onArrowLeft,
    onArrowRight,
    onEnter,
    onSpace,
    onSlash,
    customShortcuts = {},
  } = options;

  const keyHandlers = useRef<Record<string, () => void>>({
    Escape: onEscape || (() => {}),
    ArrowUp: onArrowUp || (() => {}),
    ArrowDown: onArrowDown || (() => {}),
    ArrowLeft: onArrowLeft || (() => {}),
    ArrowRight: onArrowRight || (() => {}),
    Enter: onEnter || (() => {}),
    ' ': onSpace || (() => {}),
    '/': onSlash || (() => {}),
    ...customShortcuts,
  });

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    const handler = keyHandlers.current[event.key];
    if (handler) {
      event.preventDefault();
      handler();
    }

    // Handle Ctrl/Cmd + key combinations
    if (event.ctrlKey || event.metaKey) {
      const comboKey = `${event.ctrlKey ? 'Ctrl' : 'Cmd'}+${event.key}`;
      const comboHandler = keyHandlers.current[comboKey];
      if (comboHandler) {
        event.preventDefault();
        comboHandler();
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [enabled, handleKeyDown]);

  return {
    // Helper to focus elements
    focusElement: (selector: string) => {
      const element = document.querySelector(selector) as HTMLElement;
      if (element) {
        element.focus();
      }
    },
    // Helper to check if element is focused
    isElementFocused: (selector: string) => {
      const element = document.querySelector(selector) as HTMLElement;
      return element === document.activeElement;
    },
  };
};

export default useKeyboardNavigation;
