/**
 * Reusable Intersection Observer utility for triggering animations.
 */

interface ObserverOptions {
	threshold?: number | number[];
	rootMargin?: string;
	once?: boolean;
}

export function createIntersectionObserver(
	selector: string,
	callback: (target: Element) => void,
	options: ObserverOptions = {},
) {
	const { threshold = 0.1, rootMargin = '0px 0px -50px 0px', once = true } = options;

	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					callback(entry.target);
					if (once) {
						observer.unobserve(entry.target);
					}
				}
			});
		},
		{ threshold, rootMargin },
	);

	const elements = document.querySelectorAll(selector);
	elements.forEach((el) => observer.observe(el));

	return observer;
}
