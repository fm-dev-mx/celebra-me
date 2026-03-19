export interface MfaEvidenceInput {
	token: string;
	amr?: Array<{ method?: string }>;
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
	const parts = token.split('.');
	if (parts.length < 2) return null;
	try {
		const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
		const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
		const json = Buffer.from(padded, 'base64').toString('utf8');
		return JSON.parse(json) as Record<string, unknown>;
	} catch {
		return null;
	}
}

export function hasMfaEvidence(input: MfaEvidenceInput): boolean {
	const hasMfaMethod = (input.amr || []).some(
		(item) =>
			item?.method === 'mfa' ||
			item?.method === 'totp' ||
			item?.method === 'otp' ||
			item?.method === 'phone',
	);
	if (hasMfaMethod) return true;

	const payload = decodeJwtPayload(input.token);
	return payload?.aal === 'aal2';
}
