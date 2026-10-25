export interface ConsentSnapshot {
	necessary: true;
	analytics: boolean;
	marketing: boolean;
	/** When the visitor made this choice (`Date#toISOString`); orders choices on the server. */
	decidedAt?: string;
}

/** `Date#toISOString` output only, so the database can order decisions as text. */
export const CONSENT_DECIDED_AT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function normalizeConsentSnapshot(input: unknown): ConsentSnapshot {
	const value = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};

	const snapshot: ConsentSnapshot = {
		necessary: true,
		analytics: value.analytics === true,
		marketing: value.marketing === true,
	};
	if (typeof value.decidedAt === 'string' && CONSENT_DECIDED_AT_PATTERN.test(value.decidedAt)) {
		snapshot.decidedAt = value.decidedAt;
	}
	return snapshot;
}
