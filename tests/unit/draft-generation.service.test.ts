jest.mock('@/lib/intake/repositories/invitation-project.repository', () => ({
	findInvitationProjectById: jest.fn(),
}));

jest.mock('@/lib/intake/services/intake-request.service', () => ({
	getIntakeRequestsByProjectId: jest.fn(),
}));

jest.mock('@/lib/intake/services/intake-submission.service', () => ({
	getSubmissionByRequestId: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/invitation-content-draft.repository', () => ({
	findDraftByProjectId: jest.fn(),
	upsertDraft: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/intake-request.repository', () => ({
	createIntakeRequest: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/intake-submission.repository', () => ({
	createIntakeSubmission: jest.fn(),
}));

import type {
	InvitationProject,
	IntakeRequest,
	IntakeSubmission,
	InvitationContentDraft,
} from '@/lib/intake/types';
import { generateDraft, getDraft } from '@/lib/intake/services/draft-generation.service';
import { findInvitationProjectById } from '@/lib/intake/repositories/invitation-project.repository';
import { getIntakeRequestsByProjectId } from '@/lib/intake/services/intake-request.service';
import { getSubmissionByRequestId } from '@/lib/intake/services/intake-submission.service';
import {
	findDraftByProjectId,
	upsertDraft,
} from '@/lib/intake/repositories/invitation-content-draft.repository';
const mockGetProject = findInvitationProjectById as jest.MockedFunction<
	typeof findInvitationProjectById
>;
const mockGetRequests = getIntakeRequestsByProjectId as jest.MockedFunction<
	typeof getIntakeRequestsByProjectId
>;
const mockGetSubmission = getSubmissionByRequestId as jest.MockedFunction<
	typeof getSubmissionByRequestId
>;
const mockFindDraft = findDraftByProjectId as jest.MockedFunction<typeof findDraftByProjectId>;
const mockUpsertDraft = upsertDraft as jest.MockedFunction<typeof upsertDraft>;

const baseProject: InvitationProject = {
	id: 'proj-1',
	slug: null,
	title: 'Test Project',
	eventType: 'xv',
	status: 'in_production',
	baseDemoId: 'demo-xv-jewelry-box',
	themeId: 'jewelry-box',
	snapshot: {
		id: 'demo-xv-jewelry-box',
		eventType: 'xv',
		displayName: 'Test',
		themeId: 'jewelry-box',
		defaultSections: ['quote', 'family', 'gallery'],
		supportedBlocks: ['event-details', 'main-people'],
		recommendedBlocks: ['event-details'],
		requiredAssets: ['hero', 'portrait'],
		previewSlug: 'demo-xv-jewelry-box',
	},
	clientName: 'Test Client',
	clientEmail: '',
	clientWhatsapp: '5214421234567',
	photosReceived: false,
	createdBy: null,
	createdAt: '2026-05-28T00:00:00Z',
	updatedAt: '2026-05-28T00:00:00Z',
};

const baseRequest: IntakeRequest = {
	id: 'req-1',
	invitationProjectId: 'proj-1',
	tokenHash: 'abc123hash',
	tokenCiphertext: null,
	status: 'submitted',
	enabledBlocks: ['event-details', 'main-people', 'photos', 'special-messages'],
	expiresAt: null,
	createdAt: '2026-05-28T00:00:00Z',
	updatedAt: '2026-05-28T00:00:00Z',
};

const approvedSubmission: IntakeSubmission = {
	id: 'sub-1',
	intakeRequestId: 'req-1',
	status: 'approved',
	blockData: {
		'event-details': {
			celebrantName: 'Ana Sofia',
			secondaryName: '',
			eventLabel: 'Mis XV Anos',
			eventDate: '2027-11-20T18:00:00Z',
			eventTitle: 'XV Anos — Ana Sofia',
			description: 'Una noche magica',
			nickname: 'Anita',
		},
		'main-people': {
			fatherName: 'Fernando Valenzuela',
			motherName: 'Maria Duarte',
			spouseName: '',
			godparents: 'Arturo Valenzuela — Padrino\nLucia Duarte — Madrina',
			children: '',
			sectionMessage: 'Nuestra familia te recibe con alegria',
		},
		photos: {
			whatsappSent: true,
			heroPhoto: 'Foto de Ana Sofia en el jardin',
			portraitPhoto: 'Retrato formal de estudio',
			galleryPhotos: '',
			familyPhoto: '',
			specialPhoto: '',
			generalNotes: 'Prefieren tonos calidos',
		},
		'special-messages': {
			quoteText: 'Entre rosas y luz de velas',
			quoteAuthor: 'Ana Sofia',
			thankYouMessage: 'Gracias por compartir esta noche',
			thankYouClosingName: 'Ana Sofia Valenzuela',
		},
	},
	photoNotes: {},
	clientComments: '',
	submittedAt: '2026-05-28T12:00:00Z',
	reviewedAt: '2026-05-28T13:00:00Z',
	reviewNotes: 'Aprobado',
	createdAt: '2026-05-28T10:00:00Z',
	updatedAt: '2026-05-28T13:00:00Z',
};

