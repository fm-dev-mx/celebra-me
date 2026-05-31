import { eventDetailsBlockSchema } from '@/lib/intake/schemas/intake-block.schema';
import { getVisibleFields } from '@/lib/intake/blocks';
import { normalizeDate } from '@/lib/intake/services/draft-content-mapper';
import { ensureInternalEditContext } from '@/lib/intake/services/internal-edit.service';
import type { IntakeRequest, IntakeSubmission, InvitationProject } from '@/lib/intake/types';
import type { IntakeBlockType } from '@/lib/intake/types';

// ---------------------------------------------------------------------------
// Date validation
// ---------------------------------------------------------------------------

describe('eventDate validation', () => {
	it('accepts YYYY-MM-DD from HTML date input', () => {
		const result = eventDetailsBlockSchema.safeParse({
			celebrantName: 'Ana',
			eventLabel: 'XV Anos',
			eventDate: '2027-11-20',
			eventTitle: 'XV Ana',
		});
		expect(result.success).toBe(true);
	});

	it('accepts full ISO datetime string', () => {
		const result = eventDetailsBlockSchema.safeParse({
			celebrantName: 'Ana',
			eventLabel: 'XV Anos',
			eventDate: '2027-11-20T18:00:00.000Z',
			eventTitle: 'XV Ana',
		});
		expect(result.success).toBe(true);
	});

	it('accepts ISO datetime without timezone', () => {
		const result = eventDetailsBlockSchema.safeParse({
			celebrantName: 'Ana',
			eventLabel: 'XV Anos',
			eventDate: '2027-11-20T18:00:00',
			eventTitle: 'XV Ana',
		});
		expect(result.success).toBe(true);
	});

	it('rejects empty string', () => {
		const result = eventDetailsBlockSchema.safeParse({
			celebrantName: 'Ana',
			eventLabel: 'XV Anos',
			eventDate: '',
			eventTitle: 'XV Ana',
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toContain('obligatoria');
		}
	});

	it('rejects undefined date', () => {
		const result = eventDetailsBlockSchema.safeParse({
			celebrantName: 'Ana',
			eventLabel: 'XV Anos',
			eventTitle: 'XV Ana',
		});
		expect(result.success).toBe(false);
	});

	it('rejects gibberish string', () => {
		const result = eventDetailsBlockSchema.safeParse({
			celebrantName: 'Ana',
			eventLabel: 'XV Anos',
			eventDate: 'not-a-date',
			eventTitle: 'XV Ana',
		});
		expect(result.success).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Event-type specific field visibility
// ---------------------------------------------------------------------------

describe('getVisibleFields', () => {
	it('shows secondaryName for boda events', () => {
		const fields = getVisibleFields('boda', 'event-details');
		const fieldNames = fields.map((f) => f.name);
		expect(fieldNames).toContain('secondaryName');
	});

	it('hides secondaryName for xv events', () => {
		const fields = getVisibleFields('xv', 'event-details');
		const fieldNames = fields.map((f) => f.name);
		expect(fieldNames).not.toContain('secondaryName');
	});

	it('hides secondaryName for bautizo events', () => {
		const fields = getVisibleFields('bautizo', 'event-details');
		const fieldNames = fields.map((f) => f.name);
		expect(fieldNames).not.toContain('secondaryName');
	});

	it('hides secondaryName for cumple events', () => {
		const fields = getVisibleFields('cumple', 'event-details');
		const fieldNames = fields.map((f) => f.name);
		expect(fieldNames).not.toContain('secondaryName');
	});

	it('shows spouseName for boda events', () => {
		const fields = getVisibleFields('boda', 'main-people');
		const fieldNames = fields.map((f) => f.name);
		expect(fieldNames).toContain('spouseName');
	});

	it('hides spouseName for xv events', () => {
		const fields = getVisibleFields('xv', 'main-people');
		const fieldNames = fields.map((f) => f.name);
		expect(fieldNames).not.toContain('spouseName');
	});

	it('shows celebrantName for all event types', () => {
		for (const eventType of ['xv', 'boda', 'bautizo', 'cumple'] as const) {
			const fields = getVisibleFields(eventType, 'event-details');
			const fieldNames = fields.map((f) => f.name);
			expect(fieldNames).toContain('celebrantName');
		}
	});

	it('shows fatherName for all event types', () => {
		for (const eventType of ['xv', 'boda', 'bautizo', 'cumple'] as const) {
			const fields = getVisibleFields(eventType, 'main-people');
			const fieldNames = fields.map((f) => f.name);
			expect(fieldNames).toContain('fatherName');
		}
	});
});

// ---------------------------------------------------------------------------
// Date normalization in draft content mapper
// ---------------------------------------------------------------------------

describe('normalizeDate', () => {
	it('converts YYYY-MM-DD to ISO datetime', () => {
		const result = normalizeDate('2027-11-20');
		expect(result).toBe('2027-11-20T00:00:00.000Z');
	});

	it('passes through ISO datetime unchanged', () => {
		const result = normalizeDate('2027-11-20T18:00:00.000Z');
		expect(result).toBe('2027-11-20T18:00:00.000Z');
	});

	it('passes through ISO datetime without timezone', () => {
		const result = normalizeDate('2027-11-20T18:00:00');
		expect(result).toBe('2027-11-20T18:00:00');
	});

	it('returns empty string for empty input', () => {
		const result = normalizeDate('');
		expect(result).toBe('');
	});

	it('returns empty string for undefined', () => {
		const result = normalizeDate(undefined);
		expect(result).toBe('');
	});

	it('returns empty string for null', () => {
		const result = normalizeDate(null);
		expect(result).toBe('');
	});
});

// ---------------------------------------------------------------------------
// Internal edit context: non-empty enabledBlocks
// ---------------------------------------------------------------------------

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
} from '@/lib/intake/repositories/intake-submission.repository';

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

const ALL_BLOCK_TYPES: IntakeBlockType[] = [
	'event-details',
	'main-people',
	'date-locations',
	'photos',
	'rsvp-config',
	'music',
	'gifts',
	'special-messages',
];

const makeProject = (overrides?: Partial<InvitationProject>): InvitationProject => ({
	id: 'proj-1',
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
	createdAt: '2026-05-30T00:00:00Z',
	updatedAt: '2026-05-30T00:00:00Z',
	...overrides,
});

const makeRequest = (overrides?: Partial<IntakeRequest>): IntakeRequest => ({
	id: 'req-1',
	invitationProjectId: 'proj-1',
	tokenHash: 'internal-edit:proj-1',
	tokenCiphertext: null,
	origin: 'internal',
	status: 'active',
	enabledBlocks: ALL_BLOCK_TYPES,
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

describe('ensureInternalEditContext enabledBlocks fallback', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('falls back to getBlockTypesForEventType when recommendedBlocks is empty', async () => {
		const project = makeProject({
			snapshot: { ...makeProject().snapshot, recommendedBlocks: [] },
		});
		mockFindProject.mockResolvedValue(project);
		mockFindRequests.mockResolvedValue([]);
		mockCreateRequest.mockResolvedValue(makeRequest());
		mockFindSubmission.mockResolvedValue(null);
		mockCreateSubmission.mockResolvedValue(makeSubmission());

		const result = await ensureInternalEditContext('proj-1');

		expect(result.request.enabledBlocks.length).toBeGreaterThan(0);
		expect(result.request.enabledBlocks).toContain('event-details');
	});

	it('uses client request enabledBlocks when available', async () => {
		const project = makeProject();
		mockFindProject.mockResolvedValue(project);
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

		const result = await ensureInternalEditContext('proj-1');
		expect(result.request.enabledBlocks).toEqual(['event-details', 'main-people']);
	});

	it('never returns empty enabledBlocks', async () => {
		const project = makeProject({
			snapshot: { ...makeProject().snapshot, recommendedBlocks: [] as IntakeBlockType[] },
		});
		mockFindProject.mockResolvedValue(project);
		mockFindRequests.mockResolvedValue([]);
		mockCreateRequest.mockResolvedValue(makeRequest());
		mockFindSubmission.mockResolvedValue(null);
		mockCreateSubmission.mockResolvedValue(makeSubmission());

		const result = await ensureInternalEditContext('proj-1');
		expect(result.request.enabledBlocks.length).toBeGreaterThan(0);
	});
});
