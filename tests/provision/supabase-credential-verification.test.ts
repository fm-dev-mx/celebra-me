import { Buffer } from 'node:buffer';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import { verifySupabaseApiCredential } from '../../scripts/provision/supabase-credential-verification.ts';

function jwtForProject(projectRef: string): string {
	const payload = Buffer.from(JSON.stringify({ ref: projectRef })).toString('base64url');
	return `header.${payload}.signature`;
}

describe('managed Supabase credential verification', () => {
	it('accepts an encoded credential for the selected project without a probe', async () => {
		const fetchImpl = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
		await verifySupabaseApiCredential({
			apiUrl: `https://${SUPABASE_PROJECT_REFS.preview}.supabase.co`,
			credential: jwtForProject(SUPABASE_PROJECT_REFS.preview),
			expectedProjectRef: SUPABASE_PROJECT_REFS.preview,
			fetchImpl,
		});
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it('rejects encoded credentials from another project', async () => {
		await expect(
			verifySupabaseApiCredential({
				apiUrl: `https://${SUPABASE_PROJECT_REFS.production}.supabase.co`,
				credential: jwtForProject(SUPABASE_PROJECT_REFS.preview),
				expectedProjectRef: SUPABASE_PROJECT_REFS.production,
			}),
		).rejects.toThrow(/different project/);
	});

	it('probes opaque keys and rejects a failed credential/project pairing', async () => {
		const fetchImpl = jest
			.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
			.mockResolvedValue(new Response('', { status: 401 }));
		await expect(
			verifySupabaseApiCredential({
				apiUrl: `https://${SUPABASE_PROJECT_REFS.production}.supabase.co`,
				credential: 'sb_secret_opaque',
				expectedProjectRef: SUPABASE_PROJECT_REFS.production,
				fetchImpl,
			}),
		).rejects.toThrow(/could not be verified/);
	});
});
