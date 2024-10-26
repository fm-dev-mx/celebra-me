// src/hooks/useHeaderHover.ts

import { useCallback, useRef } from 'react';

/**
 * Custom hook to manage header visibility based on hover behavior
 *
 * @param {boolean} isHeaderVisible - Current visibility state of the header
 * @returns {Object} An object containing:
 *   - handleMouseEnter: function to be called on mouseenter events
 *   - handleMouseLeave: function to be called on mouseleave events
 */
export const useHeaderHover = (isHeaderVisible: boolean): { handleMouseEnter: () => void; handleMouseLeave: () => void } => {
	const headerContainer = useRef<HTMLElement | null>(null);
	const appearedByHover = useRef(false);

	/**
	 * Handle mouseenter events to show the header
	 */
	const handleMouseEnter = useCallback(() => {
		if (!headerContainer.current) {
			headerContainer.current = document.querySelector('.header-container');
		}

		if (!isHeaderVisible && headerContainer.current) {
			headerContainer.current.classList.remove('opacity-0', '-translate-y-full');
			headerContainer.current.classList.add('opacity-100', 'translate-y-0');
			appearedByHover.current = true;
		}
	}, [isHeaderVisible]);

	/**
	 * Handle mouseleave events to hide the header if it appeared due to hover
	 */
	const handleMouseLeave = useCallback(() => {
		if (!headerContainer.current) {
			headerContainer.current = document.querySelector('.header-container');
		}

		if (appearedByHover.current && headerContainer.current) {
			headerContainer.current.classList.remove('opacity-100', 'translate-y-0');
			headerContainer.current.classList.add('opacity-0', '-translate-y-full');
			appearedByHover.current = false;
		}
	}, []);

	return { handleMouseEnter, handleMouseLeave };
};
