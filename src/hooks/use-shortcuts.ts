import { useEffect } from 'react';

type ShortcutHandler = () => void;

interface ShortcutMap {
	[key: string]: ShortcutHandler;
}

/**
 * Hook for handling keyboard shortcuts.
 * @param shortcuts Key map (for example: 'n', '/') to handlers.
 * @param active Whether the hook should stay active, useful for modal flows.
 */
export const useShortcuts = (shortcuts: ShortcutMap, active: boolean = true) => {
	useEffect(() => {
		if (!active) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			// Ignore shortcuts while the user is typing into an editable field.
			const target = event.target as HTMLElement;
			const isInput =
				target.tagName === 'INPUT' ||
				target.tagName === 'TEXTAREA' ||
				target.isContentEditable;

			const key = event.key.toLowerCase();

			if (isInput && key !== 'escape') {
				return;
			}

			if (shortcuts[key]) {
				event.preventDefault();
				shortcuts[key]();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [shortcuts, active]);
};
