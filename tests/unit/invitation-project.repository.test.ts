import {
	findInvitationProjectById,
	createInvitationProject,
	updateInvitationProject,
} from '@/lib/intake/repositories/invitation-project.repository';
import type { DemoPreset } from '@/lib/intake/types';

jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));

import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

const mockSupabaseRequest = supabaseRestRequest as jest.MockedFunction<typeof supabaseRestRequest>;

describe('invitation-project repository', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('findInvitationProjectById', () => {
		it('returns null when no project is found', async () => {
			mockSupabaseRequest.mockResolvedValue([]);

			const result = await findInvitationProjectById('non-existent-id');

			expect(result).toBeNull();
			expect(mockSupabaseRequest).toHaveBeenCalledWith({
				pathWithQuery: expect.stringContaining('id=eq.non-existent-id'),
				useServiceRole: true,
			});
		});

		it('returns the project when found', async () => {
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

			const result = await findInvitationProjectById('proj-123');

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

	describe('createInvitationProject', () => {
		it('creates a new project with all fields', async () => {
			const mockRow = {
				id: 'new-proj-id',
				slug: 'new-event',
				title: 'New Event',
				event_type: 'boda',
				status: 'draft',
				base_demo_id: 'demo-boda-jewelry-box-wedding',
				theme_id: 'jewelry-box-wedding',
				snapshot: {
					id: 'demo-boda-jewelry-box-wedding',
					eventType: 'boda',
					displayName: 'Boda — Jewelry Box Wedding',
					themeId: 'jewelry-box-wedding',
					defaultSections: ['quote'],
					supportedBlocks: ['event-details'],
					recommendedBlocks: ['event-details'],
					requiredAssets: ['hero'],
					previewSlug: 'demo-boda-jewelry-box-wedding',
				} satisfies DemoPreset,
				client_name: 'Jane Doe',
				client_email: 'jane@example.com',
				client_whatsapp: '+521987654321',
				photos_received: false,
				created_by: 'user-789',
				created_at: '2026-05-28T00:00:00Z',
				updated_at: '2026-05-28T00:00:00Z',
			};

			mockSupabaseRequest.mockResolvedValue([mockRow]);

			const result = await createInvitationProject({
				title: 'New Event',
				eventType: 'boda',
				baseDemoId: 'demo-boda-jewelry-box-wedding',
				themeId: 'jewelry-box-wedding',
				snapshot: mockRow.snapshot,
				slug: 'new-event',
				clientName: 'Jane Doe',
				clientEmail: 'jane@example.com',
				clientWhatsapp: '+521987654321',
				createdBy: 'user-789',
			});

			expect(result.id).toBe('new-proj-id');
			expect(result.title).toBe('New Event');
			expect(result.eventType).toBe('boda');
			expect(result.clientName).toBe('Jane Doe');
			expect(result.clientWhatsapp).toBe('+521987654321');

			expect(mockSupabaseRequest).toHaveBeenCalledWith({
				pathWithQuery: expect.stringContaining('invitation_projects'),
				method: 'POST',
				useServiceRole: true,
				prefer: 'return=representation',
				body: {
					title: 'New Event',
					event_type: 'boda',
					base_demo_id: 'demo-boda-jewelry-box-wedding',
					theme_id: 'jewelry-box-wedding',
					snapshot: mockRow.snapshot,
					slug: 'new-event',
					client_name: 'Jane Doe',
					client_email: 'jane@example.com',
					client_whatsapp: '+521987654321',
					created_by: 'user-789',
				},
			});
		});

		it('creates a project without optional fields', async () => {
			const mockRow = {
				id: 'new-proj-id',
				slug: null,
				title: 'Minimal Event',
				event_type: 'xv',
				status: 'draft',
				base_demo_id: 'demo-xv-jewelry-box',
				theme_id: 'jewelry-box',
				snapshot: {},
				client_name: '',
				client_email: '',
				client_whatsapp: '',
				photos_received: false,
				created_by: null,
				created_at: '2026-05-28T00:00:00Z',
				updated_at: '2026-05-28T00:00:00Z',
			};

			mockSupabaseRequest.mockResolvedValue([mockRow]);

			const result = await createInvitationProject({
				title: 'Minimal Event',
				eventType: 'xv',
				baseDemoId: 'demo-xv-jewelry-box',
				themeId: 'jewelry-box',
				snapshot: {} as never,
			});

			expect(result.id).toBe('new-proj-id');
			expect(result.slug).toBeNull();
			expect(result.clientName).toBe('');
			expect(result.clientWhatsapp).toBe('');
			expect(result.photosReceived).toBe(false);
		});

		it('throws an error when creation fails', async () => {
			mockSupabaseRequest.mockResolvedValue([]);

			await expect(
				createInvitationProject({
					title: 'Test',
					eventType: 'xv',
					baseDemoId: 'demo',
					themeId: 'theme',
					snapshot: {} as never,
				}),
			).rejects.toThrow('Failed to create invitation project.');
		});
	});

	describe('updateInvitationProject', () => {
		it('updates project fields', async () => {
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

			const result = await updateInvitationProject('proj-123', {
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

		it('throws an error when project is not found', async () => {
			mockSupabaseRequest.mockResolvedValue([]);

			await expect(
				updateInvitationProject('non-existent', { title: 'Test' }),
			).rejects.toThrow('Invitation project not found.');
		});
	});
});
