import { useEffect } from 'react';

type ShortcutHandler = () => void;

interface ShortcutMap {
	[key: string]: ShortcutHandler;
}

/**
 * Hook para manejar atajos de teclado.
 * @param shortcuts Mapa de teclas (ej: 'n', '/') a funciones.
 * @param active Si el hook debe estar activo (útil para desactivar en modales).
 */
export const useShortcuts = (shortcuts: ShortcutMap, active: boolean = true) => {
	useEffect(() => {
		if (!active) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			// No disparar si el usuario está escribiendo en un input
			const target = event.target as HTMLElement;
			const isInput =
				target.tagName === 'INPUT' ||
				target.tagName === 'TEXTAREA' ||
				target.isContentEditable;

			// Excepción: '/' debe funcionar para enfocar el buscador incluso si no estamos en un input
			// Pero si ya estamos en un input, queremos que el '/' se escriba normalmente
			// a menos que sea específicamente para enfocar.

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
