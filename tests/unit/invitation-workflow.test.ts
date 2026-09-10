import {
	canRecordOwnerReview,
	WorkflowCommandSchema,
	workflowUpdate,
} from '../../src/lib/intake/workflow';

const expectedUpdatedAt = '2026-09-10T12:00:00.000Z';

describe('administrative invitation workflow', () => {
	it('reserves review to the authorized owner identity', () => {
		expect(canRecordOwnerReview(' CELEBRA.ME.COM@gmail.com ')).toBe(true);
		expect(canRecordOwnerReview('preview@preview.com')).toBe(false);
		expect(canRecordOwnerReview(undefined)).toBe(false);
	});
	it('does not allow clients to supply review attribution', () => {
		expect(
			WorkflowCommandSchema.safeParse({
				action: 'confirm_review',
				expectedUpdatedAt,
				ownerReviewedBy: 'forged',
			}).success,
		).toBe(false);
	});
	it('changes work independently of review and publication', () => {
		expect(
			workflowUpdate(
				{ action: 'set_work_status', workStatus: 'completed', expectedUpdatedAt },
				'actor',
				'now',
			),
		).toEqual({ work_status: 'completed' });
	});
	it('records and clears review without completing work', () => {
		expect(
			workflowUpdate({ action: 'confirm_review', expectedUpdatedAt }, 'actor', 'now'),
		).toEqual({ owner_reviewed_at: 'now', owner_reviewed_by: 'actor' });
		expect(
			workflowUpdate({ action: 'clear_review', expectedUpdatedAt }, 'actor', 'now'),
		).toEqual({ owner_reviewed_at: null, owner_reviewed_by: null });
	});
});
