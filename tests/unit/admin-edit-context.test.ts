import type { IntakeRequest, IntakeSubmission, Invitation } from '@/lib/intake/types';
import { INTAKE_BLOCK_TYPES, type IntakeBlockType } from '@/lib/intake/types';
import { ensureAdminEditContext } from '@/lib/intake/services/admin-edit.service';

jest.mock('@/lib/intake/repositories/invitation.repository', () => ({
	findInvitationById: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/intake-request.repository', () => ({
	findIntakeRequestsByInvitationId: jest.fn(),
	createIntakeRequest: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/intake-submission.repository', () => ({
	findSubmissionByRequestId: jest.fn(),
	createIntakeSubmission: jest.fn(),
	updateIntakeSubmission: jest.fn(),
}));

import { findInvitationById } from '@/lib/intake/repositories/invitation.repository';
import {
	createIntakeRequest,
	findIntakeRequestsByInvitationId,
} from '@/lib/intake/repositories/intake-request.repository';
import {
	createIntakeSubmission,
	findSubmissionByRequestId,
} from '@/lib/intake/repositories/intake-submission.repository';

const mockFindProject = findInvitationById as jest.MockedFunction<typeof findInvitationById>;
const mockFindRequests = findIntakeRequestsByInvitationId as jest.MockedFunction<
	typeof findIntakeRequestsByInvitationId
>;
const mockCreateRequest = createIntakeRequest as jest.MockedFunction<typeof createIntakeRequest>;
const mockFindSubmission = findSubmissionByRequestId as jest.MockedFunction<
	typeof findSubmissionByRequestId
>;
const mockCreateSubmission = createIntakeSubmission as jest.MockedFunction<
	typeof createIntakeSubmission
>;

const makeProject = (overrides?: Partial<Invitation>): Invitation => ({
	id: 'proj-1',
	kind: 'client',
	sourceInvitationId: null,
	slug: null,
	title: 'Test',
	eventType: 'xv',
	status: 'published',
	baseDemoId: 'demo-xv-jewelry-box',
	themeId: 'jewelry-box',
	snapshot: {
		id: 'demo-xv-jewelry-box',
		eventType: 'xv',
		displayName: 'Test',
		themeId: 'jewelry-box',
		defaultSections: [],
		supportedBlocks: ['event-details', 'main-people'],
		recommendedBlocks: [],
		requiredAssets: [],
		previewSlug: 'test',
	},
	clientName: '',
	clientEmail: '',
	clientWhatsapp: '',
	photosReceived: false,
	createdBy: null,
	archivedAt: null,
	createdAt: '2026-05-30T00:00:00Z',
	updatedAt: '2026-05-30T00:00:00Z',
	...overrides,
});

const makeRequest = (overrides?: Partial<IntakeRequest>): IntakeRequest => ({
	id: 'req-1',
	invitationId: 'proj-1',
	tokenHash: 'internal-edit:proj-1',
	tokenCiphertext: null,
	origin: 'internal',
	status: 'active',
	enabledBlocks: [...INTAKE_BLOCK_TYPES],
	expiresAt: null,
	createdAt: '',
	updatedAt: '',
	...overrides,
});

const makeSubmission = (overrides?: Partial<IntakeSubmission>): IntakeSubmission => ({
	id: 'sub-1',
	intakeRequestId: 'req-1',
	status: 'in_progress',
	blockData: {},
	photoNotes: {},
	clientComments: '',
	submittedAt: null,
	reviewedAt: null,
	reviewNotes: '',
	createdAt: '',
	updatedAt: '',
	...overrides,
});

describe('ensureAdminEditContext enabledBlocks fallback', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('falls back to all block types when recommendedBlocks is empty', async () => {
		const invitation = makeProject({
			snapshot: { ...makeProject().snapshot, recommendedBlocks: [] },
		});
		mockFindProject.mockResolvedValue(invitation);
		mockFindRequests.mockResolvedValue([]);
		mockCreateRequest.mockResolvedValue(makeRequest());
		mockFindSubmission.mockResolvedValue(null);
		mockCreateSubmission.mockResolvedValue(makeSubmission());

		const result = await ensureAdminEditContext('proj-1');

		expect(result.request.enabledBlocks.length).toBeGreaterThan(0);
		expect(result.request.enabledBlocks).toContain('event-details');
	});

	it('uses client request enabledBlocks when available', async () => {
		const invitation = makeProject();
		mockFindProject.mockResolvedValue(invitation);
		mockFindRequests.mockResolvedValue([
			makeRequest({
				id: 'req-client',
				tokenHash: 'hash',
				origin: 'client',
				status: 'submitted',
				enabledBlocks: ['event-details', 'main-people'],
			}),
		]);
		mockCreateRequest.mockResolvedValue(
			makeRequest({ id: 'req-internal', enabledBlocks: ['event-details', 'main-people'] }),
		);
		mockFindSubmission.mockResolvedValue(null);
		mockCreateSubmission.mockResolvedValue(makeSubmission({ intakeRequestId: 'req-internal' }));

		const result = await ensureAdminEditContext('proj-1');
		expect(result.request.enabledBlocks).toEqual(['event-details', 'main-people']);
	});

	it('never returns empty enabledBlocks', async () => {
		const invitation = makeProject({
			snapshot: { ...makeProject().snapshot, recommendedBlocks: [] as IntakeBlockType[] },
		});
		mockFindProject.mockResolvedValue(invitation);
		mockFindRequests.mockResolvedValue([]);
		mockCreateRequest.mockResolvedValue(makeRequest());
		mockFindSubmission.mockResolvedValue(null);
		mockCreateSubmission.mockResolvedValue(makeSubmission());

		const result = await ensureAdminEditContext('proj-1');
		expect(result.request.enabledBlocks.length).toBeGreaterThan(0);
	});
});
