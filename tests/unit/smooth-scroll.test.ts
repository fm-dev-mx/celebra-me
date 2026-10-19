import { shouldUseSmoothScroll } from '@/lib/invitation/smooth-scroll';

function mockMedia(options: { fine: boolean; reduced: boolean }): jest.Mock {
	const matchMedia = jest.fn((query: string) => ({
		matches: query.includes('pointer: fine')
			? options.fine
			: query.includes('prefers-reduced-motion')
				? options.reduced
				: false,
	}));
	window.matchMedia = matchMedia as never;
	return matchMedia;
}

function renderPage(motion?: string): void {
	document.body.innerHTML = motion
		? `<main data-motion="${motion}"><a href="#rsvp">RSVP</a></main>`
		: '<main><a href="#rsvp">RSVP</a></main>';
}

describe('shouldUseSmoothScroll', () => {
	const originalMatchMedia = window.matchMedia;

	afterEach(() => {
		window.matchMedia = originalMatchMedia;
		document.body.innerHTML = '';
	});

	it('is true for editorial motion on a fine pointer without reduced motion', () => {
		renderPage('editorial');
		mockMedia({ fine: true, reduced: false });

		expect(shouldUseSmoothScroll()).toBe(true);
	});

	it('is false without data-motion="editorial"', () => {
		mockMedia({ fine: true, reduced: false });

		renderPage();
		expect(shouldUseSmoothScroll()).toBe(false);

		renderPage('other');
		expect(shouldUseSmoothScroll()).toBe(false);
	});

	it('is false on a coarse pointer', () => {
		renderPage('editorial');
		mockMedia({ fine: false, reduced: false });

		expect(shouldUseSmoothScroll()).toBe(false);
	});

	it('is false when the visitor prefers reduced motion', () => {
		renderPage('editorial');
		mockMedia({ fine: true, reduced: true });

		expect(shouldUseSmoothScroll()).toBe(false);
	});

	it('is false when matchMedia is unavailable', () => {
		renderPage('editorial');
		window.matchMedia = undefined as never;

		expect(shouldUseSmoothScroll()).toBe(false);
	});

	it('does not query media when the page is not editorial', () => {
		renderPage();
		const matchMedia = mockMedia({ fine: true, reduced: false });

		shouldUseSmoothScroll();

		expect(matchMedia).not.toHaveBeenCalled();
	});

	it('reads the document it is given', () => {
		mockMedia({ fine: true, reduced: false });
		const detached = document.implementation.createHTMLDocument('x');
		detached.body.innerHTML = '<main data-motion="editorial"></main>';

		expect(shouldUseSmoothScroll(detached)).toBe(true);
		expect(shouldUseSmoothScroll(document)).toBe(false);
	});
});
