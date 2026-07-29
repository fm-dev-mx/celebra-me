import {
	decodeJwtProjectRef,
	extractApiProjectRef,
} from '../../src/lib/intake/mutations/environment-identity.ts';

export async function verifySupabaseApiCredential(input: {
	apiUrl: string;
	credential: string;
	expectedProjectRef: string;
	fetchImpl?: typeof fetch;
}): Promise<void> {
	const apiProjectRef = extractApiProjectRef(input.apiUrl);
	if (apiProjectRef !== input.expectedProjectRef) {
		throw new Error('Supabase API URL does not match the selected project identity.');
	}

	const encodedProjectRef = decodeJwtProjectRef(input.credential);
	if (encodedProjectRef) {
		if (encodedProjectRef !== input.expectedProjectRef) {
			throw new Error('Supabase API credential belongs to a different project.');
		}
		return;
	}

	const response = await (input.fetchImpl ?? fetch)(`${input.apiUrl}/rest/v1/`, {
		method: 'GET',
		headers: {
			apikey: input.credential,
			Authorization: `Bearer ${input.credential}`,
			Accept: 'application/openapi+json',
		},
		signal: AbortSignal.timeout(5_000),
	});
	if (!response.ok) {
		throw new Error(
			`Supabase API credential could not be verified for the selected project (HTTP ${response.status}).`,
		);
	}
	if (typeof response.body?.cancel === 'function') await response.body.cancel();
}
