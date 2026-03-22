import { useEffect } from 'react';
import { createIntersectionObserver } from '@/utils/animations';

/**
 * Behavior-only component that adds the Gifts section behaviors:
 * 1. Animations: Reveal on scroll
 * 2. Copy to Clipboard functionality
 */
export default function GiftsBehavior() {
	useEffect(() => {
		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		if (!prefersReducedMotion) {
			const giftSections = document.querySelectorAll('.gifts-section');
			giftSections.forEach((section) => {
				section.classList.add('has-motion');
			});

			createIntersectionObserver('.gifts-section.has-motion', (target) => {
				target.classList.add('is-visible');
			});
		}

		// Copy functionality
		const copyButtons = document.querySelectorAll('.copy-button');
		copyButtons.forEach((button) => {
			const labelCopy = button.getAttribute('data-label-copy') || 'Copiar';
			const labelCopied = button.getAttribute('data-label-copied') || '¡Copiado!';

			const handleCopy = () => {
				const clabe = button.getAttribute('data-clabe');
				if (clabe) {
					const normalizedClabe = clabe.replace(/\s+/g, '');
					navigator.clipboard.writeText(normalizedClabe).then(() => {
						button.textContent = labelCopied;
						button.classList.add('copy-button--success');
						setTimeout(() => {
							button.textContent = labelCopy;
							button.classList.remove('copy-button--success');
						}, 2000);
					});
				}
			};

			button.addEventListener('click', handleCopy);

			return () => {
				button.removeEventListener('click', handleCopy);
			};
		});
	}, []);

	return null;
}
