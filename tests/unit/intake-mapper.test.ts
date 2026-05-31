import { toInvitationProjectDTO } from '@/lib/dashboard/dto/intake-mapper';
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
});
