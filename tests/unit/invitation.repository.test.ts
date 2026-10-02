import {
	findInvitationById,
	isInvitationArchivedBySlug,
	updateInvitation,
	assignInvitationOwner,
} from '@/lib/intake/repositories/invitation.repository';
import type { DemoPreset } from '@/lib/intake/types';

jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));

import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

const mockSupabaseRequest = supabaseRestRequest as jest.MockedFunction<typeof supabaseRestRequest>;

describe('invitation repository', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('isInvitationArchivedBySlug', () => {
		it.each([
			{ rows: [], expected: false },
			{ rows: [{ archived_at: null }], expected: false },
			{ rows: [{ archived_at: '2026-01-01T00:00:00Z' }], expected: true },
		])('reads only the archive marker and returns $expected', async ({ rows, expected }) => {
			mockSupabaseRequest.mockResolvedValue(rows);
			expect(await isInvitationArchivedBySlug('demo & test')).toBe(expected);
			expect(mockSupabaseRequest).toHaveBeenCalledTimes(1);
			expect(mockSupabaseRequest).toHaveBeenCalledWith({
				pathWithQuery: 'invitations?select=archived_at&slug=eq.demo%20%26%20test&limit=1',
				useServiceRole: true,
			});
		});

		it('propagates database errors instead of treating an unknown state as active', async () => {
			const error = new Error('database unavailable');
			mockSupabaseRequest.mockRejectedValue(error);
			await expect(isInvitationArchivedBySlug('demo')).rejects.toBe(error);
		});
	});

	describe('findInvitationById', () => {
		it('returns null when no invitation is found', async () => {
			mockSupabaseRequest.mockResolvedValue([]);

			const result = await findInvitationById('non-existent-id');

			expect(result).toBeNull();
			expect(mockSupabaseRequest).toHaveBeenCalledWith({
				pathWithQuery: expect.stringContaining('id=eq.non-existent-id'),
				useServiceRole: true,
			});
		});

		it('returns the invitation when found', async () => {
			const mockRow = {
				id: 'proj-123',
				slug: 'test-event',
				title: 'Test Event',
				event_type: 'xv',
				status: 'draft',
				base_demo_id: 'demo-xv-jewelry-box',
				theme_id: 'jewelry-box',
				snapshot: {
					id: 'demo-xv-jewelry-box',
					eventType: 'xv',
					displayName: 'XV Años — Jewelry Box',
					themeId: 'jewelry-box',
					defaultSections: ['quote', 'family'],
					supportedBlocks: ['event-details', 'photos'],
					recommendedBlocks: ['event-details'],
					requiredAssets: ['hero'],
					previewSlug: 'demo-xv-jewelry-box',
				} satisfies DemoPreset,
				client_name: 'John Doe',
				client_email: 'john@example.com',
				client_whatsapp: '+521234567890',
				photos_received: false,
				created_by: 'user-456',
				created_at: '2026-05-28T00:00:00Z',
				updated_at: '2026-05-28T00:00:00Z',
			};

			mockSupabaseRequest.mockResolvedValue([mockRow]);

			const result = await findInvitationById('proj-123');

			expect(result).not.toBeNull();
			expect(result?.id).toBe('proj-123');
			expect(result?.slug).toBe('test-event');
			expect(result?.title).toBe('Test Event');
			expect(result?.eventType).toBe('xv');
			expect(result?.status).toBe('draft');
			expect(result?.clientName).toBe('John Doe');
			expect(result?.clientEmail).toBe('john@example.com');
			expect(result?.clientWhatsapp).toBe('+521234567890');
			expect(result?.photosReceived).toBe(false);
		});
	});

	describe('updateInvitation', () => {
		it('updates invitation fields', async () => {
			const mockRow = {
				id: 'proj-123',
				slug: 'updated-slug',
				title: 'Updated Title',
				event_type: 'xv',
				status: 'waiting_for_client',
				base_demo_id: 'demo-xv-jewelry-box',
				theme_id: 'jewelry-box',
				snapshot: {},
				client_name: 'Updated Name',
				client_email: 'updated@example.com',
				client_whatsapp: '+521111111111',
				photos_received: true,
				created_by: 'user-456',
				created_at: '2026-05-28T00:00:00Z',
				updated_at: '2026-05-28T01:00:00Z',
			};

			mockSupabaseRequest.mockResolvedValue([mockRow]);

			const result = await updateInvitation('proj-123', {
				title: 'Updated Title',
				slug: 'updated-slug',
				status: 'waiting_for_client',
				clientName: 'Updated Name',
				clientEmail: 'updated@example.com',
				clientWhatsapp: '+521111111111',
				photosReceived: true,
			});

			expect(result.title).toBe('Updated Title');
			expect(result.slug).toBe('updated-slug');
			expect(result.status).toBe('waiting_for_client');
			expect(result.clientName).toBe('Updated Name');
			expect(result.clientWhatsapp).toBe('+521111111111');
			expect(result.photosReceived).toBe(true);

			expect(mockSupabaseRequest).toHaveBeenCalledWith({
				pathWithQuery: expect.stringContaining('id=eq.proj-123'),
				method: 'PATCH',
				useServiceRole: true,
				prefer: 'return=representation',
				body: {
					title: 'Updated Title',
					slug: 'updated-slug',
					status: 'waiting_for_client',
					client_name: 'Updated Name',
					client_email: 'updated@example.com',
					client_whatsapp: '+521111111111',
					photos_received: true,
				},
			});
		});

		it('throws an error when invitation is not found', async () => {
			mockSupabaseRequest.mockResolvedValue([]);

			await expect(updateInvitation('non-existent', { title: 'Test' })).rejects.toThrow(
				'Invitation not found.',
			);
		});
	});

	describe('assignInvitationOwner', () => {
		it('only assigns an owner when the invitation is still unowned', async () => {
			mockSupabaseRequest.mockResolvedValue([
				{
					id: 'proj-123',
					kind: 'client',
					slug: 'test-event',
					title: 'Test Event',
					event_type: 'xv',
					status: 'draft',
					base_demo_id: 'demo-xv-jewelry-box',
					theme_id: 'jewelry-box',
					snapshot: {} as DemoPreset,
					client_name: 'John Doe',
					client_email: 'john@example.com',
					client_whatsapp: '+521234567890',
					photos_received: false,
					created_by: 'user-456',
					archived_at: null,
					created_at: '2026-05-28T00:00:00Z',
					updated_at: '2026-05-28T00:00:00Z',
				},
			]);

			await assignInvitationOwner('proj-123', 'user-456');

			expect(mockSupabaseRequest).toHaveBeenCalledWith({
				pathWithQuery: expect.stringContaining('id=eq.proj-123&created_by=is.null'),
				method: 'PATCH',
				useServiceRole: true,
				prefer: 'return=representation',
				body: {
					created_by: 'user-456',
				},
			});
		});
	});
});
