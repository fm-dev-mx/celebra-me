import { useEffect } from 'react';

/**
 * Behavior-only component for the Landing Page (index.astro):
 * 1. Global Intersection Observer for scroll animations
 * 2. Dynamic Scroll-Padding Logic for Headroom header
 */
export default function LandingPageBehavior() {
	useEffect(() => {
		// 1. Global Intersection Observer for Landing Page Sections
		const observerOptions = {
			threshold: 0.1,
			rootMargin: '0px 0px -10% 0px',
		};

		const observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					entry.target.classList.add('is-visible');
				}
			});
		}, observerOptions);

		// Observe all main sections and specific animated wrappers
		const targets = document.querySelectorAll('section, .hero-prime, .animate-icons');
		targets.forEach((el) => observer.observe(el));

		// 2. Dynamic Scroll-Padding Logic
		// Handles the auto-hiding header (Headroom pattern) to prevent title overlap
		const html = document.documentElement;
		let lastScrollY = window.scrollY;

		// Initial state
		html.style.scrollPaddingTop = '100px';

		const handleScroll = () => {
			const currentScrollY = window.scrollY;
			const isScrollingDown = currentScrollY > lastScrollY;

			if (currentScrollY < 100) {
				// Near top: use full header padding
				html.style.scrollPaddingTop = '100px';
			} else {
				// If scrolling down, menu is hidden -> 0 padding
				// If scrolling up, menu appears -> 70px padding
				html.style.scrollPaddingTop = isScrollingDown ? '0px' : '70px';
			}

			lastScrollY = currentScrollY;
		};

		window.addEventListener('scroll', handleScroll, { passive: true });

		return () => {
			targets.forEach((el) => observer.unobserve(el));
			window.removeEventListener('scroll', handleScroll);
		};
	}, []);

	return null;
}
