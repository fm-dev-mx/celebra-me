/**
 * Reusable Intersection Observer utility for triggering animations.
 */

interface ObserverOptions {
	threshold?: number | number[];
	rootMargin?: string;
	once?: boolean;
}

const observerCache = new Map<string, IntersectionObserver>();

export function createIntersectionObserver(
	selector: string,
	callback: (target: Element) => void,
	options: ObserverOptions = {},
) {
	const { threshold = 0.1, rootMargin = '0px 0px -50px 0px', once = true } = options;
	const cacheKey = `${JSON.stringify(threshold)}-${rootMargin}`;

	let observer = observerCache.get(cacheKey);

	if (!observer) {
		observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						// Retrieve the callback associated with this specific element
						const targetCallback = (
							entry.target as Element & {
								_revealCallback?: (target: Element) => void;
							}
						)._revealCallback;
						if (targetCallback) {
							targetCallback(entry.target);
						}
						if (once) {
							observer!.unobserve(entry.target);
						}
					}
				});
			},
			{ threshold, rootMargin },
		);
		observerCache.set(cacheKey, observer);
	}

	const elements = document.querySelectorAll(selector);
	elements.forEach((el) => {
		// Attach the callback to the element so the shared observer can call the right one
		(el as Element & { _revealCallback?: (target: Element) => void })._revealCallback =
			callback;
		observer!.observe(el);
	});

	return observer;
}
