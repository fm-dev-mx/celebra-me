import { useEffect } from 'react';

interface Props {
	headerId: string;
	transparentOnHero?: boolean;
}

/**
 * Behavior-only component that adds the Header navigation behaviors:
 * 1. Transparency on hero/scrolled state
 * 2. Auto-hide on scroll down (Headroom pattern)
 * 3. Glassmorphism toggle
 */
export default function HeaderBaseBehavior({ headerId, transparentOnHero }: Props) {
	useEffect(() => {
		const header = document.getElementById(headerId);
		if (!(header instanceof HTMLElement)) return;

		let lastScrollY = window.scrollY;
		const SCROLL_THRESHOLD = 50;
		const HIDE_THRESHOLD = 100;

		const setScrolledState = (isScrolledPastHero: boolean) => {
			header.classList.toggle('header-base--scrolled', isScrolledPastHero);

			const isMenuOpenNow = header.classList.contains('header-base--menu-open');

			if (transparentOnHero && !isMenuOpenNow) {
				header.classList.toggle('header-base--transparent', !isScrolledPastHero);
			} else {
				header.classList.remove('header-base--transparent');
			}
		};

		const handleScroll = () => {
			const currentScrollY = window.scrollY;
			const isScrolledPastHero = currentScrollY > SCROLL_THRESHOLD;

			// 1. Scrolled state (transparency/color change)
			setScrolledState(isScrolledPastHero);

			// 2. Auto-Hide logic
			const isExternallyMenuOpen = header.classList.contains('header-base--menu-open');
			if (isExternallyMenuOpen) {
				header.classList.remove('header-base--hidden');
				lastScrollY = currentScrollY;
				return;
			}

			const isScrollingDown = currentScrollY > lastScrollY;

			if (currentScrollY > HIDE_THRESHOLD && isScrollingDown) {
				header.classList.add('header-base--hidden');
			} else {
				header.classList.remove('header-base--hidden');
			}

			lastScrollY = currentScrollY;
		};

		// Throttle scroll event for performance
		let ticking = false;
		const onScroll = () => {
			if (!ticking) {
				window.requestAnimationFrame(() => {
					handleScroll();
					ticking = false;
				});
				ticking = true;
			}
		};

		window.addEventListener('scroll', onScroll, { passive: true });

		// Initial state
		handleScroll();

		return () => {
			window.removeEventListener('scroll', onScroll);
		};
	}, [headerId, transparentOnHero]);

	return null;
}
