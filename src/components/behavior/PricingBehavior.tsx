import { useEffect } from 'react';

/**
 * Behavior-only component for the Pricing section:
 * 1. Intersection Observer for reveal animations
 * 2. Feature highlight on hover across tiers
 */
export default function PricingBehavior() {
	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (!entry.isIntersecting) return;
					entry.target.classList.add('is-visible');
					observer.unobserve(entry.target);
				});
			},
			{
				threshold: 0.1,
				rootMargin: '0px 0px -100px 0px',
			},
		);

		const cards = Array.from(document.querySelectorAll('.pricing-card'));
		const featureItems = Array.from(document.querySelectorAll('.feature-item'));
		const cleanups: (() => void)[] = [];

		cards.forEach((card) => observer.observe(card));

		featureItems.forEach((item) => {
			if (!(item instanceof HTMLElement)) return;

			const highlight = () => {
				const feature = item.dataset.feature;
				if (!feature) return;
				document
					.querySelectorAll(`.feature-item[data-feature="${feature}"]`)
					.forEach((element) => element.classList.add('is-highlighted'));
			};

			const unhighlight = () => {
				const feature = item.dataset.feature;
				if (!feature) return;
				document
					.querySelectorAll(`.feature-item[data-feature="${feature}"]`)
					.forEach((element) => element.classList.remove('is-highlighted'));
			};

			item.addEventListener('mouseenter', highlight);
			item.addEventListener('mouseleave', unhighlight);

			cleanups.push(() => {
				item.removeEventListener('mouseenter', highlight);
				item.removeEventListener('mouseleave', unhighlight);
			});
		});

		return () => {
			observer.disconnect();
			cleanups.forEach((cleanup) => cleanup());
		};
	}, []);

	return null;
}
