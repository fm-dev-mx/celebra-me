import type { InvitationRevealRecipe } from '@/lib/theme/theme-contract';

const INVITATION_REVEAL_OBSERVER_OPTIONS = {
	threshold: 0.12,
	rootMargin: '0px 0px -12% 0px',
} as const;

type RevealWrapper = HTMLElement & {
	dataset: DOMStringMap & { reveal?: InvitationRevealRecipe };
};

function setInterludeProperties(root: ParentNode): void {
	root.querySelectorAll<HTMLElement>('.invitation-interlude').forEach((interlude) => {
		// Content focal is a fallback token so invitation profiles can override
		// --interlude-focal-point responsively without fighting an inline pin.
		if (interlude.dataset.focalPoint) {
			interlude.style.setProperty(
				'--interlude-focal-point-content',
				interlude.dataset.focalPoint,
			);
		}
		if (interlude.dataset.focalPointDesktop) {
			interlude.style.setProperty(
				'--interlude-focal-point-desktop',
				interlude.dataset.focalPointDesktop,
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
	});
}

function reveal(wrapper: RevealWrapper): void {
	wrapper.classList.add('is-visible');
	wrapper.querySelectorAll<HTMLElement>('[data-reveal-item]').forEach((item) => {
		item.classList.add('is-visible');
		if (item.hasAttribute('data-gallery-item')) item.dataset.inView = 'true';
	});
}

function failOpen(wrappers: Iterable<RevealWrapper>): void {
	for (const wrapper of wrappers) {
		wrapper.classList.remove('has-motion');
		reveal(wrapper);
	}
}

/**
 * Owns every invitation section reveal for the current document. All wrappers use the one
 * documented options signature, so the route creates exactly one reveal observer. Components
 * provide declarative metadata only and never construct observers.
 */
export function initInvitationMotion(root: Document = document): void {
	const container = root.querySelector<HTMLElement>('#invitation-sections-container');
	if (!container || container.dataset.motionCoordinator === 'ready') return;

	container.dataset.motionCoordinator = 'ready';
	setInterludeProperties(container);

	const wrappers = Array.from(
		container.querySelectorAll<RevealWrapper>(
			':scope > .invitation-section-wrapper[data-reveal]:not([data-reveal="none"])',
		),
	);
	if (wrappers.length === 0) return;

	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		failOpen(wrappers);
		return;
	}

	if (typeof window.IntersectionObserver !== 'function') {
		failOpen(wrappers);
		return;
	}

	let observer: IntersectionObserver | undefined;

	try {
		observer = new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				const wrapper = entry.target as RevealWrapper;
				reveal(wrapper);
				observer?.unobserve(wrapper);
			}
		}, INVITATION_REVEAL_OBSERVER_OPTIONS);

		for (const wrapper of wrappers) {
			observer.observe(wrapper);
			wrapper.classList.add('has-motion');
		}
	} catch {
		observer?.disconnect();
		failOpen(wrappers);
		return;
	}
}
