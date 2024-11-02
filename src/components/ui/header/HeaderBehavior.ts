// src/components/ui/header/HeaderBehavior.ts

import React, { useEffect } from 'react';
import { useHeaderScroll } from '@/frontend/hooks/header/useHeaderScroll';
import { useHeaderHover } from '@/frontend/hooks/header/useHeaderHover';
import { useToggleMobileMenu } from '@/frontend/hooks/header/useToggleMobileMenu';
import { useMenuLinkHighlighter } from '@/frontend/hooks/header/useMenuLinkHighlighter';

/**
 * HeaderBehavior Component
 *
 * This component encapsulates all the behavior logic for the header,
 * including scroll effects, hover interactions, mobile menu toggling,
 * and menu link highlighting.
 *
 * It doesn't render any visible elements but applies the necessary
 * event listeners and state management for the header's functionality.
 */
const HeaderBehavior: React.FC = () => {
	const { isHeaderVisible, handleScroll } = useHeaderScroll();
	const { handleMouseEnter, handleMouseLeave } = useHeaderHover(isHeaderVisible);
	const { isMobileMenuOpen, closeMobileMenu } = useToggleMobileMenu();
	const { highlightMenuLink } = useMenuLinkHighlighter();

	useEffect(() => {
		// Apply scroll event listener
		window.addEventListener('scroll', handleScroll);

		// Apply hover event listeners to the header
		const header = document.getElementById('main-header');
		if (header) {
			header.addEventListener('mouseenter', handleMouseEnter);
			header.addEventListener('mouseleave', handleMouseLeave);
		}

		// Setup Intersection Observer for menu link highlighting
		const sections = document.querySelectorAll('section');
		const observer = new IntersectionObserver(highlightMenuLink, {
			root: null,
			rootMargin: '-10% 0px -10% 0px',
			threshold: 0.2,
		});

		sections.forEach((section) => observer.observe(section));

		// Cleanup function
		return () => {
			window.removeEventListener('scroll', handleScroll);
			if (header) {
				header.removeEventListener('mouseenter', handleMouseEnter);
				header.removeEventListener('mouseleave', handleMouseLeave);
			}
			sections.forEach((section) => observer.unobserve(section));
		};
	}, [handleScroll, handleMouseEnter, handleMouseLeave, highlightMenuLink]);

	// Close mobile menu on scroll
	useEffect(() => {
		const handleScrollForMobileMenu = () => {
			if (isMobileMenuOpen) {
				closeMobileMenu();
			}
		};

		window.addEventListener('scroll', handleScrollForMobileMenu);

		return () => {
			window.removeEventListener('scroll', handleScrollForMobileMenu);
		};
	}, [isMobileMenuOpen, closeMobileMenu]);

	// This component doesn't render anything visible
	return null;
};

export default HeaderBehavior;
