import { useEffect } from 'react';

interface Props {
	selector: string;
	className?: string;
	rootMargin?: string;
	threshold?: number;
	setAnimationDelayFromData?: boolean;
}

/**
 * Behavior-only component that adds the 'is-visible' class to elements matched by a selector
 * when they enter the viewport.
 */
export default function RevealOnIntersect({
	selector,
	className = 'is-visible',
	rootMargin = '0px 0px -50px 0px',
	threshold = 0.15,
	setAnimationDelayFromData = false,
}: Props) {
	useEffect(() => {
		const elements = Array.from(document.querySelectorAll(selector));
		if (elements.length === 0) return;

		if (setAnimationDelayFromData) {
			elements.forEach((element) => {
				if (element instanceof HTMLElement && element.dataset.delay) {
					element.style.setProperty('--animation-delay', element.dataset.delay);
				}
			});
		}

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (!entry.isIntersecting) return;
					entry.target.classList.add(className);
					observer.unobserve(entry.target);
				});
			},
			{ rootMargin, threshold },
		);

		elements.forEach((element) => observer.observe(element));

		return () => {
			observer.disconnect();
		};
	}, [className, rootMargin, selector, setAnimationDelayFromData, threshold]);

	return null;
}
