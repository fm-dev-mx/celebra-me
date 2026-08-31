import { VALENTINA_MEMORIES_EVENT_ID } from '@/data/valentina-memories-upload.contract';
import { reserveGuestMemoryItem } from '@/lib/memories/valentina-memories.service';

jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
	SupabaseHttpError: class SupabaseHttpError extends Error {},
}));
jest.mock('@/lib/rsvp/repositories/event.repository', () => ({
	findEventBySlugService: jest.fn(),
}));
jest.mock('@/lib/rsvp/repositories/role-membership.repository', () => ({
	findMembershipByEventForHost: jest.fn(),
}));
jest.mock('@/lib/memories/valentina-memories-audit', () => ({
	appendValentinaMemoriesAudit: jest.fn(),
}));
jest.mock('@/lib/memories/valentina-memories-retrieval', () => ({
	inspectValentinaMemoryObject: jest.fn(),
	retrieveValentinaMemoryObject: jest.fn(),
}));
jest.mock('@/lib/memories/valentina-memories-upload-request', () => ({
	requestValentinaMemoryUploadCapability: jest.fn(),
}));

import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { requestValentinaMemoryUploadCapability } from '@/lib/memories/valentina-memories-upload-request';

const mockRestRequest = supabaseRestRequest as jest.MockedFunction<typeof supabaseRestRequest>;
const mockUploadCapability = requestValentinaMemoryUploadCapability as jest.MockedFunction<
	typeof requestValentinaMemoryUploadCapability
>;
const CHECKSUM = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ITEM_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const OBJECT_KEY = 'events/valentina/33333333-3333-4333-8333-333333333333.jpg';

function reservedRow() {
	return {
		id: ITEM_ID,
		event_key: VALENTINA_MEMORIES_EVENT_ID,
		session_id: SESSION_ID,
		object_key: OBJECT_KEY,
		mime_type: 'image/jpeg',
		size_bytes: 100,
		checksum_sha256: CHECKSUM,
		duration_seconds: null,
		caption: '',
		status: 'uploading',
		duplicate_of_id: null,
		created_at: '2026-08-29T00:00:00.000Z',
		updated_at: '2026-08-29T00:00:00.000Z',
		accepted_at: null,
		rejected_at: null,
		deleted_at: null,
		idempotency_key: '44444444-4444-4444-8444-444444444444',
		cleanup_after: null,
		cleanup_claimed_at: null,
		cleanup_lease_id: null,
		object_deleted_at: null,
	};
}

describe('Valentina reservation recovery after signer failure', () => {
	beforeEach(() => jest.clearAllMocks());

	it('replays the same atomic reservation and signer input on an idempotent retry', async () => {
		mockRestRequest.mockResolvedValue([reservedRow()] as never);
		mockUploadCapability
			.mockRejectedValueOnce(new Error('synthetic signer failure'))
			.mockResolvedValueOnce({
				uploadUrl: 'https://synthetic.r2.cloudflarestorage.com/private',
				requiredHeaders: {
					'Content-Type': 'image/jpeg',
					'If-None-Match': '*',
					'x-amz-checksum-sha256': 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=',
				},
				expiresAt: '2026-08-29T00:05:00.000Z',
			});
		const input = {
			session: {
				id: SESSION_ID,
				event_key: VALENTINA_MEMORIES_EVENT_ID,
				token_hash: 'token-hash',
				recovery_code_hash: 'recovery-hash',
				display_name: 'Synthetic guest',
				guest_alias: 'invitado-12345678',
				last_seen_at: '2026-08-29T00:00:00.000Z',
				expires_at: '2026-08-30T00:00:00.000Z',
				revoked_at: null,
				created_at: '2026-08-29T00:00:00.000Z',
			},
			mimeType: 'image/jpeg',
			sizeBytes: 100,
			checksumSha256: CHECKSUM,
			clientRequestId: '44444444-4444-4444-8444-444444444444',
		};

		await expect(reserveGuestMemoryItem(input)).rejects.toThrow('synthetic signer failure');
		await expect(reserveGuestMemoryItem(input)).resolves.toMatchObject({
			item: { id: ITEM_ID, status: 'uploading' },
		});

		expect(mockRestRequest).toHaveBeenCalledTimes(2);
		expect(mockRestRequest.mock.calls[0][0]).toMatchObject({
			pathWithQuery: 'rpc/reserve_valentina_memory_item',
			body: { p_idempotency_key: input.clientRequestId },
		});
		expect(mockRestRequest.mock.calls[1][0]).toMatchObject({
			pathWithQuery: 'rpc/reserve_valentina_memory_item',
			body: { p_idempotency_key: input.clientRequestId },
		});
		expect(mockUploadCapability).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ objectKey: OBJECT_KEY, sessionId: SESSION_ID }),
		);
		expect(mockUploadCapability).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ objectKey: OBJECT_KEY, sessionId: SESSION_ID }),
		);
	});
});
