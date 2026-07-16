interface ObserverOptions {
	threshold?: number | number[];
	rootMargin?: string;
	onObserved?: (target: Element) => void;
	onFallback?: (target: Element) => void;
	failOpenAfterMs?: number;
	once?: boolean;
}

const DEFAULT_FAIL_OPEN_MS = 8000;

export function createIntersectionObserver(
	selector: string,
	callback: (target: Element) => void,
	options: ObserverOptions = {},
): IntersectionObserver | null {
	const {
		threshold = 0.1,
		rootMargin = '0px 0px -50px 0px',
		onObserved,
		onFallback,
		failOpenAfterMs = DEFAULT_FAIL_OPEN_MS,
		once = true,
	} = options;
	const elements = Array.from(document.querySelectorAll(selector));
	const revealed = new Set<Element>();
	let observer: IntersectionObserver | null = null;

	const reveal = (target: Element) => {
		if (once && revealed.has(target)) return;
		revealed.add(target);
		callback(target);
		if (once) observer?.unobserve(target);
	};

	const failOpen = () => {
			elements.forEach((target) => {
				if (!revealed.has(target)) onFallback?.(target);
				reveal(target);
			});
		};

	if (elements.length === 0) return null;
	if (typeof window.IntersectionObserver !== 'function') {
		failOpen();
		return null;
	}

	try {
		observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) reveal(entry.target);
				});
			},
			{ threshold, rootMargin },
		);

		elements.forEach((target) => {
			observer!.observe(target);
			onObserved?.(target);
		});
	} catch {
		observer?.disconnect();
		failOpen();
		return null;
	}

	window.setTimeout(failOpen, failOpenAfterMs);
	return observer;
}

export function initSectionReveal(
	selector: string,
	callbacks?: { onReveal?: (target: Element) => void },
	options?: ObserverOptions,
): void {
	const sections = Array.from(document.querySelectorAll(selector));
	const reveal = (target: Element) => {
		target.classList.add('is-visible');
		callbacks?.onReveal?.(target);
	};

	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		sections.forEach(reveal);
		return;
	}

	createIntersectionObserver(selector, reveal, {
		...options,
		onObserved: (target) => {
			target.classList.add('has-motion');
			options?.onObserved?.(target);
		},
		onFallback: (target) => {
			target.classList.remove('has-motion');
			options?.onFallback?.(target);
		},
	});
}
