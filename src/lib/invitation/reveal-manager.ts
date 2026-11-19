/** localStorage key that remembers an opened reveal gate for one invitation. */
export const buildRevealStorageKey = (eventSlug: string): string => `envelope-opened-${eventSlug}`;

/**
 * How long an opened gate stays open for the same browser: enough for a reload or a return from
 * the map app, short enough that a guest who opens the link again later sees the opening again.
 * The flag stores the opening time; the legacy permanent `'true'` value no longer counts.
 */
export const REVEAL_MEMORY_MS = 12 * 60 * 60 * 1000;

/** Value written when a guest really opens the gate. */
export const buildRevealStoredValue = (now: number = Date.now()): string => String(now);

/** Whether a stored opening time is recent enough to skip the gate. */
export function isStoredRevealFresh(raw: string | null, now: number = Date.now()): boolean {
	const openedAt = Number(raw);
	if (!Number.isFinite(openedAt) || openedAt <= 0) return false;
	const age = now - openedAt;
	return age >= 0 && age < REVEAL_MEMORY_MS;
}

/**
 * The same check as `isStoredRevealFresh`, as a JavaScript expression for inline scripts that
 * run before any module loads. `rawExpression` must evaluate to the stored string or null.
 */
export const buildStoredRevealFreshExpression = (rawExpression: string): string =>
	`(function(v){var t=Number(v);var a=Date.now()-t;return isFinite(t)&&t>0&&a>=0&&a<${REVEAL_MEMORY_MS};})(${rawExpression})`;

/**
 * A stored "already opened" flag skips the gate only on real invitations and only when
 * `?forceEnvelope=true` is absent.
 */
export function shouldRespectStoredReveal(input: {
	isDemo: boolean;
	forceEnvelope: boolean;
	storedOpened: boolean;
}): boolean {
	return !input.isDemo && !input.forceEnvelope && input.storedOpened;
}

/**
 * A closed gate always opens onto the hero. A reload (the footer's "Volver a ver la apertura",
 * or a refresh mid-page) would otherwise restore the old scroll position under the gate, and
 * the reveal would land on the footer.
 *
 * Returns the release to call once the gate opens: it puts back the page's previous scroll
 * restoration, so Back and Forward inside the opened invitation keep their positions.
 */
export function holdPageAtTopWhileGated(): () => void {
	let previous: ScrollRestoration | undefined;
	try {
		previous = history.scrollRestoration;
		history.scrollRestoration = 'manual';
	} catch {
		// Some sandboxed frames refuse; the scroll below still applies.
	}
	// `instant`, not the default: the page's CSS `scroll-behavior: smooth` would otherwise animate
	// the jump from the restored position, and the guest would watch the whole invitation scroll by.
	window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

	let released = false;
	return () => {
		if (released || !previous) return;
		released = true;
		try {
			history.scrollRestoration = previous;
		} catch {
			// Same sandbox refusal as above.
		}
	};
}

export class RevealManager {
	private storageKey: string;
	private isDemoInvitation: boolean;
	private devSkipEnabled: boolean;

	constructor(config: { eventSlug: string; isDemoInvitation: boolean; devSkipEnabled: boolean }) {
		this.isDemoInvitation = config.isDemoInvitation;
		this.devSkipEnabled = config.devSkipEnabled;
		this.storageKey = buildRevealStorageKey(config.eventSlug);
	}

	private getStoredFlag(key: string): boolean {
		try {
			return isStoredRevealFresh(window.localStorage.getItem(key));
		} catch {
			return false;
		}
	}

	public setStoredFlag(): void {
		if (this.isDemoInvitation) return;
		try {
			window.localStorage.setItem(this.storageKey, buildRevealStoredValue());
		} catch {
			// Storage can fail in private mode
		}
	}

	public shouldSkipEnvelope(): boolean {
		const params = new URLSearchParams(window.location.search);
		const canUseDevSkip = this.devSkipEnabled && params.get('skipEnvelope') === 'true';

		return (
			canUseDevSkip ||
			shouldRespectStoredReveal({
				isDemo: this.isDemoInvitation,
				forceEnvelope: params.get('forceEnvelope') === 'true',
				storedOpened: this.getStoredFlag(this.storageKey),
			})
		);
	}
}

export const getMotionPreference = () =>
	window.matchMedia('(prefers-reduced-motion: reduce)').matches;
