import { useEffect } from 'react';

/**
 * Behavior-only component that adds a subtle parallax offset to Interlude sections
 * based on scroll position.
 */
export default function InterludeParallaxBehavior() {
	useEffect(() => {
		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const interludes = Array.from(document.querySelectorAll('.invitation-interlude'));

		if (prefersReducedMotion || interludes.length === 0) return;

		const updateParallax = () => {
			for (const interlude of interludes) {
				if (!(interlude instanceof HTMLElement)) continue;

				const variant = interlude.dataset.variant ?? '';
				// Apply only to specific variants if needed, or all
				if (!variant.includes('premium') && variant !== 'editorial') continue;

				const rect = interlude.getBoundingClientRect();
				const viewportCenter = window.innerHeight / 2;

				// Calculate relative position to viewport center
				const offset = (rect.top + rect.height / 2 - viewportCenter) * -0.08;

				interlude.style.setProperty(
					'--interlude-parallax-offset',
					`${offset.toFixed(2)}px`,
				);
			}
		};

		// Initial update
		updateParallax();

		window.addEventListener('scroll', updateParallax, { passive: true });
		window.addEventListener('resize', updateParallax);

		return () => {
			window.removeEventListener('scroll', updateParallax);
			window.removeEventListener('resize', updateParallax);
		};
	}, []);

	return null;
}
