import { commitAtomicPublication } from '@/lib/intake/repositories/publication.repository';
import { SupabaseHttpError, supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	...jest.requireActual('@/lib/rsvp/repositories/supabase'),
	supabaseRestRequest: jest.fn(),
}));

const mockRequest = supabaseRestRequest as jest.MockedFunction<typeof supabaseRestRequest>;

const input = Object.freeze({
	invitationId: 'invitation-1',
	draftId: 'draft-1',
	expectedDraftUpdatedAt: '2026-07-18T00:00:00.000Z',
	expectedPublishedVersion: null,
	publicMetadataHash: 'metadata-hash',
	projectionHash: 'projection-hash',
	idempotencyKey: '00000000-0000-0000-0000-000000000001',
	slug: 'compatibility-test',
	eventType: 'xv',
	isDemo: false,
	content: { title: 'Prueba' },
});

const result = Object.freeze({
	draft: { id: 'draft-1' },
	publishedContent: {
		id: 'published-1',
		slug: 'compatibility-test',
		eventType: 'xv',
		version: 1,
		publishedAt: '2026-07-18T00:00:00.000Z',
	},
});

describe('commitAtomicPublication compatibility', () => {
	beforeEach(() => jest.resetAllMocks());

	it('uses the new contract when it is available', async () => {
		mockRequest.mockResolvedValueOnce(result as never);

		await expect(commitAtomicPublication(input)).resolves.toMatchObject({
			durableIdempotency: true,
		});
		expect(mockRequest).toHaveBeenCalledTimes(1);
	});

	it('falls back only when PostgREST confirms the new overload is unavailable', async () => {
		mockRequest
			.mockRejectedValueOnce(
				new SupabaseHttpError(
					404,
					'{"code":"PGRST202","message":"Could not find the function public.publish_invitation_atomic(p_expected_published_version) in the schema cache"}',
					'PGRST202',
				),
			)
			.mockResolvedValueOnce(result as never);

		await expect(commitAtomicPublication(input)).resolves.toMatchObject({
			durableIdempotency: false,
		});
		expect(mockRequest).toHaveBeenCalledTimes(2);
		expect(mockRequest).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				body: expect.not.objectContaining({
					p_expected_published_version: expect.anything(),
				}),
			}),
		);
	});

	it('does not fall back after a new-contract business error', async () => {
		mockRequest.mockRejectedValueOnce(new Error('Supabase error (409): publish_stale_draft'));

		await expect(commitAtomicPublication(input)).rejects.toMatchObject({
			code: 'conflict',
		});
		expect(mockRequest).toHaveBeenCalledTimes(1);
	});

	it.each([
		[
			'authentication',
			new SupabaseHttpError(401, '{"code":"42501","message":"permission denied"}', '42501'),
		],
		[
			'authorization',
			new SupabaseHttpError(
				403,
				'{"code":"42501","message":"insufficient privilege"}',
				'42501',
			),
		],
		[
			'stale preflight',
			new SupabaseHttpError(409, '{"code":"P0001","message":"publish_stale_draft"}', 'P0001'),
		],
		[
			'concurrent publication',
			new SupabaseHttpError(
				409,
				'{"code":"P0001","message":"publish_stale_published"}',
				'P0001',
			),
		],
		[
			'validation or hash',
			new SupabaseHttpError(
				409,
				'{"code":"P0001","message":"publish_public_contract_mismatch"}',
				'P0001',
			),
		],
		[
			'asset integrity',
			new SupabaseHttpError(
				409,
				'{"code":"P0001","message":"publish_asset_integrity_failed"}',
				'P0001',
			),
		],
		[
			'server failure',
			new SupabaseHttpError(500, '{"code":"XX000","message":"server failure"}', 'XX000'),
		],
		[
			'non-missing PostgREST error',
			new SupabaseHttpError(404, '{"code":"PGRST116","message":"not found"}', 'PGRST116'),
		],
		[
			'malformed success response',
			new Error(
				'Supabase response parse error (200 POST /rest/v1/rpc/publish_invitation_atomic): invalid JSON body',
			),
		],
		['network failure', new TypeError('fetch failed')],
		['timeout', Object.assign(new Error('request timed out'), { name: 'TimeoutError' })],
		['abort', Object.assign(new Error('request aborted'), { name: 'AbortError' })],
		[
			'unstructured missing-overload text',
			new Error('PGRST202 publish_invitation_atomic p_expected_published_version'),
		],
	])('never falls back for %s', async (_scenario, error) => {
		mockRequest.mockRejectedValueOnce(error);

		await expect(commitAtomicPublication(input)).rejects.toThrow();
		expect(mockRequest).toHaveBeenCalledTimes(1);
		expect(mockRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({
					p_expected_published_version: null,
				}),
			}),
		);
	});
});
