jest.mock('@/lib/intake/repositories/invitation-project.repository', () => ({
	findInvitationProjectById: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/intake-request.repository', () => ({
	findIntakeRequestsByProjectId: jest.fn(),
	createIntakeRequest: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/intake-submission.repository', () => ({
	findSubmissionByRequestId: jest.fn(),
	createIntakeSubmission: jest.fn(),
	updateIntakeSubmission: jest.fn(),
}));

import { findInvitationProjectById } from '@/lib/intake/repositories/invitation-project.repository';
import {
	createIntakeRequest,
	findIntakeRequestsByProjectId,
} from '@/lib/intake/repositories/intake-request.repository';
import {
	createIntakeSubmission,
	findSubmissionByRequestId,
	updateIntakeSubmission,
} from '@/lib/intake/repositories/intake-submission.repository';
import {
	ensureInternalEditContext,
	saveInternalComments,
} from '@/lib/intake/services/internal-edit.service';
import { hashIntakeToken } from '@/lib/intake/services/intake-token.service';
import type { InvitationProject } from '@/lib/intake/types';

const mockFindProject = findInvitationProjectById as jest.MockedFunction<
	typeof findInvitationProjectById
>;
const mockFindRequests = findIntakeRequestsByProjectId as jest.MockedFunction<
	typeof findIntakeRequestsByProjectId
>;
const mockCreateRequest = createIntakeRequest as jest.MockedFunction<typeof createIntakeRequest>;
const mockFindSubmission = findSubmissionByRequestId as jest.MockedFunction<
	typeof findSubmissionByRequestId
>;
const mockCreateSubmission = createIntakeSubmission as jest.MockedFunction<
	typeof createIntakeSubmission
>;
const mockUpdateSubmission = updateIntakeSubmission as jest.MockedFunction<
	typeof updateIntakeSubmission
>;

const project: InvitationProject = {
	id: 'proj-1',
	slug: null,
	title: 'Proyecto interno',
	eventType: 'xv' as const,
	status: 'published' as const,
	baseDemoId: 'demo-xv-jewelry-box',
	themeId: 'jewelry-box',
	snapshot: {
		id: 'demo-xv-jewelry-box',
		eventType: 'xv' as const,
		displayName: 'Demo XV',
		themeId: 'jewelry-box' as const,
		defaultSections: [],
		supportedBlocks: ['event-details', 'photos'],
		recommendedBlocks: ['event-details', 'photos'],
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

const request = {
	id: 'req-1',
	invitationProjectId: 'proj-1',
	tokenHash: 'existing-hash',
	tokenCiphertext: null,
	origin: 'client' as const,
	status: 'submitted' as const,
	enabledBlocks: ['event-details' as const],
	expiresAt: null,
	createdAt: '2026-05-30T00:00:00Z',
	updatedAt: '2026-05-30T00:00:00Z',
};

const submission = {
	id: 'sub-1',
	intakeRequestId: 'req-1',
	status: 'approved' as const,
	blockData: {},
	photoNotes: {},
	clientComments: '',
	submittedAt: null,
	reviewedAt: null,
	reviewNotes: '',
	createdAt: '2026-05-30T00:00:00Z',
	updatedAt: '2026-05-30T00:00:00Z',
};

beforeEach(() => {
	jest.clearAllMocks();
	mockFindProject.mockResolvedValue(project);
});

describe('ensureInternalEditContext', () => {
	it('reuses the latest request and approved submission without applying client locks', async () => {
		const internalRequest = { ...request, origin: 'internal' as const };
		mockFindRequests.mockResolvedValue([internalRequest]);
		mockFindSubmission.mockResolvedValue(submission);

		const result = await ensureInternalEditContext('proj-1');

		expect(result).toEqual({ project, request: internalRequest, submission });
		expect(mockCreateRequest).not.toHaveBeenCalled();
		expect(mockCreateSubmission).not.toHaveBeenCalled();
	});

	it('creates an internal-only request and submission when the project has no intake request', async () => {
		const internalRequest = {
			...request,
			tokenHash: hashIntakeToken('internal-edit:proj-1'),
			tokenCiphertext: null,
			origin: 'internal' as const,
			status: 'active' as const,
			enabledBlocks: ['event-details' as const, 'photos' as const],
		};
		const internalSubmission = { ...submission, status: 'in_progress' as const };
		mockFindRequests.mockResolvedValue([]);
		mockCreateRequest.mockResolvedValue(internalRequest);
		mockFindSubmission.mockResolvedValue(null);
		mockCreateSubmission.mockResolvedValue(internalSubmission);

		const result = await ensureInternalEditContext('proj-1');

		expect(mockCreateRequest).toHaveBeenCalledWith({
			invitationProjectId: 'proj-1',
			tokenHash: hashIntakeToken('internal-edit:proj-1'),
			tokenCiphertext: null,
			origin: 'internal',
			enabledBlocks: ['event-details', 'photos'],
			expiresAt: null,
		});
		expect(mockCreateSubmission).toHaveBeenCalledWith({
			intakeRequestId: 'req-1',
			blockData: {},
		});
		expect(result.submission).toEqual(internalSubmission);
	});

	it('creates a separate internal request and seeds it from the client submission', async () => {
		const clientSubmission = {
			...submission,
			blockData: { 'event-details': { celebrantName: 'Ana' } },
		};
		const internalRequest = {
			...request,
			id: 'req-internal',
			tokenHash: hashIntakeToken('internal-edit:proj-1'),
			origin: 'internal' as const,
			enabledBlocks: ['event-details' as const],
		};
		const internalSubmission = {
			...submission,
			id: 'sub-internal',
			intakeRequestId: 'req-internal',
			status: 'in_progress' as const,
			blockData: clientSubmission.blockData,
		};
		mockFindRequests.mockResolvedValue([request]);
		mockFindSubmission.mockResolvedValueOnce(clientSubmission).mockResolvedValueOnce(null);
		mockCreateRequest.mockResolvedValue(internalRequest);
		mockCreateSubmission.mockResolvedValue(internalSubmission);

		const result = await ensureInternalEditContext('proj-1');

		expect(mockCreateSubmission).toHaveBeenCalledWith({
			intakeRequestId: 'req-internal',
			blockData: clientSubmission.blockData,
		});
		expect(result.request.origin).toBe('internal');
	});
});

describe('saveInternalComments', () => {
	it('finalizes internal source data as approved', async () => {
		mockUpdateSubmission.mockResolvedValue({ ...submission, clientComments: 'Nota interna' });

		await saveInternalComments('sub-1', 'Nota interna');

		expect(mockUpdateSubmission).toHaveBeenCalledWith('sub-1', {
			clientComments: 'Nota interna',
			status: 'approved',
			reviewedAt: expect.any(String),
		});
	});
});
