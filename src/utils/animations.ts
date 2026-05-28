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
		(el as Element & { _revealCallback?: (target: Element) => void })._revealCallback =
			callback;
		observer!.observe(el);
	});

	return observer;
}

export function initSectionReveal(
	selector: string,
	callbacks?: { onReveal?: (target: Element) => void },
	options?: ObserverOptions,
): void {
	const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	if (prefersReducedMotion) {
		document.querySelectorAll(selector).forEach((el) => {
			el.classList.add('is-visible', 'has-motion');
		});
		return;
	}

	document.querySelectorAll(selector).forEach((el) => {
		el.classList.add('has-motion');
	});

	createIntersectionObserver(
		`${selector}.has-motion`,
		(target) => {
			target.classList.add('is-visible');
			callbacks?.onReveal?.(target);
		},
		options,
	);
}
