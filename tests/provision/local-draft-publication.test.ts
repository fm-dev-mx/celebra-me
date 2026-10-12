/**
 * Persistent-local apply: approved-draft republish and operator error rendering.
 * publish_invitation_atomic leaves the draft 'approved'; a later publication-only change
 * (e.g. composition.intersections) must reset it or the RPC raises publish_invalid_draft_status.
 */
import { describe, expect, it } from '@jest/globals';
import {
	describeApplyError,
	resolveLocalDraftMutation,
} from '../../scripts/provision/local-draft-publication.ts';

describe('resolveLocalDraftMutation', () => {
	it('inserts when no draft exists', () => {
		expect(
			resolveLocalDraftMutation({
				existingDraft: null,
				isDraftContentIdentical: false,
				shouldPublish: true,
			}),
		).toBe('insert');
	});

	it('replaces content when the draft diverges, regardless of publish', () => {
		expect(
			resolveLocalDraftMutation({
				existingDraft: { status: 'approved' },
				isDraftContentIdentical: false,
				shouldPublish: false,
			}),
		).toBe('replace_content');
	});

	it('resets an approved draft when only published content changes', () => {
		expect(
			resolveLocalDraftMutation({
				existingDraft: { status: 'approved' },
				isDraftContentIdentical: true,
				shouldPublish: true,
			}),
		).toBe('reset_status');
	});

	it('resets any non-draft status before publishing', () => {
		expect(
			resolveLocalDraftMutation({
				existingDraft: { status: 'submitted' },
				isDraftContentIdentical: true,
				shouldPublish: true,
			}),
		).toBe('reset_status');
	});

	it('leaves a draft already in draft status untouched', () => {
		expect(
			resolveLocalDraftMutation({
				existingDraft: { status: 'draft' },
				isDraftContentIdentical: true,
				shouldPublish: true,
			}),
		).toBe('none');
	});

	it('keeps an approved draft when nothing is published (zero drift)', () => {
		expect(
			resolveLocalDraftMutation({
				existingDraft: { status: 'approved' },
				isDraftContentIdentical: true,
				shouldPublish: false,
			}),
		).toBe('none');
	});
});

describe('describeApplyError', () => {
	it('renders a plain PostgREST error object instead of [object Object]', () => {
		const message = describeApplyError({
			message: 'publish_invalid_draft_status',
			code: 'P0001',
			details: null,
			hint: null,
		});
		expect(message).toBe('publish_invalid_draft_status (code: P0001)');
		expect(message).not.toContain('[object Object]');
	});

	it('includes details and hint when present', () => {
		expect(
			describeApplyError({
				message: 'duplicate key value violates unique constraint',
				code: '23505',
				details: 'Key (id)=(1) already exists.',
				hint: 'Retry with a new id',
			}),
		).toBe(
			'duplicate key value violates unique constraint (code: 23505) details: Key (id)=(1) already exists. hint: Retry with a new id',
		);
	});

	it('keeps plain Error messages unchanged', () => {
		expect(describeApplyError(new Error('Target draft changed after planning.'))).toBe(
			'Target draft changed after planning.',
		);
	});

	it('renders strings, primitives and unknown objects readably', () => {
		expect(describeApplyError('boom')).toBe('boom');
		expect(describeApplyError(undefined)).toBe('undefined');
		expect(describeApplyError({ status: 500 })).toBe('{"status":500}');
	});
});
