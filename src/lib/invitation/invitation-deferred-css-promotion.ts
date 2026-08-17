export const INVITATION_DEFERRED_CSS_SELECTOR = 'link[data-invitation-deferred-css]';
export const INVITATION_DEFERRED_CSS_PROMOTION_FALLBACK_MS = 8000;
export const ENVELOPE_OPENED_EVENT = 'envelope:opened';
export const FIRST_CONTENTFUL_PAINT = 'first-contentful-paint';

export type DeferredCssPaintEntry = { name: string };

export function shouldPromoteDeferredCssImmediately(input: {
	skipEnvelope: boolean;
	forceEnvelope: boolean;
	isDemo: boolean;
	storedOpened: boolean;
}): boolean {
	return input.skipEnvelope || (!input.isDemo && !input.forceEnvelope && input.storedOpened);
}

export function paintEntriesIncludeFirstContentfulPaint(
	entries: readonly DeferredCssPaintEntry[],
): boolean {
	return entries.some((entry) => entry.name === FIRST_CONTENTFUL_PAINT);
}

export interface DeferredCssPromotionHooks {
	apply: () => void;
	isAlreadyRevealed: () => boolean;
	getPaintEntries: () => readonly DeferredCssPaintEntry[];
	observePaint?: (
		onEntries: (entries: readonly DeferredCssPaintEntry[]) => void,
	) => (() => void) | null;
	onEnvelopeOpened: (onOpen: () => void) => void;
	scheduleTimeout: (onTimeout: () => void, ms: number) => void;
	scheduleAnimationFrameFallback: (onFrame: () => void) => void;
	fallbackMs?: number;
}

/**
 * Idempotent promotion scheduler. First-visit CSS stays deferred until FCP when the
 * paint timeline is available. Reveal and a bounded timeout are secondary so deferred
 * sheets cannot remain at `media="not all"` while invitation content is visible.
 */
export function startInvitationDeferredCssPromotion(hooks: DeferredCssPromotionHooks): {
	promote: () => void;
} {
	let applied = false;
	const promote = () => {
		if (applied) return;
		applied = true;
		hooks.apply();
	};

	try {
		if (hooks.isAlreadyRevealed()) {
			promote();
			return { promote };
		}
	} catch {
		// localStorage / search parsing can fail; continue to paint and reveal paths.
	}

	hooks.onEnvelopeOpened(promote);

	if (paintEntriesIncludeFirstContentfulPaint(hooks.getPaintEntries())) {
		promote();
		return { promote };
	}

	if (typeof hooks.observePaint === 'function') {
		try {
			const disconnect = hooks.observePaint((entries) => {
				if (!paintEntriesIncludeFirstContentfulPaint(entries)) return;
				disconnect?.();
				promote();
			});
			if (disconnect) {
				hooks.scheduleTimeout(
					promote,
					hooks.fallbackMs ?? INVITATION_DEFERRED_CSS_PROMOTION_FALLBACK_MS,
				);
				return { promote };
			}
		} catch {
			// Fall through to animation-frame fallback.
		}
	}

	hooks.scheduleAnimationFrameFallback(promote);
	return { promote };
}

export function buildInvitationDeferredCssPromotionInlineScript(input: {
	storageKey: string;
	isDemo: boolean;
}): string {
	return `(function(){
	const storageKey = ${JSON.stringify(input.storageKey)};
	const isDemo = ${JSON.stringify(input.isDemo)};
	const links = document.querySelectorAll(${JSON.stringify(INVITATION_DEFERRED_CSS_SELECTOR)});
	if (!links.length) return;

	let applied = false;
	function applyDeferredCss() {
		if (applied) return;
		applied = true;
		for (let i = 0; i < links.length; i++) {
			links[i].media = 'all';
		}
	}

	function isAlreadyRevealed() {
		const params = new URLSearchParams(window.location.search);
		const skip = params.get('skipEnvelope') === 'true';
		const force = params.get('forceEnvelope') === 'true';
		return skip || (!isDemo && !force && window.localStorage.getItem(storageKey) === 'true');
	}

	function getPaintEntries() {
		if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') {
			return [];
		}
		return performance.getEntriesByType('paint');
	}

	function paintHasFcp(entries) {
		for (let i = 0; i < entries.length; i++) {
			if (entries[i].name === ${JSON.stringify(FIRST_CONTENTFUL_PAINT)}) return true;
		}
		return false;
	}

	try {
		if (isAlreadyRevealed()) {
			applyDeferredCss();
			return;
		}
	} catch {
		// Ignore localStorage access errors and apply after first paint or reveal.
	}

	window.addEventListener(${JSON.stringify(ENVELOPE_OPENED_EVENT)}, applyDeferredCss, { once: true });

	try {
		if (paintHasFcp(getPaintEntries())) {
			applyDeferredCss();
			return;
		}
	} catch {
		// Ignore paint timeline errors and continue to observer / rAF.
	}

	if (typeof PerformanceObserver === 'function') {
		try {
			const observer = new PerformanceObserver(function (list) {
				if (paintHasFcp(list.getEntries())) {
					observer.disconnect();
					applyDeferredCss();
				}
			});
			observer.observe({ type: 'paint', buffered: true });
			window.setTimeout(applyDeferredCss, ${String(INVITATION_DEFERRED_CSS_PROMOTION_FALLBACK_MS)});
			return;
		} catch {
			// Fall through to rAF.
		}
	}

	const run = function () {
		requestAnimationFrame(function () {
			requestAnimationFrame(applyDeferredCss);
		});
	};
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', run);
	} else {
		run();
	}
})();`;
}
