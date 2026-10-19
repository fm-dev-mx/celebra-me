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

	describe('editorial recipe', () => {
		const EDITORIAL_OPTIONS = { threshold: 0, rootMargin: '0px 0px -15% 0px' };

		interface MockObserver {
			callback: IntersectionObserverCallback;
			options?: IntersectionObserverInit;
			observe: jest.Mock;
			unobserve: jest.Mock;
		}

		function installObserverMock(): MockObserver[] {
			const observers: MockObserver[] = [];
			window.IntersectionObserver = jest.fn(
				(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) => {
					const observer = {
						callback,
						options,
						observe: jest.fn(),
						unobserve: jest.fn(),
						disconnect: jest.fn(),
					};
					observers.push(observer);
					return observer;
				},
			) as never;
			return observers;
		}

		function enter(observer: MockObserver, targets: Element[]): void {
			observer.callback(
				targets.map(
					(target) =>
						({ target, isIntersecting: true }) as unknown as IntersectionObserverEntry,
				),
				{} as IntersectionObserver,
			);
		}

		function renderEditorial(body: string, rootState?: string): HTMLElement {
			const stateAttribute = rootState ? ` data-reveal-state="${rootState}"` : '';
			document.body.innerHTML = `
				<div${stateAttribute}>
					<div id="invitation-sections-container">
						<div class="invitation-section-wrapper" data-reveal="editorial">${body}</div>
					</div>
				</div>
			`;
			return document.querySelector<HTMLElement>(
				'.invitation-section-wrapper',
			) as HTMLElement;
		}

		it('observes each marked item with the editorial options and marks it pending', () => {
			const wrapper = renderEditorial(`
				<p data-reveal-role="label">Label</p>
				<h2 data-reveal-role="title">Title</h2>
				<div data-reveal-item>Item</div>
			`);
			const observers = installObserverMock();

			initInvitationMotion();

			expect(observers).toHaveLength(1);
			expect(observers[0].options).toEqual(EDITORIAL_OPTIONS);
			expect(observers[0].observe).toHaveBeenCalledTimes(3);
			expect(wrapper).toHaveClass('has-motion');
			wrapper.querySelectorAll('[data-reveal-role], [data-reveal-item]').forEach((item) => {
				expect(item).toHaveAttribute('data-reveal-pending');
				expect(item).not.toHaveClass('is-visible');
			});
		});

		it('observes the wrapper itself when it has no marked items', () => {
			const wrapper = renderEditorial('<section>Plain</section>');
			const observers = installObserverMock();

			initInvitationMotion();

			expect(observers[0].observe).toHaveBeenCalledTimes(1);
			expect(observers[0].observe).toHaveBeenCalledWith(wrapper);
		});

		it('defers a marked container to its marked children', () => {
			const wrapper = renderEditorial(`
				<header data-reveal-item><h2 data-reveal-role="title">Title</h2></header>
			`);
			const observers = installObserverMock();

			initInvitationMotion();

			expect(observers[0].observe).toHaveBeenCalledTimes(1);
			expect(observers[0].observe).toHaveBeenCalledWith(wrapper.querySelector('h2'));
		});

		it('leaves markup inside a framework island untouched before hydration', () => {
			const wrapper = renderEditorial(`
				<astro-island ssr><h2 data-reveal-role="title">RSVP</h2></astro-island>
			`);
			const observers = installObserverMock();

			initInvitationMotion();

			expect(observers[0].observe).toHaveBeenCalledTimes(1);
			expect(observers[0].observe).toHaveBeenCalledWith(wrapper);
			expect(wrapper.querySelector('h2')).not.toHaveAttribute('data-reveal-pending');
		});

		it('reveals entering items once, with is-visible and no pending flag', () => {
			const wrapper = renderEditorial('<div data-reveal-item data-gallery-item>One</div>');
			const observers = installObserverMock();
			initInvitationMotion();
			const item = wrapper.querySelector<HTMLElement>('[data-reveal-item]') as HTMLElement;

			enter(observers[0], [item]);

			expect(item).toHaveClass('is-visible');
			expect(item).not.toHaveAttribute('data-reveal-pending');
			expect(item.dataset.inView).toBe('true');
			expect(item.style.getPropertyValue('--reveal-order')).toBe('0');
			expect(observers[0].unobserve).toHaveBeenCalledWith(item);
		});

		it('ignores entries that are not intersecting', () => {
			const wrapper = renderEditorial('<div data-reveal-item>One</div>');
			const observers = installObserverMock();
			initInvitationMotion();
			const item = wrapper.querySelector<HTMLElement>('[data-reveal-item]') as HTMLElement;

			observers[0].callback(
				[{ target: item, isIntersecting: false } as unknown as IntersectionObserverEntry],
				{} as IntersectionObserver,
			);

			expect(item).not.toHaveClass('is-visible');
			expect(item).toHaveAttribute('data-reveal-pending');
		});

		it('orders a batch in document order, counted per role and capped at 8', () => {
			const items = Array.from(
				{ length: 10 },
				(_, index) => `<li data-reveal-role="item">Item ${index}</li>`,
			).join('');
			const wrapper = renderEditorial(
				`<h2 data-reveal-role="title">Title</h2><ul>${items}</ul>`,
			);
			const observers = installObserverMock();
			initInvitationMotion();
			const title = wrapper.querySelector<HTMLElement>('h2') as HTMLElement;
			const list = Array.from(wrapper.querySelectorAll<HTMLElement>('li'));

			// Delivered out of document order: the title arrives last but still orders by role.
			enter(observers[0], [...list].reverse().concat(title));

			expect(title.style.getPropertyValue('--reveal-order')).toBe('0');
			expect(list.map((item) => item.style.getPropertyValue('--reveal-order'))).toEqual([
				'0',
				'1',
				'2',
				'3',
				'4',
				'5',
				'6',
				'7',
				'8',
				'8',
			]);
		});

		it('waits for data-reveal-state to become revealed before observing', async () => {
			renderEditorial('<div data-reveal-item>One</div>', 'sealed');
			const observers = installObserverMock();

			initInvitationMotion();
			expect(observers).toHaveLength(0);

			document
				.querySelector<HTMLElement>('[data-reveal-state]')
				?.setAttribute('data-reveal-state', 'revealed');
			await Promise.resolve();

			expect(observers).toHaveLength(1);
			expect(observers[0].observe).toHaveBeenCalledTimes(1);
		});

		it('starts at once when the invitation is already revealed', () => {
			renderEditorial('<div data-reveal-item>One</div>', 'revealed');
			const observers = installObserverMock();

			initInvitationMotion();

			expect(observers).toHaveLength(1);
		});

		it('fails open without IntersectionObserver', () => {
			const wrapper = renderEditorial(`
				<h2 data-reveal-role="title">Title</h2>
				<div data-reveal-item>Item</div>
			`);

			initInvitationMotion();

			expect(wrapper).toHaveClass('is-visible');
			expect(wrapper).not.toHaveClass('has-motion');
			wrapper.querySelectorAll('[data-reveal-role], [data-reveal-item]').forEach((item) => {
				expect(item).toHaveClass('is-visible');
				expect(item).not.toHaveAttribute('data-reveal-pending');
			});
		});

		it('fails open when observer registration throws', () => {
			const wrapper = renderEditorial('<div data-reveal-item>One</div>');
			window.IntersectionObserver = jest.fn(() => ({
				observe: jest.fn(() => {
					throw new Error('observe failed');
				}),
				disconnect: jest.fn(),
			})) as never;

			initInvitationMotion();

			expect(wrapper).toHaveClass('is-visible');
			expect(wrapper).not.toHaveClass('has-motion');
			expect(wrapper.querySelector('[data-reveal-item]')).toHaveClass('is-visible');
		});

		it('keeps editorial wrappers out of the section observer', () => {
			document.body.innerHTML = `
				<div id="invitation-sections-container">
					<div class="invitation-section-wrapper" data-reveal="fade"><section>Uno</section></div>
					<div class="invitation-section-wrapper" data-reveal="editorial">
						<div data-reveal-item>Dos</div>
					</div>
				</div>
			`;
			const observers = installObserverMock();

			initInvitationMotion();

			expect(observers).toHaveLength(2);
			const sectionObserver = observers.find(
				(observer) => observer.options?.threshold === REVEAL_OBSERVER_OPTIONS.threshold,
			);
			expect(sectionObserver?.observe).toHaveBeenCalledTimes(1);
		});
	});

	describe('ambient lanterns', () => {
		function renderLanterns(): HTMLElement[] {
			document.body.innerHTML = `
				<div id="invitation-sections-container">
					<div data-lantern-ambient id="shown"></div>
					<div data-lantern-ambient id="hidden" style="display: none"></div>
				</div>
			`;
			return Array.from(document.querySelectorAll<HTMLElement>('[data-lantern-ambient]'));
		}

		it('runs displayed layers while on screen and stops them when they leave', () => {
			const [shown, hidden] = renderLanterns();
			let notify: IntersectionObserverCallback = () => undefined;
			const observe = jest.fn();
			window.IntersectionObserver = jest.fn((callback: IntersectionObserverCallback) => {
				notify = callback;
				return { observe, unobserve: jest.fn(), disconnect: jest.fn() };
			}) as never;

			initInvitationMotion();

			expect(observe).toHaveBeenCalledTimes(1);
			expect(observe).toHaveBeenCalledWith(shown);
			expect(observe).not.toHaveBeenCalledWith(hidden);

			notify(
				[{ target: shown, isIntersecting: true } as unknown as IntersectionObserverEntry],
				{} as IntersectionObserver,
			);
			expect(shown.dataset.ambient).toBe('running');

			notify(
				[{ target: shown, isIntersecting: false } as unknown as IntersectionObserverEntry],
				{} as IntersectionObserver,
			);
			expect(shown.dataset.ambient).toBeUndefined();
		});

		it('does nothing without IntersectionObserver', () => {
			const [shown] = renderLanterns();

			expect(() => initInvitationMotion()).not.toThrow();
			expect(shown.dataset.ambient).toBeUndefined();
		});
	});
});
