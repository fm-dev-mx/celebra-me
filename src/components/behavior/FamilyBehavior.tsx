import { useEffect } from 'react';
import { createIntersectionObserver } from '@/utils/animations';

/**
 * Behavior-only component that adds the Family section animations.
 */
export default function FamilyBehavior() {
	useEffect(() => {
		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		if (!prefersReducedMotion) {
			const familySections = document.querySelectorAll('.family');
			familySections.forEach((section) => {
				section.classList.add('has-motion');
			});

			createIntersectionObserver('.family.has-motion', (target) => {
				target.classList.add('is-visible');
			});
		}
	}, []);

	return null;
}
