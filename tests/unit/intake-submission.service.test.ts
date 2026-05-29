jest.mock('@/lib/intake/repositories/intake-submission.repository', () => ({
	findIntakeSubmissionById: jest.fn(),
	findSubmissionByRequestId: jest.fn(),
	findSubmissionsByRequestId: jest.fn(),
	createIntakeSubmission: jest.fn(),
	updateIntakeSubmission: jest.fn(),
}));

import {
	findIntakeSubmissionById,
	createIntakeSubmission,
	updateIntakeSubmission,
} from '@/lib/intake/repositories/intake-submission.repository';
import {
	saveSubmissionStep,
	submitSubmission,
	approveSubmission,
	requestChanges,
	createSubmission,
} from '@/lib/intake/services/intake-submission.service';

const mockFindById = findIntakeSubmissionById as jest.MockedFunction<
	typeof findIntakeSubmissionById
>;
const mockCreate = createIntakeSubmission as jest.MockedFunction<typeof createIntakeSubmission>;
const mockUpdate = updateIntakeSubmission as jest.MockedFunction<typeof updateIntakeSubmission>;

const baseSubmission = {
	id: 'sub-1',
	intakeRequestId: 'req-1',
	status: 'in_progress' as const,
	blockData: {},
	photoNotes: {},
	clientComments: '',
	submittedAt: null,
	reviewedAt: null,
	reviewNotes: '',
	createdAt: '2026-01-01T00:00:00Z',
	updatedAt: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
	jest.clearAllMocks();
});

describe('createSubmission', () => {
	it('creates a new submission', async () => {
		mockCreate.mockResolvedValue(baseSubmission);
		const result = await createSubmission({ intakeRequestId: 'req-1' });
		expect(result).toEqual(baseSubmission);
		expect(mockCreate).toHaveBeenCalledWith({ intakeRequestId: 'req-1' });
	});
});

describe('saveSubmissionStep', () => {
	it('saves block data for in_progress submission', async () => {
		mockFindById.mockResolvedValue(baseSubmission);
		const updated = {
			...baseSubmission,
			blockData: { 'event-details': { celebrantName: 'Ana' } },
		};
		mockUpdate.mockResolvedValue(updated);

		const result = await saveSubmissionStep('sub-1', 'event-details', { celebrantName: 'Ana' });
		expect(result.blockData).toEqual({ 'event-details': { celebrantName: 'Ana' } });
		expect(mockUpdate).toHaveBeenCalledWith('sub-1', {
			blockData: { 'event-details': { celebrantName: 'Ana' } },
		});
	});

	it('merges block data with existing data', async () => {
		const existing = {
			...baseSubmission,
			blockData: { 'event-details': { celebrantName: 'Ana' } },
		};
		mockFindById.mockResolvedValue(existing);
		const updated = {
			...existing,
			blockData: {
				'event-details': { celebrantName: 'Ana' },
				music: { url: 'https://example.com' },
			},
		};
		mockUpdate.mockResolvedValue(updated);

		const result = await saveSubmissionStep('sub-1', 'music', { url: 'https://example.com' });
		expect(result.blockData).toHaveProperty('event-details');
		expect(result.blockData).toHaveProperty('music');
	});

	it('allows editing when status is submitted', async () => {
		const submitted = { ...baseSubmission, status: 'submitted' as const };
		mockFindById.mockResolvedValue(submitted);
		const updated = {
			...submitted,
			blockData: { 'event-details': { celebrantName: 'Updated' } },
		};
		mockUpdate.mockResolvedValue(updated);

		const result = await saveSubmissionStep('sub-1', 'event-details', {
			celebrantName: 'Updated',
		});
		expect(result.status).toBe('submitted');
	});

	it('allows editing when status is needs_changes', async () => {
		const needsChanges = { ...baseSubmission, status: 'needs_changes' as const };
		mockFindById.mockResolvedValue(needsChanges);
		const updated = {
			...needsChanges,
			blockData: { 'event-details': { celebrantName: 'Fixed' } },
		};
		mockUpdate.mockResolvedValue(updated);

		const result = await saveSubmissionStep('sub-1', 'event-details', {
			celebrantName: 'Fixed',
		});
		expect(result.status).toBe('needs_changes');
	});

	it('blocks editing when status is approved', async () => {
		const approved = { ...baseSubmission, status: 'approved' as const };
		mockFindById.mockResolvedValue(approved);

		await expect(
			saveSubmissionStep('sub-1', 'event-details', { celebrantName: 'Nope' }),
		).rejects.toThrow('Cannot edit an approved submission.');
	});

	it('throws when submission not found', async () => {
		mockFindById.mockResolvedValue(null);
		await expect(saveSubmissionStep('sub-999', 'event-details', {})).rejects.toThrow(
			'Intake submission not found.',
		);
	});
});

