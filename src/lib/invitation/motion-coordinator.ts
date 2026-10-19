import type { InvitationRevealRecipe } from '@/lib/theme/theme-contract';

const INVITATION_REVEAL_OBSERVER_OPTIONS = {
	threshold: 0.12,
	rootMargin: '0px 0px -12% 0px',
} as const;

/** Editorial items start once their top crosses 85 % of the viewport height. */
const EDITORIAL_REVEAL_OBSERVER_OPTIONS = {
	threshold: 0,
	rootMargin: '0px 0px -15% 0px',
} as const;

/** Items that enter in one batch stagger by order; the cap bounds the longest delay. */
const EDITORIAL_ORDER_CAP = 8;

const EDITORIAL_ITEM_SELECTOR = '[data-reveal-item], [data-reveal-role]';

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

function editorialTargets(wrapper: RevealWrapper): HTMLElement[] {
	// A marked container (a header item holding a marked title) defers to its marked children.
	const items = Array.from(wrapper.querySelectorAll<HTMLElement>(EDITORIAL_ITEM_SELECTOR)).filter(
		(item) => !item.querySelector(EDITORIAL_ITEM_SELECTOR),
	);
	// A section without marked items enters as one block.
	return items.length > 0 ? items : [wrapper];
}

function revealEditorialTarget(target: HTMLElement, order: number): void {
	target.style.setProperty('--reveal-order', String(Math.min(order, EDITORIAL_ORDER_CAP)));
	target.removeAttribute('data-reveal-pending');
	target.classList.add('is-visible');
	if (target.hasAttribute('data-gallery-item')) target.dataset.inView = 'true';
}

/** Resolves once the envelope (if any) has finished: nothing animates behind it. */
function whenInvitationRevealed(container: HTMLElement, start: () => void): void {
	const root = container.closest<HTMLElement>('[data-reveal-state]');
	if (!root || root.dataset.revealState === 'revealed') {
		start();
		return;
	}
	const watcher = new MutationObserver(() => {
		if (root.dataset.revealState !== 'revealed') return;
		watcher.disconnect();
		start();
	});
	watcher.observe(root, { attributes: true, attributeFilter: ['data-reveal-state'] });
}

/**
 * Editorial wrappers observe each marked item (not the block) once. Reduced motion keeps the
 * observation and the CSS turns every entrance into a short fade.
 */
function initEditorialMotion(container: HTMLElement, wrappers: RevealWrapper[]): void {
	if (wrappers.length === 0) return;
	if (typeof window.IntersectionObserver !== 'function') {
		failOpenEditorial(wrappers);
		return;
	}

	whenInvitationRevealed(container, () => {
		let observer: IntersectionObserver | undefined;
		try {
			observer = new IntersectionObserver((entries) => {
				const entering = entries
					.filter((entry) => entry.isIntersecting)
					.map((entry) => entry.target as HTMLElement)
					.sort((a, b) =>
						a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
					);
				// Stagger counts within one role, so a title entering with the list never delays it.
				const orderByRole = new Map<string, number>();
				for (const target of entering) {
					const role = target.dataset.revealRole ?? 'item';
					const order = orderByRole.get(role) ?? 0;
					orderByRole.set(role, order + 1);
					revealEditorialTarget(target, order);
					observer?.unobserve(target);
				}
			}, EDITORIAL_REVEAL_OBSERVER_OPTIONS);

			for (const wrapper of wrappers) {
				for (const target of editorialTargets(wrapper)) {
					observer.observe(target);
					target.setAttribute('data-reveal-pending', '');
				}
				wrapper.classList.add('has-motion');
			}
		} catch {
			observer?.disconnect();
			failOpenEditorial(wrappers);
		}
	});
}

function failOpenEditorial(wrappers: Iterable<RevealWrapper>): void {
	for (const wrapper of wrappers) {
		wrapper.classList.remove('has-motion');
		editorialTargets(wrapper).forEach((target) => revealEditorialTarget(target, 0));
		wrapper.classList.add('is-visible');
	}
}

/**
 * Ambient lantern layers loop only while their section is on screen. Layers a profile has not
 * opted into stay `display: none` and are never observed.
 */
function initAmbientLanterns(container: HTMLElement): void {
	const layers = Array.from(
		container.querySelectorAll<HTMLElement>('[data-lantern-ambient]'),
	).filter((layer) => getComputedStyle(layer).display !== 'none');
	if (layers.length === 0 || typeof window.IntersectionObserver !== 'function') return;
	const observer = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			const layer = entry.target as HTMLElement;
			if (entry.isIntersecting) layer.dataset.ambient = 'running';
			else delete layer.dataset.ambient;
		}
	});
	layers.forEach((layer) => observer.observe(layer));
}

/**
 * Owns every invitation section reveal for the current document. Section recipes share one
 * documented options signature; the opt-in editorial recipe adds the second, per-item observer.
 * Components provide declarative metadata only and never construct observers.
 */
export function initInvitationMotion(root: Document = document): void {
	const container = root.querySelector<HTMLElement>('#invitation-sections-container');
	if (!container || container.dataset.motionCoordinator === 'ready') return;

	container.dataset.motionCoordinator = 'ready';
	setInterludeProperties(container);
	initAmbientLanterns(container);

	const allWrappers = Array.from(
		container.querySelectorAll<RevealWrapper>(
			':scope > .invitation-section-wrapper[data-reveal]:not([data-reveal="none"])',
		),
	);
	const editorialWrappers = allWrappers.filter(
		(wrapper) => wrapper.dataset.reveal === 'editorial',
	);
	const wrappers = allWrappers.filter((wrapper) => wrapper.dataset.reveal !== 'editorial');
	initEditorialMotion(container, editorialWrappers);
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
