import {
	buildInvitationDeferredCssPromotionInlineScript,
	ENVELOPE_OPENED_EVENT,
	FIRST_CONTENTFUL_PAINT,
	INVITATION_DEFERRED_CSS_PROMOTION_FALLBACK_MS,
	INVITATION_DEFERRED_CSS_SELECTOR,
} from '@/lib/invitation/invitation-deferred-css-promotion';

const STORAGE_KEY = 'envelope-opened-renata';

type PaintEntry = { name: string };
type ObserverCallback = (list: { getEntries: () => PaintEntry[] }) => void;

const globals = globalThis as unknown as {
	PerformanceObserver?: unknown;
	requestAnimationFrame: (callback: FrameRequestCallback) => number;
};
const originalPerformanceObserver = globals.PerformanceObserver;
const originalRequestAnimationFrame = globals.requestAnimationFrame;

let paintEntries: PaintEntry[];
let observerCallback: ObserverCallback | null;
let observerDisconnect: jest.Mock;
let pendingFrames: FrameRequestCallback[];
let mediaWrites: jest.SpyInstance;

function installPerformanceObserver(): void {
	globals.PerformanceObserver = jest.fn((callback: ObserverCallback) => {
		observerCallback = callback;
		return { observe: jest.fn(), disconnect: observerDisconnect };
	});
}

function removePerformanceObserver(): void {
	delete globals.PerformanceObserver;
}

function runScript(input: { isDemo?: boolean; search?: string } = {}): void {
	window.history.replaceState({}, '', `/xv/renata${input.search ?? ''}`);
	const script = buildInvitationDeferredCssPromotionInlineScript({
		storageKey: STORAGE_KEY,
		isDemo: input.isDemo ?? false,
	});
	new Function(script)();
}

function links(): HTMLLinkElement[] {
	return Array.from(document.querySelectorAll<HTMLLinkElement>(INVITATION_DEFERRED_CSS_SELECTOR));
}

function isPromoted(): boolean {
	return links().every((link) => link.media === 'all');
}

/** Number of promotion passes: each pass writes `media` once per deferred link. */
function promotionCount(): number {
	return mediaWrites.mock.calls.length / links().length;
}

function emitPaint(entries: PaintEntry[]): void {
	observerCallback?.({ getEntries: () => entries });
}

function flushFrames(): void {
	while (pendingFrames.length > 0) pendingFrames.shift()!(0);
}

