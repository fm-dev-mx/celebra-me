jest.mock('astro:content', () => ({ getCollection: jest.fn() }));
jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminMutationAccess: jest.fn().mockResolvedValue({ userId: 'admin-1' }),
	requireAdminStrongSession: jest.fn(),
}));
jest.mock('@/lib/intake/repositories/invitation.repository', () => ({
	createInvitation: jest.fn(),
}));
jest.mock('@/lib/intake/demo-preset-catalog', () => ({
	DEMO_PRESET_CATALOG: [],
	findDemoPreset: jest.fn().mockReturnValue({
		id: 'demo-xv-jewelry-box',
		eventType: 'xv',
		themeId: 'jewelry-box',
	}),
}));

import { POST } from '@/pages/api/dashboard/intake/index';
import { createInvitation as createInvitationRecord } from '@/lib/intake/repositories/invitation.repository';
import { createMockRequest } from '../helpers/api-mocks';

it('returns a stable API validation error for a preset/event-type mismatch', async () => {
	const response = await POST({
		request: createMockRequest({
			title: 'Boda de prueba',
			eventType: 'boda',
			baseDemoId: 'demo-xv-jewelry-box',
		}),
		cookies: {},
	} as never);

	expect(response.status).toBe(422);
	expect(await response.json()).toMatchObject({
		error: {
			code: 'validation_error',
			message: 'El demo base seleccionado no corresponde al tipo de evento.',
			details: { reason: 'base_demo_event_type_mismatch' },
		},
	});
	expect(createInvitationRecord).not.toHaveBeenCalled();
});
