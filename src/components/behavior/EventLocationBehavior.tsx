import { useEffect } from 'react';
import { initCopyButtons, revealIOSOnly } from '@/utils/ui';
import { createIntersectionObserver } from '@/utils/animations';

/**
 * Behavior-only component that adds the Event Location specific behaviors:
 * 1. Initialize "Copy to Clipboard" buttons
 * 2. Reveal Apple-specific links only on iOS
 * 3. Animate venue cards on reveal
 */
export default function EventLocationBehavior() {
	useEffect(() => {
		// Initialize UI behaviors
		initCopyButtons();
		revealIOSOnly();

		// Animations: Trigger card animations on scroll
		createIntersectionObserver('.event-location__card', (target) => {
			target.classList.add('is-visible');
		});
	}, []);

	return null;
}