describe('invitation deferred CSS promotion inline script', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		document.head.innerHTML = [
			'<link rel="stylesheet" href="/a.css" media="not all" data-invitation-deferred-css />',
			'<link rel="stylesheet" href="/b.css" media="not all" data-invitation-deferred-css />',
		].join('');
		window.localStorage.clear();
		paintEntries = [];
		observerCallback = null;
		observerDisconnect = jest.fn();
		pendingFrames = [];
		Object.defineProperty(performance, 'getEntriesByType', {
			configurable: true,
			value: jest.fn(() => paintEntries),
		});
		installPerformanceObserver();
		globals.requestAnimationFrame = jest.fn((callback: FrameRequestCallback) => {
			pendingFrames.push(callback);
			return pendingFrames.length;
		});
		mediaWrites = jest.spyOn(HTMLLinkElement.prototype, 'media', 'set');
	});

	afterEach(() => {
		// Drain the once-listeners and timers a previous script left behind.
		window.dispatchEvent(new Event(ENVELOPE_OPENED_EVENT));
		jest.clearAllTimers();
		jest.useRealTimers();
		jest.restoreAllMocks();
		delete (performance as { getEntriesByType?: unknown }).getEntriesByType;
		globals.PerformanceObserver = originalPerformanceObserver;
		globals.requestAnimationFrame = originalRequestAnimationFrame;
		document.head.innerHTML = '';
		window.history.replaceState({}, '', '/');
	});

	it('promotes immediately for skipEnvelope without waiting for paint', () => {
		runScript({ search: '?skipEnvelope=true' });

		expect(isPromoted()).toBe(true);
		expect(globals.PerformanceObserver).not.toHaveBeenCalled();
		expect(globals.requestAnimationFrame).not.toHaveBeenCalled();
	});

	it('promotes immediately for returning visitors of real invitations', () => {
		window.localStorage.setItem(STORAGE_KEY, 'true');
		runScript();

		expect(isPromoted()).toBe(true);
		expect(globals.PerformanceObserver).not.toHaveBeenCalled();
	});

	it('ignores the stored flag under forceEnvelope and on demos', () => {
		window.localStorage.setItem(STORAGE_KEY, 'true');
		runScript({ search: '?forceEnvelope=true' });
		expect(isPromoted()).toBe(false);

		runScript({ isDemo: true });
		expect(isPromoted()).toBe(false);
	});

	it('promotes from a buffered first-contentful-paint entry without the observer', () => {
		paintEntries = [{ name: FIRST_CONTENTFUL_PAINT }];
		runScript();

		expect(isPromoted()).toBe(true);
		expect(globals.PerformanceObserver).not.toHaveBeenCalled();
	});

	it('promotes when the paint observer later reports first-contentful-paint', () => {
		runScript();
		expect(isPromoted()).toBe(false);

		emitPaint([{ name: 'first-paint' }]);
		expect(isPromoted()).toBe(false);

		emitPaint([{ name: 'first-paint' }, { name: FIRST_CONTENTFUL_PAINT }]);
		expect(isPromoted()).toBe(true);
		expect(observerDisconnect).toHaveBeenCalled();
	});

	it('promotes on envelope:opened when paint never arrives', () => {
		runScript();

		window.dispatchEvent(new Event(ENVELOPE_OPENED_EVENT));
		expect(isPromoted()).toBe(true);

		emitPaint([{ name: FIRST_CONTENTFUL_PAINT }]);
		jest.runAllTimers();
		expect(promotionCount()).toBe(1);
	});

	it('falls back to the bounded timeout when paint never fires', () => {
		runScript();

		jest.advanceTimersByTime(INVITATION_DEFERRED_CSS_PROMOTION_FALLBACK_MS - 1);
		expect(isPromoted()).toBe(false);
		jest.advanceTimersByTime(1);
		expect(isPromoted()).toBe(true);
	});

	it('falls back to animation frames when the paint observer is unavailable', () => {
		removePerformanceObserver();
		runScript();

		expect(isPromoted()).toBe(false);
		flushFrames();
		expect(isPromoted()).toBe(true);
		expect(globals.requestAnimationFrame).toHaveBeenCalledTimes(2);
	});

	it('continues to paint fallbacks when reveal-intent detection throws', () => {
		jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('storage blocked');
		});
		runScript();

		expect(isPromoted()).toBe(false);
		emitPaint([{ name: FIRST_CONTENTFUL_PAINT }]);
		expect(isPromoted()).toBe(true);
	});

	it('keeps promotion idempotent across overlapping triggers', () => {
		runScript();

		emitPaint([{ name: FIRST_CONTENTFUL_PAINT }]);
		window.dispatchEvent(new Event(ENVELOPE_OPENED_EVENT));
		jest.runAllTimers();

		expect(promotionCount()).toBe(1);
	});

	it('does nothing when the page has no deferred stylesheets', () => {
		document.head.innerHTML = '';
		runScript();

		expect(globals.PerformanceObserver).not.toHaveBeenCalled();
		expect(globals.requestAnimationFrame).not.toHaveBeenCalled();
	});

	it('embeds the storage key and no internal process identifiers', () => {
		const script = buildInvitationDeferredCssPromotionInlineScript({
			storageKey: STORAGE_KEY,
			isDemo: false,
		});

		expect(script).toContain(STORAGE_KEY);
		expect(script).not.toContain('Goal');
	});
});
