import { toInvitationProjectDTO } from '@/lib/dashboard/dto/intake-mapper';
import { toEnrichedInvitationProjectDTO } from '@/lib/intake/services/invitation-project.service';
import type { InvitationProject } from '@/lib/intake/types';

const project: InvitationProject = {
	id: 'project-123',
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
	createdAt: '2026-05-30T00:00:00Z',
	updatedAt: '2026-05-30T00:00:00Z',
};

describe('toInvitationProjectDTO', () => {
	it('exposes a stable internal edit URL without requiring a slug or capture token', () => {
		expect(toInvitationProjectDTO(project).internalEditUrl).toBe(
			'/dashboard/invitaciones/project-123/editar',
		);
	});

	it('marks detail state as published when public content exists', () => {
		expect(
			toEnrichedInvitationProjectDTO(project, {
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
