import {
	findIntakeRequestById,
	findIntakeRequestByTokenHash,
	findIntakeRequestsByInvitationId,
	createIntakeRequest,
	updateIntakeRequest,
} from '@/lib/intake/repositories/intake-request.repository';

jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));

import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

const mockSupabaseRequest = supabaseRestRequest as jest.MockedFunction<typeof supabaseRestRequest>;

describe('intake-request repository', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('findIntakeRequestById', () => {
		it('returns null when no request is found', async () => {
			mockSupabaseRequest.mockResolvedValue([]);

			const result = await findIntakeRequestById('non-existent-id');

			expect(result).toBeNull();
			expect(mockSupabaseRequest).toHaveBeenCalledWith({
				pathWithQuery: expect.stringContaining('id=eq.non-existent-id'),
				useServiceRole: true,
			});
		});

		it('returns the request when found', async () => {
			const mockRow = {
				id: 'req-123',
				invitation_project_id: 'proj-456',
				token_hash: 'abc123hash',
				token_ciphertext: 'v1.iv.tag.ciphertext',
				status: 'active',
				enabled_blocks: ['event-details', 'photos'],
				expires_at: '2026-06-30T00:00:00Z',
				created_at: '2026-05-28T00:00:00Z',
				updated_at: '2026-05-28T00:00:00Z',
			};

			mockSupabaseRequest.mockResolvedValue([mockRow]);

			const result = await findIntakeRequestById('req-123');

			expect(result).not.toBeNull();
			expect(result?.id).toBe('req-123');
			expect(result?.invitationId).toBe('proj-456');
			expect(result?.tokenHash).toBe('abc123hash');
			expect(result?.tokenCiphertext).toBe('v1.iv.tag.ciphertext');
			expect(result?.status).toBe('active');
			expect(result?.enabledBlocks).toEqual(['event-details', 'photos']);
		});
	});

	describe('findIntakeRequestByTokenHash', () => {
		it('returns null when no request matches the hash', async () => {
			mockSupabaseRequest.mockResolvedValue([]);

			const result = await findIntakeRequestByTokenHash('non-existent-hash');

			expect(result).toBeNull();
			expect(mockSupabaseRequest).toHaveBeenCalledWith({
				pathWithQuery: expect.stringContaining('token_hash=eq.non-existent-hash'),
				useServiceRole: true,
			});
		});

		it('returns the request when hash matches', async () => {
			const mockRow = {
				id: 'req-789',
				invitation_project_id: 'proj-101',
				token_hash: 'matching-hash',
				token_ciphertext: null,
				status: 'active',
				enabled_blocks: ['main-people'],
				expires_at: null,
				created_at: '2026-05-28T00:00:00Z',
				updated_at: '2026-05-28T00:00:00Z',
			};

			mockSupabaseRequest.mockResolvedValue([mockRow]);

			const result = await findIntakeRequestByTokenHash('matching-hash');

			expect(result).not.toBeNull();
			expect(result?.tokenHash).toBe('matching-hash');
		});
	});

	describe('findIntakeRequestsByInvitationId', () => {
		it('filters by origin when a workflow requests client links only', async () => {
			mockSupabaseRequest.mockResolvedValue([]);

			await findIntakeRequestsByInvitationId('proj-123', 'client');

			expect(mockSupabaseRequest).toHaveBeenCalledWith({
				pathWithQuery: expect.stringContaining(
					'invitation_project_id=eq.proj-123&origin=eq.client',
				),
				useServiceRole: true,
			});
		});
	});

	describe('createIntakeRequest', () => {
		it('creates a new request with active status', async () => {
			const mockRow = {
				id: 'new-req-id',
				invitation_project_id: 'proj-123',
				token_hash: 'new-hash',
				token_ciphertext: 'v1.iv.tag.ciphertext',
				status: 'active',
				enabled_blocks: ['event-details', 'photos'],
				expires_at: '2026-06-30T00:00:00Z',
				created_at: '2026-05-28T00:00:00Z',
				updated_at: '2026-05-28T00:00:00Z',
			};

			mockSupabaseRequest.mockResolvedValue([mockRow]);

			const result = await createIntakeRequest({
				invitationId: 'proj-123',
				tokenHash: 'new-hash',
				tokenCiphertext: 'v1.iv.tag.ciphertext',
				enabledBlocks: ['event-details', 'photos'],
				expiresAt: '2026-06-30T00:00:00Z',
			});

			expect(result.id).toBe('new-req-id');
			expect(result.status).toBe('active');
			expect(mockSupabaseRequest).toHaveBeenCalledWith({
				pathWithQuery: expect.stringContaining('intake_requests'),
				method: 'POST',
				useServiceRole: true,
				prefer: 'return=representation',
				body: {
					invitation_project_id: 'proj-123',
					token_hash: 'new-hash',
					token_ciphertext: 'v1.iv.tag.ciphertext',
					origin: 'client',
					enabled_blocks: ['event-details', 'photos'],
					expires_at: '2026-06-30T00:00:00Z',
					status: 'active',
				},
			});
		});

		it('throws an error when creation fails', async () => {
			mockSupabaseRequest.mockResolvedValue([]);

			await expect(
				createIntakeRequest({
					invitationId: 'proj-123',
					tokenHash: 'hash',
					tokenCiphertext: 'v1.iv.tag.ciphertext',
					enabledBlocks: ['event-details'],
					expiresAt: null,
				}),
			).rejects.toThrow('Failed to create intake request.');
		});
	});

	describe('updateIntakeRequest', () => {
		it('updates the request status', async () => {
			const mockRow = {
				id: 'req-123',
				invitation_project_id: 'proj-456',
				token_hash: 'hash',
				token_ciphertext: null,
				status: 'closed',
				enabled_blocks: ['event-details'],
				expires_at: null,
				created_at: '2026-05-28T00:00:00Z',
				updated_at: '2026-05-28T01:00:00Z',
			};

			mockSupabaseRequest.mockResolvedValue([mockRow]);

			const result = await updateIntakeRequest('req-123', {
				status: 'closed',
			});

			expect(result.status).toBe('closed');
			expect(mockSupabaseRequest).toHaveBeenCalledWith({
				pathWithQuery: expect.stringContaining('id=eq.req-123'),
				method: 'PATCH',
				useServiceRole: true,
				prefer: 'return=representation',
				body: { status: 'closed' },
			});
		});

		it('updates token_hash when provided', async () => {
			const mockRow = {
				id: 'req-123',
				invitation_project_id: 'proj-456',
				token_hash: 'new-hash',
				token_ciphertext: 'v1.iv.tag.ciphertext',
				status: 'active',
				enabled_blocks: ['event-details'],
				expires_at: null,
				created_at: '2026-05-28T00:00:00Z',
				updated_at: '2026-05-28T01:00:00Z',
			};

			mockSupabaseRequest.mockResolvedValue([mockRow]);

			const result = await updateIntakeRequest('req-123', {
				tokenHash: 'new-hash',
				tokenCiphertext: 'v1.iv.tag.ciphertext',
			});

			expect(result.tokenHash).toBe('new-hash');
			expect(mockSupabaseRequest).toHaveBeenCalledWith({
				pathWithQuery: expect.stringContaining('id=eq.req-123'),
				method: 'PATCH',
				useServiceRole: true,
				prefer: 'return=representation',
				body: { token_hash: 'new-hash', token_ciphertext: 'v1.iv.tag.ciphertext' },
			});
		});

		it('throws an error when request is not found', async () => {
			mockSupabaseRequest.mockResolvedValue([]);

			await expect(updateIntakeRequest('non-existent', { status: 'closed' })).rejects.toThrow(
				'Intake request not found.',
			);
		});
	});
});
