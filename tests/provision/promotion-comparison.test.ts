/**
 * promotion-comparison.test.ts — Divergence reporting regression coverage
 */

import { describe, expect, it } from '@jest/globals';
import {
	ACKNOWLEDGE_DISCARD_UNPUBLISHED_DRAFT_FLAG,
	checkTargetDivergenceConflict,
	isTargetDivergenceConflictMessage,
	TARGET_DIVERGENCE_ACKNOWLEDGE_HINT,
} from '../../scripts/provision/promotion-comparison.ts';
import { hashPublicationProjection } from '../../src/lib/intake/services/publication-diff.service.ts';

describe('checkTargetDivergenceConflict', () => {
	const draftContent = { title: 'Draft title', copy: 'local edit' };
	const publishedContent = { title: 'Published title', copy: 'published' };
	const proposedContent = { title: 'Proposed title', copy: 'managed' };

	it('reports the published version number instead of none when version is present', () => {
		expect(() =>
			checkTargetDivergenceConflict(
				'abril-michelle-becerra-rea',
				proposedContent,
				{
					status: 'draft',
					updated_at: '2026-07-27T12:00:00.000Z',
					content: draftContent,
				},
				{
					version: 19,
					content: publishedContent,
				},
			),
		).toThrow(/target published version 19/);
	});

	it('never reports published version as none when an existing publication carries version', () => {
		try {
			checkTargetDivergenceConflict(
				'test-slug',
				proposedContent,
				{
					status: 'draft',
					updated_at: '2026-07-27T12:00:00.000Z',
					content: draftContent,
				},
				{
					version: 3,
					content: publishedContent,
				},
			);
			throw new Error('Expected divergence conflict');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			expect(message).toContain('target published version 3');
			expect(message).not.toMatch(/target published version none/);
		}
	});

	it('includes package content hash separately from proposed merged-content hash', () => {
		const packageHash = hashPublicationProjection({ title: 'Package', copy: 'canonical' });
		const proposedHash = hashPublicationProjection(proposedContent);

		expect(() =>
			checkTargetDivergenceConflict(
				'test-slug',
				proposedContent,
				{
					status: 'draft',
					updated_at: '2026-07-27T12:00:00.000Z',
					content: draftContent,
				},
				{
					version: 2,
					content: publishedContent,
				},
				{
					packageContentHash: packageHash,
				},
			),
		).toThrow(
			new RegExp(
				`package content hash ${packageHash}; proposed merged-content hash ${proposedHash}`,
			),
		);
	});

	it('includes the acknowledgement flag in the conflict message', () => {
		expect(() =>
			checkTargetDivergenceConflict(
				'test-slug',
				proposedContent,
				{
					status: 'draft',
					updated_at: '2026-07-27T12:00:00.000Z',
					content: draftContent,
				},
				{
					version: 2,
					content: publishedContent,
				},
			),
		).toThrow(ACKNOWLEDGE_DISCARD_UNPUBLISHED_DRAFT_FLAG);
	});

	it('classifies the conflict message for TTY recovery', () => {
		try {
			checkTargetDivergenceConflict(
				'test-slug',
				proposedContent,
				{
					status: 'draft',
					updated_at: '2026-07-27T12:00:00.000Z',
					content: draftContent,
				},
				{
					version: 2,
					content: publishedContent,
				},
			);
			throw new Error('Expected divergence conflict');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			expect(isTargetDivergenceConflictMessage(message)).toBe(true);
			expect(message).toContain(TARGET_DIVERGENCE_ACKNOWLEDGE_HINT);
		}
	});

	it('does not throw when unpublished draft discard is acknowledged', () => {
		expect(() =>
			checkTargetDivergenceConflict(
				'test-slug',
				proposedContent,
				{
					status: 'draft',
					updated_at: '2026-07-27T12:00:00.000Z',
					content: draftContent,
				},
				{
					version: 2,
					content: publishedContent,
				},
				{
					acknowledgeDiscardUnpublishedDraft: true,
				},
			),
		).not.toThrow();
	});
});
