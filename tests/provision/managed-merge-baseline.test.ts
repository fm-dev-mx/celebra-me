/**
 * managed-merge-baseline.test.ts — Ancestor precedence for managed three-way merges
 */

import { describe, expect, it } from '@jest/globals';
import { resolveManagedMergeBaseline } from '../../scripts/provision/managed-merge-baseline.ts';

describe('resolveManagedMergeBaseline', () => {
	const draftContent = { title: 'Draft' };
	const publishedContent = { title: 'Published' };
	const managedProjection = { title: 'Managed projection' };

	it('prefers managed_projection over published and draft content', () => {
		expect(
			resolveManagedMergeBaseline({
				managedProjection,
				publishedContent,
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
