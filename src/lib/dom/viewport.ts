export const DEFAULT_VIEWPORT_FIT_FACTOR = 0.9;

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
