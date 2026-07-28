import { initInvitationMotion } from '@/lib/invitation/motion-coordinator';

const REVEAL_OBSERVER_OPTIONS = {
	threshold: 0.12,
	rootMargin: '0px 0px -12% 0px',
} as const;

function renderWrappers(): HTMLElement[] {
	document.body.innerHTML = `
		<div id="invitation-sections-container">
			<div class="invitation-section-wrapper" data-reveal="fade"><section>Uno</section></div>
			<div class="invitation-section-wrapper" data-reveal="stagger-group">
				<section><div data-reveal-item data-gallery-item>Dos</div></section>
			</div>
			<div class="invitation-section-wrapper" data-reveal="none"><section>Tres</section></div>
		</div>
	`;
	return Array.from(document.querySelectorAll<HTMLElement>('.invitation-section-wrapper'));
}

function setReducedMotion(matches: boolean): void {
	window.matchMedia = jest.fn().mockReturnValue({ matches }) as never;
}

describe('invitation motion coordinator', () => {
	beforeEach(() => {
		setReducedMotion(false);
	});

	afterEach(() => {
		delete (window as Window & { IntersectionObserver?: typeof IntersectionObserver })
			.IntersectionObserver;
	});

	it('uses one documented observer signature for every animated wrapper', () => {
		const wrappers = renderWrappers();
		let notify: IntersectionObserverCallback = () => undefined;
		const observe = jest.fn();
		const unobserve = jest.fn();
		const constructor = jest.fn(
			(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) => {
				notify = callback;
				expect(options).toEqual(REVEAL_OBSERVER_OPTIONS);
				return {
					observe,
					unobserve,
					disconnect: jest.fn(),
					takeRecords: jest.fn(),
					root: null,
					rootMargin: '',
					thresholds: [],
				};
			},
		);
		window.IntersectionObserver = constructor as never;

		initInvitationMotion();

		expect(constructor).toHaveBeenCalledTimes(1);
		expect(observe).toHaveBeenCalledTimes(2);
		expect(wrappers[0]).toHaveClass('has-motion');
		expect(wrappers[2]).not.toHaveClass('has-motion');

		notify(
			[{ target: wrappers[1], isIntersecting: true } as unknown as IntersectionObserverEntry],
			{} as IntersectionObserver,
		);

		expect(wrappers[1]).toHaveClass('is-visible');
		expect(wrappers[1].querySelector('[data-reveal-item]')).toHaveClass('is-visible');
		expect(wrappers[1].querySelector<HTMLElement>('[data-gallery-item]')?.dataset.inView).toBe(
			'true',
		);
		expect(unobserve).toHaveBeenCalledWith(wrappers[1]);
	});

	it('fails open when observer registration throws', () => {
		const wrappers = renderWrappers();
		window.IntersectionObserver = jest.fn(() => ({
			observe: jest.fn(() => {
				throw new Error('observe failed');
			}),
			disconnect: jest.fn(),
		})) as never;

		initInvitationMotion();

		expect(
			wrappers.slice(0, 2).every((wrapper) => wrapper.classList.contains('is-visible')),
		).toBe(true);
		expect(wrappers.some((wrapper) => wrapper.classList.contains('has-motion'))).toBe(false);
	});

	it('keeps wrappers pending until intersection when observer registration succeeds', () => {
		const wrappers = renderWrappers();
		window.IntersectionObserver = jest.fn(() => ({
			observe: jest.fn(),
			unobserve: jest.fn(),
			disconnect: jest.fn(),
		})) as never;

		initInvitationMotion();

		expect(
			wrappers.slice(0, 2).every((wrapper) => wrapper.classList.contains('is-visible')),
		).toBe(false);
		expect(wrappers[0]).toHaveClass('has-motion');
		expect(wrappers[1]).toHaveClass('has-motion');
	});

	it('reveals immediately without an observer under reduced motion', () => {
		const wrappers = renderWrappers();
		setReducedMotion(true);
		const constructor = jest.fn();
		window.IntersectionObserver = constructor as never;

		initInvitationMotion();

		expect(constructor).not.toHaveBeenCalled();
		expect(
			wrappers.slice(0, 2).every((wrapper) => wrapper.classList.contains('is-visible')),
		).toBe(true);
		expect(wrappers.some((wrapper) => wrapper.classList.contains('has-motion'))).toBe(false);
	});
});
