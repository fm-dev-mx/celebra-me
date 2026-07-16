import { createIntersectionObserver, initSectionReveal } from '@/utils/animations';

function setReducedMotion(matches: boolean): void {
	window.matchMedia = jest.fn().mockReturnValue({ matches }) as never;
}

describe('progressive invitation visibility', () => {
	beforeEach(() => {
		document.body.innerHTML = '<section class="reveal-target">Contenido</section>';
		setReducedMotion(false);
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
		delete (window as Window & { IntersectionObserver?: typeof IntersectionObserver })
			.IntersectionObserver;
	});

	it('fails open immediately when IntersectionObserver is unavailable', () => {
		initSectionReveal('.reveal-target');

		const target = document.querySelector('.reveal-target')!;
		expect(target.classList.contains('is-visible')).toBe(true);
		expect(target.classList.contains('has-motion')).toBe(false);
	});

	it('fails open when observer construction throws', () => {
		window.IntersectionObserver = jest.fn(() => {
			throw new Error('observer unavailable');
		}) as never;

		initSectionReveal('.reveal-target');

		const target = document.querySelector('.reveal-target')!;
		expect(target.classList.contains('is-visible')).toBe(true);
		expect(target.classList.contains('has-motion')).toBe(false);
	});

	it('adds the motion marker only after observation succeeds', () => {
		let notify: IntersectionObserverCallback = () => undefined;
		const observe = jest.fn();
		const unobserve = jest.fn();
		window.IntersectionObserver = jest.fn((callback: IntersectionObserverCallback) => {
			notify = callback;
			return {
				observe,
				unobserve,
				disconnect: jest.fn(),
				takeRecords: jest.fn(),
				root: null,
				rootMargin: '',
				thresholds: [],
			};
		}) as never;

		initSectionReveal('.reveal-target');
		const target = document.querySelector('.reveal-target')!;
		expect(observe).toHaveBeenCalledWith(target);
		expect(target.classList.contains('has-motion')).toBe(true);
		expect(target.classList.contains('is-visible')).toBe(false);

		notify(
			[{ target, isIntersecting: true } as IntersectionObserverEntry],
			{} as IntersectionObserver,
		);
		expect(target.classList.contains('is-visible')).toBe(true);
		expect(unobserve).toHaveBeenCalledWith(target);
	});

	it('uses the bounded timeout as a final fail-open path', () => {
		window.IntersectionObserver = jest.fn(() => ({
			observe: jest.fn(),
			unobserve: jest.fn(),
			disconnect: jest.fn(),
			takeRecords: jest.fn(),
			root: null,
			rootMargin: '',
			thresholds: [],
		})) as never;
		const callback = jest.fn();

		createIntersectionObserver('.reveal-target', callback, { failOpenAfterMs: 25 });
		jest.advanceTimersByTime(25);

		expect(callback).toHaveBeenCalledWith(document.querySelector('.reveal-target'));
	});

	it('keeps reduced-motion content visible without motion markers', () => {
		setReducedMotion(true);
		initSectionReveal('.reveal-target');

		const target = document.querySelector('.reveal-target')!;
		expect(target.classList.contains('is-visible')).toBe(true);
		expect(target.classList.contains('has-motion')).toBe(false);
	});
});
