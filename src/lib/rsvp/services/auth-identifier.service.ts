import { findAuthUserByLoginIdentifier } from '@/lib/rsvp/auth/auth-api';

export async function resolvePasswordAuthEmail(identifier: string): Promise<string | null> {
	if (!identifier || identifier.includes('@')) {
		return identifier || null;
	}

	const authUser = await findAuthUserByLoginIdentifier({ identifier });
	return authUser?.email?.trim().toLowerCase() || null;
}
