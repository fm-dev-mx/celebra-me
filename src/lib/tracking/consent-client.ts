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

/** localStorage key of the commercial tracking visitor ID, written by the tracking client. */
export const VISITOR_STORAGE_KEY = 'cm_visitor_id';

/**
 * localStorage key of the hashed phone the Meta Pixel sends as `ph` after the «Aparta su fecha»
 * form (meta-pixel.ts). It is deleted here when marketing consent is withdrawn.
 */
export const META_PHONE_MATCH_STORAGE_KEY = 'cm_meta_ph';

const CONSENT_DEFAULT: ConsentState = {
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
	if (marketing) {
		clearPendingWithdrawal();
	} else {
		clearMetaPhoneMatchKey();
		queueMarketingWithdrawal(state);
	}
	return state;
}

/** localStorage key of a withdrawal the server has not confirmed yet. */
const PENDING_WITHDRAWAL_KEY = 'cm_consent_withdrawal_pending';

interface PendingWithdrawal {
	visitorId: string;
	analytics: boolean;
	decidedAt: string;
}

function clearPendingWithdrawal(): void {
	try {
		localStorage.removeItem(PENDING_WITHDRAWAL_KEY);
	} catch {
		// Nothing to clear when localStorage is unavailable.
	}
}

function clearMetaPhoneMatchKey(): void {
	try {
		localStorage.removeItem(META_PHONE_MATCH_STORAGE_KEY);
	} catch {
		// Nothing to clear when localStorage is unavailable.
	}
}

/**
 * Tell the server that marketing consent is off so it stops sending this visitor's queued
 * conversions to Meta. The withdrawal stays pending in localStorage until the server confirms
 * it; visitors that were never tracked have no ID and send nothing.
 */
function queueMarketingWithdrawal(state: ConsentState): void {
	let pending: PendingWithdrawal;
	try {
		const visitorId = localStorage.getItem(VISITOR_STORAGE_KEY);
		if (!visitorId) return;
		pending = { visitorId, analytics: state.analytics, decidedAt: state.updatedAt };
		localStorage.setItem(PENDING_WITHDRAWAL_KEY, JSON.stringify(pending));
	} catch {
		return;
	}
	sendWithdrawal(pending);
}

/** Resend a withdrawal that a previous page could not deliver. Call once per page load. */
export function retryPendingConsentWithdrawal(): void {
	let pending: PendingWithdrawal | null;
	try {
		const raw = localStorage.getItem(PENDING_WITHDRAWAL_KEY);
		pending = raw ? (JSON.parse(raw) as PendingWithdrawal) : null;
	} catch {
		return;
	}
	if (pending?.visitorId && pending.decidedAt) sendWithdrawal(pending);
}

function sendWithdrawal(pending: PendingWithdrawal): void {
	try {
		void fetch('/api/tracking/consent', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(pending),
			keepalive: true,
		})
			.then((response) => {
				if (response.ok) clearConfirmedWithdrawal(pending.decidedAt);
			})
			.catch(() => {
				// The pending withdrawal is resent on the next page load.
			});
	} catch {
		// Degrade gracefully if keepalive fetch is not supported/throws.
	}
}

/** Clear the pending withdrawal unless a newer choice replaced it meanwhile. */
function clearConfirmedWithdrawal(decidedAt: string): void {
	try {
		const raw = localStorage.getItem(PENDING_WITHDRAWAL_KEY);
		const current = raw ? (JSON.parse(raw) as Partial<PendingWithdrawal>) : null;
		if (current?.decidedAt === decidedAt) localStorage.removeItem(PENDING_WITHDRAWAL_KEY);
	} catch {
		// Keep the pending withdrawal; resending it is harmless.
	}
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
