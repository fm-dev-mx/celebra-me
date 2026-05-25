export function setupNavigatorShare(value = jest.fn().mockResolvedValue(undefined)) {
	Object.defineProperty(navigator, 'share', {
		value,
		configurable: true,
		writable: true,
	});
	return value;
}

export function removeNavigatorShare() {
	delete (navigator as unknown as Record<string, unknown>).share;
}

export function setupNavigatorClipboard() {
	Object.defineProperty(navigator, 'clipboard', {
		value: { writeText: jest.fn().mockResolvedValue(undefined) },
		configurable: true,
		writable: true,
	});
}

export function createMockWindow(overrides?: Partial<{ closed: boolean; href: string }>) {
	return {
		closed: overrides?.closed ?? false,
		location: { href: overrides?.href ?? '' },
		close: jest.fn(),
	};
}

export function stubWindowOpen(
	returnValue: Window | null = createMockWindow() as unknown as Window,
) {
	window.open = jest.fn().mockReturnValue(returnValue);
}
