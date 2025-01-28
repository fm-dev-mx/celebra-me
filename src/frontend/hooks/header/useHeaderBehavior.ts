// src/frontend/hooks/header/useHeaderBehavior.ts
import { useEffect, useCallback } from 'react';
import throttle from 'lodash.throttle';
import { useHeaderScroll } from './useHeaderScroll';
import { useHeaderHover } from './useHeaderHover';
import { useMenuLinkHighlighter } from './useMenuLinkHighlighter';

interface UseHeaderBehaviorProps {
	headerRef: React.RefObject<HTMLElement>;
}

/**
 * Combines header behaviors for desktop (scroll, hover, intersection highlighting).
 */
export function useHeaderBehavior({ headerRef }: UseHeaderBehaviorProps) {
	// Scroll-based visibility logic for the desktop header
	const { isHeaderVisible, handleScroll } = useHeaderScroll();
	const throttledScroll = useCallback(
		throttle(() => {
			// Only apply scroll logic if viewport is large enough (desktop)
			if (window.innerWidth >= 1024) {
				handleScroll();
			}
		}, 200),
		[handleScroll],
	);

	// Hover logic (desktop only)
	const { handleMouseEnter, handleMouseLeave } = useHeaderHover(isHeaderVisible);

	// Intersection logic for highlighting menu links (can apply to all screen sizes, if you want)
	const { highlightMenuLink } = useMenuLinkHighlighter();

	useEffect(() => {
		// Attach the throttled scroll listener
		window.addEventListener('scroll', throttledScroll);

		// Attach hover events to the header (mostly relevant for desktop)
		const headerEl = headerRef.current;
		if (headerEl) {
			headerEl.addEventListener('mouseenter', handleMouseEnter);
			headerEl.addEventListener('mouseleave', handleMouseLeave);
		}

		return () => {
			window.removeEventListener('scroll', throttledScroll);
			if (headerEl) {
				headerEl.removeEventListener('mouseenter', handleMouseEnter);
				headerEl.removeEventListener('mouseleave', handleMouseLeave);
			}
		};
	}, [throttledScroll, handleMouseEnter, handleMouseLeave, headerRef]);

	// Observe sections to highlight links
	useEffect(() => {
		const sections = document.querySelectorAll('section[data-section]');
		const observer = new IntersectionObserver(highlightMenuLink, {
			root: null,
			rootMargin: '-10% 0px -10% 0px',
			threshold: 0.2,
		});

		sections.forEach((section) => observer.observe(section));
		return () => {
			sections.forEach((section) => observer.unobserve(section));
		};
	}, [highlightMenuLink]);
}
