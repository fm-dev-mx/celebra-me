import { GET, PATCH, POST } from '@/pages/api/dashboard/intake/[id]/edit';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import {
	ensureAdminEditContext,
	saveInternalComments,
} from '@/lib/intake/services/admin-edit.service';
import { saveSubmissionStep } from '@/lib/intake/services/intake-submission.service';
import { createMockRequest } from '../helpers/api-mocks';

jest.mock('@/lib/rsvp/security/admin-rate-limit', () => ({
	requireAdminRateLimit: jest.fn().mockResolvedValue(undefined as never),
}));

jest.mock('@/lib/rsvp/security/csrf', () => ({
	validateCsrfToken: jest.fn(),
	shouldSkipCsrfValidation: jest.fn().mockReturnValue(false),
}));

jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminStrongSession: jest.fn(),
}));

jest.mock('@/lib/intake/services/admin-edit.service', () => ({
	ensureAdminEditContext: jest.fn(),
	saveInternalComments: jest.fn(),
}));

jest.mock('@/lib/intake/services/intake-submission.service', () => ({
	saveSubmissionStep: jest.fn(),
}));

const mockRequireAdmin = requireAdminStrongSession as jest.MockedFunction<
	typeof requireAdminStrongSession
>;
const mockEnsureContext = ensureAdminEditContext as jest.MockedFunction<
	typeof ensureAdminEditContext
>;
const mockSaveStep = saveSubmissionStep as jest.MockedFunction<typeof saveSubmissionStep>;
const mockSaveComments = saveInternalComments as jest.MockedFunction<typeof saveInternalComments>;

const context = {
	invitation: {
		id: 'proj-1',
		title: 'Proyecto',
		eventType: 'xv' as const,
		status: 'published' as const,
	},
	request: {
		id: 'req-1',
		enabledBlocks: ['event-details' as const],
	},
	submission: {
		id: 'sub-1',
		status: 'approved' as const,
		blockData: {},
		clientComments: '',
	},
};

beforeEach(() => {
	jest.clearAllMocks();
	mockRequireAdmin.mockResolvedValue({ userId: 'admin-1' } as never);
	mockEnsureContext.mockResolvedValue(context as never);
	mockSaveStep.mockResolvedValue(context.submission as never);
	mockSaveComments.mockResolvedValue(context.submission as never);
});

describe('/api/dashboard/intake/[id]/edit', () => {
	it('returns always-editable internal context for an approved submission', async () => {
		const response = await GET({
			request: createMockRequest(),
			params: { id: 'proj-1' },
		} as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			invitation: { id: 'proj-1', status: 'published' },
			submission: { id: 'sub-1', status: 'approved' },
		});
	});

	it('saves a block through the internal submission helper', async () => {
		const response = await PATCH({
			request: createMockRequest({
				blockType: 'event-details',
				blockData: { celebrantName: 'Ana' },
			}),
			cookies: {},
			params: { id: 'proj-1' },
		} as never);

		expect(response.status).toBe(200);
		expect(mockSaveStep).toHaveBeenCalledWith(
			'sub-1',
			'event-details',
			{
				celebrantName: 'Ana',
			},
			true,
		);
	});

	it('saves comments without submitting the client workflow', async () => {
		const response = await POST({
			request: createMockRequest({ clientComments: 'Nota interna' }),
			cookies: {},
			params: { id: 'proj-1' },
		} as never);

		expect(response.status).toBe(200);
		expect(mockSaveComments).toHaveBeenCalledWith('sub-1', 'Nota interna');
	});
});
