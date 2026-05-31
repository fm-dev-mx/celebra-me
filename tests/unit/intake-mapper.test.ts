import { toInvitationDTO } from '@/lib/dashboard/dto/intake-mapper';
import { toEnrichedInvitationDTO } from '@/lib/intake/services/invitation.service';
import type { Invitation } from '@/lib/intake/types';

const invitation: Invitation = {
	id: 'invitation-123',
	kind: 'client',
	sourceInvitationId: null,
	slug: null,
	title: 'Invitacion interna',
	eventType: 'xv',
	status: 'draft',
	baseDemoId: 'demo-xv-jewelry-box',
	themeId: 'jewelry-box',
	snapshot: {
		id: 'demo-xv-jewelry-box',
		eventType: 'xv',
		displayName: 'Demo',
		themeId: 'jewelry-box',
		defaultSections: [],
		supportedBlocks: ['event-details'],
		recommendedBlocks: ['event-details'],
		requiredAssets: [],
		previewSlug: 'demo-xv-jewelry-box',
	},
	clientName: '',
	clientEmail: '',
	clientWhatsapp: '',
	photosReceived: false,
	createdBy: null,
	archivedAt: null,
	createdAt: '2026-05-30T00:00:00Z',
	updatedAt: '2026-05-30T00:00:00Z',
};

describe('toInvitationDTO', () => {
	it('exposes a stable internal edit URL without requiring a slug or capture token', () => {
		expect(toInvitationDTO(invitation).internalEditUrl).toBe(
			'/dashboard/invitaciones/invitation-123/editar',
		);
	});

	it('marks detail state as published when public content exists', () => {
		expect(
			toEnrichedInvitationDTO(invitation, {
				published: true,
				rsvpEvent: { id: 'event-1', status: 'published' },
			}),
		).toMatchObject({
			published: true,
			rsvpEventId: 'event-1',
			rsvpEventStatus: 'published',
		});
	});
});
