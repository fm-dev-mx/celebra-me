import type { DemoPreset } from '@/lib/intake/types';

jest.mock('@/lib/intake/repositories/invitation.repository', () => ({
	findInvitationById: jest.fn(),
	assignInvitationOwner: jest.fn(),
}));

import { assignInvitationOwnerService } from '@/lib/intake/services/invitation.service';
import {
	findInvitationById,
	assignInvitationOwner,
} from '@/lib/intake/repositories/invitation.repository';
import type { Invitation } from '@/lib/intake/types';

const mockFindInvitation = jest.mocked(findInvitationById);
const mockAssignOwner = jest.mocked(assignInvitationOwner);

const VALID_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_USER_ID = '550e8400-e29b-41d4-a716-446655440099';

const demoPreset: DemoPreset = {
	id: 'demo-xv',
	eventType: 'xv',
	displayName: 'Test Demo',
	themeId: 'jewelry-box',
	defaultSections: ['gallery', 'location', 'rsvp'],
	supportedBlocks: [
		'event-details',
		'main-people',
		'date-locations',
		'photos',
		'rsvp-config',
		'gifts',
		'special-messages',
	],
	recommendedBlocks: ['event-details', 'main-people', 'date-locations'],
	requiredAssets: ['hero', 'portrait', 'gallery01', 'gallery02', 'gallery03'],
	previewSlug: 'test',
};

function clientInvitation(overrides?: Partial<Invitation>): Invitation {
	return {
		id: 'inv-1',
		kind: 'client',
		createdBy: null,
		slug: 'test',
		title: 'Test',
		eventType: 'xv',
		status: 'draft',
		baseDemoId: 'demo-xv',
		themeId: 'jewelry-box',
		snapshot: demoPreset,
		clientName: '',
		clientEmail: '',
		clientWhatsapp: '',
		photosReceived: false,
		archivedAt: null,
		createdAt: '2026-01-01T00:00:00Z',
		updatedAt: '2026-01-01T00:00:00Z',
		sourceInvitationId: null,
		...overrides,
	};
}

beforeEach(() => {
	jest.clearAllMocks();
});

describe('assignInvitationOwnerService', () => {
	it('rejects when invitation is not found', async () => {
		mockFindInvitation.mockResolvedValue(null);

		await expect(assignInvitationOwnerService('inv-1', VALID_USER_ID)).rejects.toMatchObject({
			status: 404,
			code: 'not_found',
		});

		expect(mockAssignOwner).not.toHaveBeenCalled();
	});

	it('rejects when invitation kind is not client', async () => {
		mockFindInvitation.mockResolvedValue(clientInvitation({ kind: 'demo' }));

		await expect(assignInvitationOwnerService('inv-1', VALID_USER_ID)).rejects.toMatchObject({
			status: 422,
			code: 'bad_request',
		});

		expect(mockAssignOwner).not.toHaveBeenCalled();
	});

	it('rejects reassignment when createdBy is already set', async () => {
		mockFindInvitation.mockResolvedValue(clientInvitation({ createdBy: OTHER_USER_ID }));

		await expect(assignInvitationOwnerService('inv-1', VALID_USER_ID)).rejects.toMatchObject({
			status: 409,
			code: 'conflict',
		});

		expect(mockAssignOwner).not.toHaveBeenCalled();
	});

	it('assigns owner when all preconditions are met', async () => {
		mockFindInvitation.mockResolvedValue(clientInvitation());
		mockAssignOwner.mockResolvedValue(clientInvitation({ createdBy: VALID_USER_ID }));

		const result = await assignInvitationOwnerService('inv-1', VALID_USER_ID);

		expect(result.createdBy).toBe(VALID_USER_ID);
		expect(mockAssignOwner).toHaveBeenCalledWith('inv-1', VALID_USER_ID);
	});
});
