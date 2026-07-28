import { initSectionReveal } from '@/utils/animations';

export function initInterludeObserver(): void {
	const interludes = Array.from(document.querySelectorAll('.invitation-interlude'));

	if (interludes.length === 0) return;

	interludes.forEach((interlude) => {
		if (interlude instanceof HTMLElement) {
			if (interlude.dataset.focalPoint) {
				interlude.style.setProperty(
					'--interlude-focal-point',
					interlude.dataset.focalPoint,
				);
			}
			interlude.style.setProperty('--interlude-light-x', interlude.dataset.lightX || '50%');
			interlude.style.setProperty('--interlude-light-y', interlude.dataset.lightY || '34%');
			if (interlude.dataset.overlayOpacity) {
				interlude.style.setProperty(
					'--interlude-overlay-opacity',
					interlude.dataset.overlayOpacity,
				);
			}
		}
	});

	initSectionReveal('.invitation-interlude');
}
