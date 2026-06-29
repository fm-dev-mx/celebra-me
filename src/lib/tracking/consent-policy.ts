export interface ConsentSnapshot {
	necessary: true;
	analytics: boolean;
	marketing: boolean;
}

export function normalizeConsentSnapshot(input: unknown): ConsentSnapshot {
	const value = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};

	return {
		necessary: true,
		analytics: value.analytics === true,
		marketing: value.marketing === true,
	};
}
