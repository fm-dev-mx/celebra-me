// src/frontend/hooks/useMenuLinkHighlighter.ts

import { useCallback, useEffect } from 'react';

/**
 * Custom hook to manage menu link highlighting based on visible sections
 */
export const useMenuLinkHighlighter = (): { highlightMenuLink: (entries: IntersectionObserverEntry[]) => void } => {
	/**
	 * Highlight the corresponding menu link for the visible section
	 */
	const highlightMenuLink = useCallback((entries: IntersectionObserverEntry[]) => {
		entries.forEach((entry) => {
			const sectionId = entry.target.id; // Get the ID of the visible section
			const desktopLink = document.querySelector(`#main-header nav a[href="#${sectionId}"]`);
			const mobileLink = document.querySelector(`#mobile-menu a[href="#${sectionId}"]`);

			if (entry.isIntersecting) {
				// If the section is intersecting, add the active class to the link
				desktopLink?.classList.add('active');
				mobileLink?.classList.add('active');
			} else {
				// Otherwise, remove the active class
				desktopLink?.classList.remove('active');
				mobileLink?.classList.remove('active');
			}
		});
	}, []);

	useEffect(() => {
		// Select all sections that should trigger the link highlighting
		const sections = document.querySelectorAll('section');

		// Create a new IntersectionObserver with the highlightMenuLink callback
		const observer = new IntersectionObserver(highlightMenuLink, {
			root: null,
			rootMargin: '-10% 0px -10% 0px',
			threshold: 0.2,
		});

		// Observe each section to detect when it enters or exits the viewport
		sections.forEach((section) => observer.observe(section));

		// Cleanup the observer on component unmount to avoid memory leaks
		return () => {
			sections.forEach((section) => observer.unobserve(section));
		};
	}, [highlightMenuLink]);

	return { highlightMenuLink };
};
