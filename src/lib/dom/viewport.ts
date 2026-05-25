export const DEFAULT_VIEWPORT_FIT_FACTOR = 0.9;

export interface VisibleViewportBoundsOptions {
	headerHeight?: number;
	playerClearance?: number;
	safeAreaInsetBottom?: number;
	viewportHeight?: number;
}

export function getViewportHeight(): number {
	return window.visualViewport?.height ?? window.innerHeight;
}

export function fitsViewport(element: HTMLElement, factor = DEFAULT_VIEWPORT_FIT_FACTOR): boolean {
	return element.getBoundingClientRect().height <= getViewportHeight() * factor;
}

export function isKeyboardOpen(): boolean {
	if (typeof window === 'undefined' || !window.visualViewport) return false;
	return window.visualViewport.height < window.innerHeight * 0.8;
}

export function getSmartScrollBlock(
	element: HTMLElement,
	factor = DEFAULT_VIEWPORT_FIT_FACTOR,
): ScrollLogicalPosition {
	if (isKeyboardOpen()) return 'start';
	return fitsViewport(element, factor) ? 'center' : 'start';
}

export function getVisibleViewportBounds({
	headerHeight = 0,
	playerClearance = 0,
	safeAreaInsetBottom = 0,
	viewportHeight = getViewportHeight(),
}: VisibleViewportBoundsOptions = {}) {
	const top = Math.max(0, headerHeight);
	const bottom = Math.max(top, viewportHeight - playerClearance - safeAreaInsetBottom);

	return {
		top: Math.round(top),
		bottom: Math.round(bottom),
		height: Math.round(bottom - top),
	};
}

export function getCardAwareScrollTop(
	element: HTMLElement,
	options: VisibleViewportBoundsOptions = {},
): number {
	const bounds = getVisibleViewportBounds(options);
	const rect = element.getBoundingClientRect();
	const documentTop = window.scrollY + rect.top;

	if (rect.height > bounds.height) {
		return Math.round(documentTop - bounds.top);
	}

	const centeringOffset = (bounds.height - rect.height) / 2;
	return Math.round(documentTop - bounds.top - centeringOffset);
}
