import {
	getViewportHeight,
	fitsViewport,
	getSmartScrollBlock,
	DEFAULT_VIEWPORT_FIT_FACTOR,
} from '@/lib/dom/viewport';

describe('getViewportHeight', () => {
	const ORIGINAL_INNER_HEIGHT = window.innerHeight;

	afterEach(() => {
		window.innerHeight = ORIGINAL_INNER_HEIGHT;
	});

	it('returns visualViewport height when available', () => {
		const mockVisualViewport = { height: 600 } as VisualViewport;
		Object.defineProperty(window, 'visualViewport', {
			value: mockVisualViewport,
			configurable: true,
		});
		expect(getViewportHeight()).toBe(600);
	});

	it('falls back to window.innerHeight when visualViewport is unavailable', () => {
		Object.defineProperty(window, 'visualViewport', {
			value: undefined,
			configurable: true,
		});
		window.innerHeight = 800;
		expect(getViewportHeight()).toBe(800);
	});
});

describe('fitsViewport', () => {
	const ORIGINAL_INNER_HEIGHT = window.innerHeight;

	beforeEach(() => {
		window.innerHeight = 800;
		Object.defineProperty(window, 'visualViewport', {
			value: undefined,
			configurable: true,
		});
	});

	afterEach(() => {
		window.innerHeight = ORIGINAL_INNER_HEIGHT;
	});

	it('returns true when element height is within the viewport factor', () => {
		const element = document.createElement('div');
		jest.spyOn(element, 'getBoundingClientRect').mockReturnValue({
			top: 0,
			left: 0,
			right: 100,
			bottom: 640,
			width: 100,
			height: 640,
		} as DOMRect);
		expect(fitsViewport(element)).toBe(true);
	});

	it('returns false when element height exceeds the viewport factor', () => {
		const element = document.createElement('div');
		jest.spyOn(element, 'getBoundingClientRect').mockReturnValue({
			top: 0,
			left: 0,
			right: 100,
			bottom: 800,
			width: 100,
			height: 800,
		} as DOMRect);
		expect(fitsViewport(element)).toBe(false);
	});

	it('returns false when element height exactly equals the viewport factor', () => {
		const element = document.createElement('div');
		const factor = 0.9;
		const height = window.innerHeight * factor;
		jest.spyOn(element, 'getBoundingClientRect').mockReturnValue({
			top: 0,
			left: 0,
			right: 100,
			bottom: height,
			width: 100,
			height,
		} as DOMRect);
		expect(fitsViewport(element, factor)).toBe(true);
	});

	it('uses the provided factor instead of the default', () => {
		const element = document.createElement('div');
		jest.spyOn(element, 'getBoundingClientRect').mockReturnValue({
			top: 0,
			left: 0,
			right: 100,
			bottom: 500,
			width: 100,
			height: 500,
		} as DOMRect);
		expect(fitsViewport(element, 0.5)).toBe(false);
		expect(fitsViewport(element, 0.7)).toBe(true);
	});
});

describe('getSmartScrollBlock', () => {
	const ORIGINAL_INNER_HEIGHT = window.innerHeight;

	beforeEach(() => {
		window.innerHeight = 800;
		Object.defineProperty(window, 'visualViewport', {
			value: undefined,
			configurable: true,
		});
	});

	afterEach(() => {
		window.innerHeight = ORIGINAL_INNER_HEIGHT;
	});

	it('returns "center" when the element fits the viewport', () => {
		const element = document.createElement('div');
		jest.spyOn(element, 'getBoundingClientRect').mockReturnValue({
			height: 600,
		} as DOMRect);
		expect(getSmartScrollBlock(element)).toBe('center');
	});

	it('returns "start" when the element does not fit the viewport', () => {
		const element = document.createElement('div');
		jest.spyOn(element, 'getBoundingClientRect').mockReturnValue({
			height: 800,
		} as DOMRect);
		expect(getSmartScrollBlock(element)).toBe('start');
	});

	it('uses the provided factor', () => {
		const element = document.createElement('div');
		jest.spyOn(element, 'getBoundingClientRect').mockReturnValue({
			height: 600,
		} as DOMRect);
		expect(getSmartScrollBlock(element, 0.5)).toBe('start');
	});
});

describe('DEFAULT_VIEWPORT_FIT_FACTOR', () => {
	it('is 0.9', () => {
		expect(DEFAULT_VIEWPORT_FIT_FACTOR).toBe(0.9);
	});
});
