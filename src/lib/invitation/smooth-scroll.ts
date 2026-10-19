/**
 * Smooth wheel scrolling for editorial invitations on a fine pointer (`theme.motion: 'editorial'`).
 * Lenis is fetched with a dynamic import only once the envelope has finished, and only on a
 * desktop pointer without reduced motion, so phones never download it. Internal `#…` links
 * glide to their target below the fixed header.
 */
const HEADER_SELECTOR = '#event-header';

export function shouldUseSmoothScroll(root: Document = document): boolean {
	if (!root.querySelector('[data-motion="editorial"]')) return false;
	if (typeof window.matchMedia !== 'function') return false;
	return (
		window.matchMedia('(pointer: fine)').matches &&
		!window.matchMedia('(prefers-reduced-motion: reduce)').matches
	);
}

function headerOffset(root: Document): number {
	const header = root.querySelector<HTMLElement>(HEADER_SELECTOR);
	return header ? header.getBoundingClientRect().height : 0;
}

export async function startSmoothScroll(root: Document = document): Promise<void> {
	const { default: Lenis } = await import('lenis');
	const lenis = new Lenis({ lerp: 0.1, syncTouch: false, anchors: false });
	const frame = (time: number) => {
		lenis.raf(time);
		window.requestAnimationFrame(frame);
	};
	window.requestAnimationFrame(frame);

	root.addEventListener('click', (event) => {
		if (event.defaultPrevented || event.button !== 0) return;
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		const link = (event.target as Element | null)?.closest?.<HTMLAnchorElement>('a[href^="#"]');
		const hash = link?.getAttribute('href');
		if (!hash || hash === '#') return;
		const target = root.getElementById(decodeURIComponent(hash.slice(1)));
		if (!target) return;
		event.preventDefault();
		lenis.scrollTo(target, { offset: -headerOffset(root) });
		history.pushState(null, '', hash);
	});
}

/** Starts smooth scrolling after the invitation is revealed, when the page qualifies. */
export function initSmoothScroll(root: Document = document): void {
	if (!shouldUseSmoothScroll(root)) return;
	const invitationRoot = root.querySelector<HTMLElement>('[data-reveal-state]');
	const start = () => {
		startSmoothScroll(root).catch(() => {
			// Native scrolling stays in place when the module cannot load.
		});
	};
	if (!invitationRoot || invitationRoot.dataset.revealState === 'revealed') {
		start();
		return;
	}
	const watcher = new MutationObserver(() => {
		if (invitationRoot.dataset.revealState !== 'revealed') return;
		watcher.disconnect();
		start();
	});
	watcher.observe(invitationRoot, { attributes: true, attributeFilter: ['data-reveal-state'] });
}
