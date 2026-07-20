/**
 * Unit tests for scripts/provision/invitation-import-engine.ts
 */

import { describe, it, expect } from '@jest/globals';
import { checkTargetDivergenceConflict } from '../../scripts/provision/invitation-import-engine';

describe('Invitation Import Engine — Target Divergence Protection', () => {
	const pkgDraftContent = { hero: { title: 'Package Title' } };
	const matchingTargetContent = { hero: { title: 'Package Title' } };
	const divergedTargetContent = { hero: { title: 'Host Edited Title Directly in Dashboard' } };
	const publishedTargetContent = { hero: { title: 'Old Published Title' } };

	it('allows import when target draft matches package draft', () => {
		expect(() => {
			checkTargetDivergenceConflict(
				'test-slug',
				pkgDraftContent,
				{ status: 'draft', content: matchingTargetContent },
				{ content: publishedTargetContent },
				false,
			);
		}).not.toThrow();
	});

	it('allows import when target draft matches target published content (untouched host edit)', () => {
		expect(() => {
			checkTargetDivergenceConflict(
				'test-slug',
				pkgDraftContent,
				{ status: 'draft', content: publishedTargetContent },
				{ content: publishedTargetContent },
				false,
			);
		}).not.toThrow();
	});

	it('throws error when target draft has un-published local modifications that differ from package', () => {
		expect(() => {
			checkTargetDivergenceConflict(
				'test-slug',
				pkgDraftContent,
				{ status: 'draft', content: divergedTargetContent },
				{ content: publishedTargetContent },
				false,
			);
		}).toThrow(
			/target draft revision.*package content hash.*target draft hash.*target published hash/i,
		);
	});

	it('allows import when allowDivergentOverwrite is true despite divergence', () => {
		expect(() => {
			checkTargetDivergenceConflict(
				'test-slug',
				pkgDraftContent,
				{ status: 'draft', content: divergedTargetContent },
				{ content: publishedTargetContent },
				true,
			);
		}).not.toThrow();
	});
});
