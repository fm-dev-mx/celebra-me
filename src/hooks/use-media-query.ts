import { useCallback, useSyncExternalStore } from 'react';

/**
 * Live `matchMedia` result. Returns `null` during SSR and hydration so callers
 * can render a CSS-driven fallback until the real viewport is known.
 */
export function useMediaQuery(query: string): boolean | null {
	const subscribe = useCallback(
		(onChange: () => void) => {
			if (typeof window === 'undefined' || !window.matchMedia) return () => {};
			const list = window.matchMedia(query);
			list.addEventListener('change', onChange);
			// Some embedders (device emulation, webviews) skip `change`; resize is the backstop.
			window.addEventListener('resize', onChange);
			return () => {
				list.removeEventListener('change', onChange);
				window.removeEventListener('resize', onChange);
			};
		},
		[query],
	);
	const getSnapshot = () =>
		typeof window !== 'undefined' && window.matchMedia
			? window.matchMedia(query).matches
			: null;
	return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
