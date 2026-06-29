/**
 * Client-side consent persistence and observation.
 *
 * Consent state lives in localStorage so it survives page navigation.
 * Third-party modules (GA4, Meta Pixel) observe consent via subscribeConsentChange()
 * to react to real-time consent updates.
 *
 * Default state is necessary-only: analytics and marketing are OFF until
 * the user explicitly accepts or configures them.
 */

export interface ConsentState {
	necessary: true;
	analytics: boolean;
	marketing: boolean;
	updatedAt: string;
}

const STORAGE_KEY = 'cm_consent';

export const CONSENT_DEFAULT: ConsentState = {
	necessary: true as const,
	analytics: false,
	marketing: false,
	updatedAt: new Date(0).toISOString(),
};

type ConsentListener = (state: ConsentState) => void;

const listeners = new Set<ConsentListener>();

/**
 * Read the current consent state from localStorage.
 * Returns the default (necessary-only) if nothing is stored or the stored
 * value is corrupted.
 */
export function readConsent(): ConsentState {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...CONSENT_DEFAULT, updatedAt: new Date().toISOString() };
		const parsed = JSON.parse(raw) as Partial<ConsentState>;
		return {
			necessary: true as const,
			analytics: parsed.analytics === true,
			marketing: parsed.marketing === true,
			updatedAt:
				typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
		};
	} catch {
		return { ...CONSENT_DEFAULT, updatedAt: new Date().toISOString() };
	}
}

/**
 * Persist a new consent state to localStorage and notify all observers.
 * Returns the resolved ConsentState.
 */
export function saveConsent(analytics: boolean, marketing: boolean): ConsentState {
	const state: ConsentState = {
		necessary: true as const,
		analytics,
		marketing,
		updatedAt: new Date().toISOString(),
	};
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		// localStorage may be unavailable (private browsing, quota); degrade gracefully.
	}
	listeners.forEach((fn) => {
		try {
			fn(state);
		} catch {
			// Isolate observer errors so one bad listener doesn't break the rest.
		}
	});
	return state;
}

/**
 * Subscribe to real-time consent changes.
 * Returns an unsubscribe function.
 */
export function subscribeConsentChange(listener: ConsentListener): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/**
 * Check whether the user has made a consent choice (accepted, rejected, or
 * configured) vs. the untouched default.
 */
export function hasConsentDecision(): boolean {
	try {
		return localStorage.getItem(STORAGE_KEY) !== null;
	} catch {
		return false;
	}
}
