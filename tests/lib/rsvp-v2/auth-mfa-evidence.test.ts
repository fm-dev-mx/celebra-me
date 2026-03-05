import { decodeJwtPayload, hasMfaEvidence } from '@/lib/rsvp/auth-mfa-evidence';

function makeToken(payload: Record<string, unknown>): string {
	const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
	const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
	return `${header}.${body}.signature`;
}

describe('rsvp authMfaEvidence', () => {
	it('returns true when amr includes totp', () => {
		expect(
			hasMfaEvidence({
				token: 'x.y.z',
				amr: [{ method: 'totp' }],
			}),
		).toBe(true);
	});

	it('returns true when jwt contains aal2 even without amr methods', () => {
		const token = makeToken({ sub: 'user-1', aal: 'aal2' });
		expect(
			hasMfaEvidence({
				token,
				amr: [],
			}),
		).toBe(true);
	});

	it('returns false when neither amr nor jwt show MFA evidence', () => {
		const token = makeToken({ sub: 'user-1', aal: 'aal1' });
		expect(
			hasMfaEvidence({
				token,
				amr: [{ method: 'password' }],
			}),
		).toBe(false);
	});

	it('returns null when token payload cannot be decoded', () => {
		expect(decodeJwtPayload('malformed.token')).toBeNull();
	});
});