describe('submitSubmission', () => {
	it('sets status to submitted with timestamp', async () => {
		mockFindById.mockResolvedValue(baseSubmission);
		const submitted = {
			...baseSubmission,
			status: 'submitted' as const,
			submittedAt: '2026-05-28T00:00:00Z',
		};
		mockUpdate.mockResolvedValue(submitted);

		const result = await submitSubmission('sub-1', 'Some comments');
		expect(result.status).toBe('submitted');
		expect(mockUpdate).toHaveBeenCalledWith('sub-1', {
			status: 'submitted',
			clientComments: 'Some comments',
			submittedAt: expect.any(String),
		});
	});

	it('blocks resubmission of approved submission', async () => {
		const approved = { ...baseSubmission, status: 'approved' as const };
		mockFindById.mockResolvedValue(approved);

		await expect(submitSubmission('sub-1')).rejects.toThrow(
			'Cannot resubmit an approved submission.',
		);
	});

	it('allows resubmission from needs_changes', async () => {
		const needsChanges = { ...baseSubmission, status: 'needs_changes' as const };
		mockFindById.mockResolvedValue(needsChanges);
		const resubmitted = { ...needsChanges, status: 'submitted' as const };
		mockUpdate.mockResolvedValue(resubmitted);

		const result = await submitSubmission('sub-1');
		expect(result.status).toBe('submitted');
	});
});

describe('approveSubmission', () => {
	it('sets status to approved with review notes', async () => {
		const submitted = { ...baseSubmission, status: 'submitted' as const };
		mockFindById.mockResolvedValue(submitted);
		const approved = {
			...baseSubmission,
			status: 'approved' as const,
			reviewNotes: 'Looks great!',
		};
		mockUpdate.mockResolvedValue(approved);

		const result = await approveSubmission('sub-1', 'Looks great!');
		expect(result.status).toBe('approved');
		expect(mockUpdate).toHaveBeenCalledWith('sub-1', {
			status: 'approved',
			reviewNotes: 'Looks great!',
			reviewedAt: expect.any(String),
		});
	});

	it('throws 409 conflict when submission is already approved', async () => {
		const approved = { ...baseSubmission, status: 'approved' as const };
		mockFindById.mockResolvedValue(approved);

		await expect(approveSubmission('sub-1')).rejects.toMatchObject({
			status: 409,
			code: 'submission_already_approved',
			message: 'Submission is already approved.',
		});
		expect(mockUpdate).not.toHaveBeenCalled();
	});

	it('throws 422 invalid_submission_status when submission is in_progress', async () => {
		mockFindById.mockResolvedValue(baseSubmission);

		await expect(approveSubmission('sub-1')).rejects.toMatchObject({
			status: 422,
			code: 'invalid_submission_status',
			message: 'Can only approve a submitted submission.',
		});
		expect(mockUpdate).not.toHaveBeenCalled();
	});

	it('throws 422 invalid_submission_status when submission is needs_changes', async () => {
		const needsChanges = { ...baseSubmission, status: 'needs_changes' as const };
		mockFindById.mockResolvedValue(needsChanges);

		await expect(approveSubmission('sub-1')).rejects.toMatchObject({
			status: 422,
			code: 'invalid_submission_status',
			message: 'Can only approve a submitted submission.',
		});
		expect(mockUpdate).not.toHaveBeenCalled();
	});

	it('throws 404 not_found when submission not found', async () => {
		mockFindById.mockResolvedValue(null);

		await expect(approveSubmission('sub-999')).rejects.toMatchObject({
			status: 404,
			code: 'not_found',
			message: 'Intake submission not found.',
		});
	});
});

describe('requestChanges', () => {
	it('sets status to needs_changes with review notes', async () => {
		const submitted = { ...baseSubmission, status: 'submitted' as const };
		mockFindById.mockResolvedValue(submitted);
		const needsChanges = {
			...baseSubmission,
			status: 'needs_changes' as const,
			reviewNotes: 'Fix date',
		};
		mockUpdate.mockResolvedValue(needsChanges);

		const result = await requestChanges('sub-1', 'Fix date');
		expect(result.status).toBe('needs_changes');
		expect(mockUpdate).toHaveBeenCalledWith('sub-1', {
			status: 'needs_changes',
			reviewNotes: 'Fix date',
			reviewedAt: expect.any(String),
		});
	});

	it('throws 409 conflict when submission is already approved', async () => {
		const approved = { ...baseSubmission, status: 'approved' as const };
		mockFindById.mockResolvedValue(approved);

		await expect(requestChanges('sub-1', 'Fix')).rejects.toMatchObject({
			status: 409,
			code: 'submission_already_approved',
			message: 'Cannot request changes on an approved submission.',
		});
		expect(mockUpdate).not.toHaveBeenCalled();
	});

	it('throws 422 invalid_submission_status when submission is in_progress', async () => {
		mockFindById.mockResolvedValue(baseSubmission);

		await expect(requestChanges('sub-1', 'Fix')).rejects.toMatchObject({
			status: 422,
			code: 'invalid_submission_status',
			message: 'Can only request changes on a submitted submission.',
		});
		expect(mockUpdate).not.toHaveBeenCalled();
	});

	it('throws 422 invalid_submission_status when submission is needs_changes', async () => {
		const needsChanges = { ...baseSubmission, status: 'needs_changes' as const };
		mockFindById.mockResolvedValue(needsChanges);

		await expect(requestChanges('sub-1', 'Fix')).rejects.toMatchObject({
			status: 422,
			code: 'invalid_submission_status',
			message: 'Can only request changes on a submitted submission.',
		});
		expect(mockUpdate).not.toHaveBeenCalled();
	});
});
