/**
 * managed-merge-baseline.test.ts — Ancestor precedence for managed three-way merges
 */

import { describe, expect, it } from '@jest/globals';
import { resolveManagedMergeBaseline } from '../../scripts/provision/managed-merge-baseline.ts';

describe('resolveManagedMergeBaseline', () => {
	const draftContent = { title: 'Draft' };
	const publishedContent = { title: 'Published' };
	const managedProjection = { title: 'Managed projection' };

	it('prefers managed_projection over published and draft content when fresh', () => {
		expect(
			resolveManagedMergeBaseline({
				managedProjection,
				managedAppliedAt: '2026-07-28T18:00:00.000Z',
				publishedContent,
				publishedAt: '2026-07-28T17:00:00.000Z',
				draftContent,
			}),
		).toBe(managedProjection);
	});

	it('keeps managed when publishedAt equals managedAppliedAt (strict greater-than only)', () => {
		expect(
			resolveManagedMergeBaseline({
				managedProjection,
				managedAppliedAt: '2026-07-28T18:00:00.000Z',
				publishedContent,
				publishedAt: '2026-07-28T18:00:00.000Z',
				draftContent,
			}),
		).toBe(managedProjection);
	});

	it('uses published content when managed_projection is older than the publication', () => {
		expect(
			resolveManagedMergeBaseline({
				managedProjection,
				managedAppliedAt: '2026-07-28T17:00:00.000Z',
				publishedContent,
				publishedAt: '2026-07-28T22:00:00.000Z',
				draftContent,
			}),
		).toBe(publishedContent);
	});

	it('treats managed as fresh when timestamps are invalid or absent', () => {
		expect(
			resolveManagedMergeBaseline({
				managedProjection,
				managedAppliedAt: 'not-a-date',
				publishedContent,
				publishedAt: '2026-07-28T22:00:00.000Z',
				draftContent,
			}),
		).toBe(managedProjection);

		expect(
			resolveManagedMergeBaseline({
				managedProjection,
				managedAppliedAt: null,
				publishedContent,
				publishedAt: '2026-07-28T22:00:00.000Z',
				draftContent,
			}),
		).toBe(managedProjection);

		expect(
			resolveManagedMergeBaseline({
				managedProjection,
				managedAppliedAt: '2026-07-28T17:00:00.000Z',
				publishedContent,
				publishedAt: null,
				draftContent,
			}),
		).toBe(managedProjection);
	});

	it('uses managed when published is null and managed is present', () => {
		expect(
			resolveManagedMergeBaseline({
				managedProjection,
				managedAppliedAt: '2026-07-28T17:00:00.000Z',
				publishedContent: null,
				publishedAt: null,
				draftContent,
			}),
		).toBe(managedProjection);
	});

	it('falls back to published content when managed_projection is null', () => {
		expect(
			resolveManagedMergeBaseline({
				managedProjection: null,
				publishedContent,
				draftContent,
			}),
		).toBe(publishedContent);
	});

	it('falls back to draft content when projection and published are absent', () => {
		expect(
			resolveManagedMergeBaseline({
				managedProjection: null,
				publishedContent: null,
				draftContent,
			}),
		).toBe(draftContent);
	});
});
