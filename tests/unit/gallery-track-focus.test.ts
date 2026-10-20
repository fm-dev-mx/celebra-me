import { initGalleryTrackFocus, trackProgressFor } from '@/lib/invitation/gallery-track-focus';

describe('trackProgressFor', () => {
	it('maps an offset along the track to scene progress', () => {
		expect(trackProgressFor(0, 3000, 1000)).toBe(0);
		expect(trackProgressFor(1000, 3000, 1000)).toBe(0.5);
		expect(trackProgressFor(2000, 3000, 1000)).toBe(1);
	});

	it('clamps offsets outside the travel', () => {
		expect(trackProgressFor(-200, 3000, 1000)).toBe(0);
		expect(trackProgressFor(2600, 3000, 1000)).toBe(1);
	});

	it('returns zero when the track fits the view', () => {
		expect(trackProgressFor(300, 800, 1000)).toBe(0);
	});
});

describe('initGalleryTrackFocus', () => {
	function renderTrack(stagePosition: string): HTMLElement {
		document.body.innerHTML = `
			<div data-scroll-scene>
				<div class="scroll-scene__stage" style="position: ${stagePosition}">
					<div data-gallery-track>
						<div class="gallery-grid">
							<div data-gallery-item tabindex="0"></div>
						</div>
					</div>
				</div>
			</div>`;
		return document.querySelector<HTMLElement>('[data-gallery-item]')!;
	}

	const originalScrollTo = window.scrollTo;

	afterEach(() => {
		document.body.innerHTML = '';
		window.scrollTo = originalScrollTo;
	});

	it('scrolls the page when a photo is focused in a pinned scene', () => {
		const item = renderTrack('sticky');
		const scrollTo = jest.fn();
		window.scrollTo = scrollTo;
		const cleanup = initGalleryTrackFocus();
		item.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		expect(scrollTo).toHaveBeenCalledTimes(1);
		cleanup();
	});

	it('leaves the page alone while the scene rests in normal flow', () => {
		const item = renderTrack('static');
		const scrollTo = jest.fn();
		window.scrollTo = scrollTo;
		const cleanup = initGalleryTrackFocus();
		item.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		expect(scrollTo).not.toHaveBeenCalled();
		cleanup();
	});
});
