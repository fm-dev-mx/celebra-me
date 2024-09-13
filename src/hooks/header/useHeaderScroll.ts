// src/hooks/useHeaderScroll.ts

import { useState, useCallback, useRef } from 'react';

/**
 * Custom hook to manage header visibility based on scroll behavior
 *
 * @returns {Object} An object containing:
 *   - isHeaderVisible: boolean indicating if the header is currently visible
 *   - handleScroll: function to be called on scroll events
 */
export const useHeaderScroll = () => {
	const [isHeaderVisible, setIsHeaderVisible] = useState(true);
	const lastScrollTop = useRef(0);
	const headerContainer = useRef<HTMLElement | null>(null);

	/**
	 * Handle scroll events to show/hide the header
	 */
	const handleScroll = useCallback(() => {
		// Initialize headerContainer ref if not already set
		if (!headerContainer.current) {
			headerContainer.current = document.querySelector('.header-container');
		}

		const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

		// Determine scroll direction
		if (scrollTop > lastScrollTop.current) {
			// Scrolling down
			if (isHeaderVisible && headerContainer.current) {
				headerContainer.current.classList.remove('opacity-100', 'translate-y-0');
				headerContainer.current.classList.add('opacity-0', '-translate-y-full');
				setIsHeaderVisible(false);
			}
		} else {
			// Scrolling up
			if (!isHeaderVisible && headerContainer.current) {
				headerContainer.current.classList.remove('opacity-0', '-translate-y-full');
				headerContainer.current.classList.add('opacity-100', 'translate-y-0');
				setIsHeaderVisible(true);
			}
		}

		// Update last scroll position
		lastScrollTop.current = scrollTop <= 0 ? 0 : scrollTop;
	}, [isHeaderVisible]);

	return { isHeaderVisible, handleScroll };
};