const draftRow: InvitationContentDraft = {
	id: 'draft-1',
	invitationProjectId: 'proj-1',
	submissionId: 'sub-1',
	content: {
		title: 'XV Anos — Ana Sofia',
		description: 'Una noche magica',
		hero: {
			name: 'Ana Sofia',
			label: 'Mis XV Anos',
			nickname: 'Anita',
			date: '2027-11-20T18:00:00Z',
		},
		family: {
			fatherName: 'Fernando Valenzuela',
			motherName: 'Maria Duarte',
			godparents: 'Arturo Valenzuela — Padrino\nLucia Duarte — Madrina',
			sectionMessage: 'Nuestra familia te recibe con alegria',
		},
		quote: {
			text: 'Entre rosas y luz de velas',
			author: 'Ana Sofia',
		},
		thankYou: {
			message: 'Gracias por compartir esta noche',
			closingName: 'Ana Sofia Valenzuela',
		},
		photoNotes: {
			whatsappSent: true,
			heroPhoto: 'Foto de Ana Sofia en el jardin',
			portraitPhoto: 'Retrato formal de estudio',
		},
	},
	status: 'draft',
	createdAt: '2026-05-28T14:00:00Z',
	updatedAt: '2026-05-28T14:00:00Z',
};

beforeEach(() => {
	jest.clearAllMocks();
});

