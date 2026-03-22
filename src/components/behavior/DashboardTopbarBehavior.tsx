import { useEffect } from 'react';

/**
 * Behavior-only component for the dashboard topbar:
 * 1. Scrolled shadow effect
 * 2. Auto-hide on scroll down
 */
export default function DashboardTopbarBehavior() {
	useEffect(() => {
		const topbar = document.querySelector('.dashboard-topbar') as HTMLElement;
		if (!topbar) return;

		let lastScrollY = window.scrollY;
		let isHidden = false;
		const SCROLL_THRESHOLD = 50;

		const handleScroll = () => {
			const currentScrollY = window.scrollY;

			// 1. Scrolled shadow effect
			if (currentScrollY > 20) {
				topbar.classList.add('dashboard-topbar--scrolled');
			} else {
				topbar.classList.remove('dashboard-topbar--scrolled');
			}

			// 2. Hide/Show logic
			if (currentScrollY > SCROLL_THRESHOLD) {
				if (currentScrollY > lastScrollY && !isHidden) {
					topbar.classList.add('dashboard-topbar--hidden');
					isHidden = true;
				} else if (currentScrollY < lastScrollY && isHidden) {
					topbar.classList.remove('dashboard-topbar--hidden');
					isHidden = false;
				}
			} else {
				topbar.classList.remove('dashboard-topbar--hidden');
				isHidden = false;
			}

			lastScrollY = currentScrollY;
		};

		window.addEventListener('scroll', handleScroll, { passive: true });

		return () => {
			window.removeEventListener('scroll', handleScroll);
		};
	}, []);

	return null;
}
