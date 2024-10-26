// src/hooks/useToggleMobileMenu.ts

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook to manage mobile menu toggle behavior
 *
 * @returns {Object} An object containing:
 *   - isMobileMenuOpen: boolean indicating if the mobile menu is currently open
 *   - toggleMobileMenu: function to toggle the mobile menu
 *   - closeMobileMenu: function to close the mobile menu
 */

export type MobileMenuState = {
	isMobileMenuOpen: boolean;
	toggleMobileMenu: () => void;
	closeMobileMenu: () => void;
};

export const useToggleMobileMenu = (): MobileMenuState => {
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const mobileMenu = useRef<HTMLElement | null>(null);

	/**
	 * Toggle the mobile menu visibility
	 */
	const toggleMobileMenu = useCallback(() => {
		if (!mobileMenu.current) {
			mobileMenu.current = document.getElementById('mobile-menu');
		}

		if (mobileMenu.current) {
			if (isMobileMenuOpen) {
				// Close menu
				mobileMenu.current.classList.remove('mobile-menu-open');
				mobileMenu.current.classList.add('fade-out');
				setTimeout(() => {
					if (mobileMenu.current) {
						mobileMenu.current.classList.add('hidden');
						mobileMenu.current.classList.remove('fade-out');
					}
				}, 300); // Match this with your CSS transition duration
			} else {
				// Open menu
				mobileMenu.current.classList.remove('hidden');
				requestAnimationFrame(() => {
					if (mobileMenu.current) {
						mobileMenu.current.classList.add('mobile-menu-open');
					}
				});
			}
			setIsMobileMenuOpen(!isMobileMenuOpen);
			document.body.style.overflow = isMobileMenuOpen ? 'auto' : 'hidden';
		}
	}, [isMobileMenuOpen]);

	/**
	 * Close the mobile menu
	 */
	const closeMobileMenu = useCallback(() => {
		if (isMobileMenuOpen && mobileMenu.current) {
			mobileMenu.current.classList.remove('mobile-menu-open');
			mobileMenu.current.classList.add('fade-out');
			setTimeout(() => {
				if (mobileMenu.current) {
					mobileMenu.current.classList.add('hidden');
					mobileMenu.current.classList.remove('fade-out');
				}
			}, 300); // Match this with your CSS transition duration
			setIsMobileMenuOpen(false);
			document.body.style.overflow = 'auto';
		}
	}, [isMobileMenuOpen]);

	/**
	 * Handle window resize event to ensure menu state resets properly on larger screens
	 */
	useEffect(() => {
		const handleResize = () => {
			if (window.innerWidth >= 1024) {
				// Close the mobile menu and reset body scroll on larger screens
				setIsMobileMenuOpen(false);
				document.body.style.overflow = 'auto';
				if (mobileMenu.current) {
					mobileMenu.current.classList.remove('mobile-menu-open', 'fade-out');
					mobileMenu.current.classList.add('hidden');
				}
			}
		};

		// Add resize event listener
		window.addEventListener('resize', handleResize);

		// Cleanup on component unmount
		return () => {
			window.removeEventListener('resize', handleResize);
		};
	}, []);

	return { isMobileMenuOpen, toggleMobileMenu, closeMobileMenu };
};