describe('generateDraft', () => {
	it('generates a draft from an approved submission', async () => {
		mockGetProject.mockResolvedValue(baseProject);
		mockGetRequests.mockResolvedValue([baseRequest]);
		mockGetSubmission.mockResolvedValue(approvedSubmission);
		mockUpsertDraft.mockResolvedValue(draftRow);

		const result = await generateDraft('proj-1');

		expect(result).toEqual(draftRow);
		expect(mockUpsertDraft).toHaveBeenCalledWith({
			invitationProjectId: 'proj-1',
			submissionId: 'sub-1',
			content: expect.objectContaining({
				title: 'XV Anos — Ana Sofia',
				hero: expect.objectContaining({
					name: 'Ana Sofia',
				}),
				quote: expect.objectContaining({
					text: 'Entre rosas y luz de velas',
				}),
				thankYou: expect.objectContaining({
					message: 'Gracias por compartir esta noche',
				}),
			}),
		});
	});

	it('rejects draft generation when submission is in_progress', async () => {
		mockGetProject.mockResolvedValue(baseProject);
		mockGetRequests.mockResolvedValue([baseRequest]);
		mockGetSubmission.mockResolvedValue({ ...approvedSubmission, status: 'in_progress' });

		await expect(generateDraft('proj-1')).rejects.toThrow(/aprobada/i);
	});

	it('rejects draft generation when submission is submitted (not yet approved)', async () => {
		mockGetProject.mockResolvedValue(baseProject);
		mockGetRequests.mockResolvedValue([baseRequest]);
		mockGetSubmission.mockResolvedValue({ ...approvedSubmission, status: 'submitted' });

		await expect(generateDraft('proj-1')).rejects.toThrow(/aprobada/i);
	});

	it('rejects draft generation when submission is needs_changes', async () => {
		mockGetProject.mockResolvedValue(baseProject);
		mockGetRequests.mockResolvedValue([baseRequest]);
		mockGetSubmission.mockResolvedValue({ ...approvedSubmission, status: 'needs_changes' });

		await expect(generateDraft('proj-1')).rejects.toThrow(/aprobada/i);
	});

	it('rejects when project is not found', async () => {
		mockGetProject.mockResolvedValue(null);

		await expect(generateDraft('non-existent')).rejects.toMatchObject({
			status: 404,
			code: 'not_found',
		});
		expect(mockUpsertDraft).not.toHaveBeenCalled();
	});

	it('rejects when no intake request exists', async () => {
		mockGetProject.mockResolvedValue(baseProject);
		mockGetRequests.mockResolvedValue([]);

		await expect(generateDraft('proj-1')).rejects.toThrow(/captura/i);
	});

	it('rejects when no submission exists', async () => {
		mockGetProject.mockResolvedValue(baseProject);
		mockGetRequests.mockResolvedValue([baseRequest]);
		mockGetSubmission.mockResolvedValue(null);

		await expect(generateDraft('proj-1')).rejects.toThrow(/aprobada/i);
	});

	it('idempotent: regenerating updates the same draft via upsert', async () => {
		mockGetProject.mockResolvedValue(baseProject);
		mockGetRequests.mockResolvedValue([baseRequest]);
		mockGetSubmission.mockResolvedValue(approvedSubmission);
		mockUpsertDraft.mockResolvedValue(draftRow);

		await generateDraft('proj-1');
		await generateDraft('proj-1');

		expect(mockUpsertDraft).toHaveBeenCalledTimes(2);
		expect(mockUpsertDraft).toHaveBeenCalledWith({
			invitationProjectId: 'proj-1',
			submissionId: 'sub-1',
			content: expect.any(Object),
		});
	});

	it('maps event-details block to hero content', async () => {
		mockGetProject.mockResolvedValue(baseProject);
		mockGetRequests.mockResolvedValue([baseRequest]);
		mockGetSubmission.mockResolvedValue(approvedSubmission);
		mockUpsertDraft.mockResolvedValue(draftRow);

		await generateDraft('proj-1');

		type UpsertParams = {
			content: Record<string, unknown>;
			invitationProjectId: string;
			submissionId: string;
		};
		const content = (mockUpsertDraft.mock.calls[0][0] as UpsertParams).content;
		expect(content.title).toBe('XV Anos — Ana Sofia');
		expect((content.hero as Record<string, unknown>).name).toBe('Ana Sofia');
		expect((content.hero as Record<string, unknown>).label).toBe('Mis XV Anos');
		expect((content.hero as Record<string, unknown>).date).toBe('2027-11-20T18:00:00Z');
	});

	it('maps special-messages block to quote and thankYou', async () => {
		mockGetProject.mockResolvedValue(baseProject);
		mockGetRequests.mockResolvedValue([baseRequest]);
		mockGetSubmission.mockResolvedValue(approvedSubmission);
		mockUpsertDraft.mockResolvedValue(draftRow);

		await generateDraft('proj-1');

		type UpsertParams = {
			content: Record<string, unknown>;
			invitationProjectId: string;
			submissionId: string;
		};
		const content = (mockUpsertDraft.mock.calls[0][0] as UpsertParams).content;
		expect((content.quote as Record<string, unknown>).text).toBe('Entre rosas y luz de velas');
		expect((content.thankYou as Record<string, unknown>).message).toBe(
			'Gracias por compartir esta noche',
		);
	});

	it('does not fail when optional blocks are omitted', async () => {
		const partialRequest: IntakeRequest = {
			...baseRequest,
			enabledBlocks: ['event-details'],
		};
		const partialSubmission: IntakeSubmission = {
			...approvedSubmission,
			blockData: {
				'event-details': approvedSubmission.blockData['event-details'],
			},
		};

		mockGetProject.mockResolvedValue(baseProject);
		mockGetRequests.mockResolvedValue([partialRequest]);
		mockGetSubmission.mockResolvedValue(partialSubmission);
		mockUpsertDraft.mockResolvedValue(draftRow);

		const result = await generateDraft('proj-1');
		expect(result).toBeDefined();
	});
});

describe('getDraft', () => {
	it('returns draft when found', async () => {
		mockFindDraft.mockResolvedValue(draftRow);

		const result = await getDraft('proj-1');
		expect(result).toEqual(draftRow);
		expect(mockFindDraft).toHaveBeenCalledWith('proj-1');
	});

	it('returns null when no draft exists', async () => {
		mockFindDraft.mockResolvedValue(null);

		const result = await getDraft('proj-1');
		expect(result).toBeNull();
	});
});
