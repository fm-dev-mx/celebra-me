import { describe, expect, it } from '@jest/globals';
import { evaluatePreviewRevision } from '@/lib/editor/preview-revision';

describe('evaluatePreviewRevision', () => {
	it('is a no-op when no revision is requested', () => {
		expect(
			evaluatePreviewRevision({
				requestedRevision: null,
				draftUpdatedAt: '2026-07-27T17:22:00.216614+00:00',
				priorError: null,
			}),
		).toEqual({ revisionMismatch: false, errorMessage: null });
	});

	it('accepts a matching draft revision', () => {
		const revision = '2026-07-27T17:22:00.216614+00:00';
		expect(
			evaluatePreviewRevision({
				requestedRevision: revision,
				draftUpdatedAt: revision,
				priorError: null,
			}),
		).toEqual({ revisionMismatch: false, errorMessage: null });
	});

	it('flags a mismatch when the draft revision differs', () => {
		const result = evaluatePreviewRevision({
			requestedRevision: '2026-07-27T17:00:00.000Z',
			draftUpdatedAt: '2026-07-27T17:22:00.216614+00:00',
			priorError: null,
		});
		expect(result.revisionMismatch).toBe(true);
		expect(result.errorMessage).toMatch(/no coincide/);
	});

	it('does not clobber a prior error with a revision mismatch', () => {
		const result = evaluatePreviewRevision({
			requestedRevision: '2026-07-27T17:00:00.000Z',
			draftUpdatedAt: undefined,
			priorError: 'Invitación no encontrada.',
		});
		expect(result).toEqual({
			revisionMismatch: false,
			errorMessage: 'Invitación no encontrada.',
		});
	});
});
