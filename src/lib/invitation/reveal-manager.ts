/** localStorage key that remembers an opened reveal gate for one invitation. */
export const buildRevealStorageKey = (eventSlug: string): string => `envelope-opened-${eventSlug}`;

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
 */
export function holdPageAtTopWhileGated(): void {
	try {
		history.scrollRestoration = 'manual';
	} catch {
		// Some sandboxed frames refuse; the scroll below still applies.
	}
	window.scrollTo(0, 0);
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
			return window.localStorage.getItem(key) === 'true';
		} catch {
			return false;
		}
	}

	public setStoredFlag(): void {
		if (this.isDemoInvitation) return;
		try {
			window.localStorage.setItem(this.storageKey, 'true');
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
