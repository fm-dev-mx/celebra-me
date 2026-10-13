import { createIntersectionObserver } from '@/utils/animations';

function observeTargets() {
	const callback = jest.fn();
	const onObserved = jest.fn();
	const onFallback = jest.fn();
	const observer = createIntersectionObserver('.reveal-target', callback, {
		onObserved,
		onFallback,
	});
	return { observer, callback, onObserved, onFallback };
}

describe('progressive invitation visibility', () => {
	beforeEach(() => {
		document.body.innerHTML = '<section class="reveal-target">Contenido</section>';
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
		delete (window as Window & { IntersectionObserver?: typeof IntersectionObserver })
			.IntersectionObserver;
	});

	it('fails open immediately when IntersectionObserver is unavailable', () => {
		const { observer, callback, onObserved, onFallback } = observeTargets();

		const target = document.querySelector('.reveal-target')!;
		expect(observer).toBeNull();
		expect(callback).toHaveBeenCalledWith(target);
		expect(onFallback).toHaveBeenCalledWith(target);
		expect(onObserved).not.toHaveBeenCalled();
	});

	it('fails open when observer construction throws', () => {
		window.IntersectionObserver = jest.fn(() => {
			throw new Error('observer unavailable');
		}) as never;

		const { observer, callback, onObserved, onFallback } = observeTargets();

		const target = document.querySelector('.reveal-target')!;
		expect(observer).toBeNull();
		expect(callback).toHaveBeenCalledWith(target);
		expect(onFallback).toHaveBeenCalledWith(target);
		expect(onObserved).not.toHaveBeenCalled();
	});

	it('marks targets as observed only after observation succeeds', () => {
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

		const { callback, onObserved, onFallback } = observeTargets();
		const target = document.querySelector('.reveal-target')!;
		expect(observe).toHaveBeenCalledWith(target);
		expect(onObserved).toHaveBeenCalledWith(target);
		expect(callback).not.toHaveBeenCalled();

		notify(
			[{ target, isIntersecting: true } as IntersectionObserverEntry],
			{} as IntersectionObserver,
		);
		expect(callback).toHaveBeenCalledWith(target);
		expect(unobserve).toHaveBeenCalledWith(target);
		expect(onFallback).not.toHaveBeenCalled();
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
});
