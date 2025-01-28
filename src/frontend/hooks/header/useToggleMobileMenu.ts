// src/frontend/hooks/header/useToggleMobileMenu.ts

import { useState, useEffect, useCallback, RefObject } from 'react';

type MobileMenuState = {
	isMobileMenuOpen: boolean;
	toggleMobileMenu: () => void;
	closeMobileMenu: () => void;
};

/**
 * Custom hook to manage mobile menu toggle behavior.
 *
 * @param {RefObject<HTMLElement>} menuRef - A React ref pointing to the mobile menu DOM element.
 * @returns {MobileMenuState}
 */
export const useToggleMobileMenu = (menuRef: RefObject<HTMLElement>): MobileMenuState => {
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

	/**
	 * Toggles the mobile menu state between open and closed.
	 */
	const toggleMobileMenu = useCallback(() => {
		if (!menuRef.current) return;

		if (isMobileMenuOpen) {
			// Close the menu
			menuRef.current.classList.remove('mobile-menu-open');
			document.body.style.overflow = 'auto';
			setIsMobileMenuOpen(false);
		} else {
			// Open the menu
			requestAnimationFrame(() => {
				menuRef.current?.classList.add('mobile-menu-open');
			});
			document.body.style.overflow = 'hidden';
			setIsMobileMenuOpen(true);
		}
	}, [isMobileMenuOpen, menuRef]);

	/**
	 * Closes the mobile menu if it is currently open.
	 */
	const closeMobileMenu = useCallback(() => {
		if (isMobileMenuOpen && menuRef.current) {
			menuRef.current.classList.remove('mobile-menu-open');
			document.body.style.overflow = 'auto';
			setIsMobileMenuOpen(false);
		}
	}, [isMobileMenuOpen, menuRef]);

	/**
	 * Automatically closes the menu on desktop resize.
	 * Prevents the mobile menu from staying open on larger screens.
	 */
	useEffect(() => {
		const handleResize = () => {
			if (window.innerWidth >= 1024 && isMobileMenuOpen) {
				closeMobileMenu();
			}
		};
		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
		};
	}, [isMobileMenuOpen, closeMobileMenu]);

	return {
		isMobileMenuOpen,
		toggleMobileMenu,
		closeMobileMenu,
	};
};
