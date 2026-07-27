/**
 * semantic-delta.test.ts — Three-way merge apply / conflict coverage
 */

import { describe, expect, it } from '@jest/globals';
import { apply3WaySemanticPatch } from '../../scripts/provision/semantic-delta.ts';

describe('apply3WaySemanticPatch', () => {
	it('merges non-overlapping content changes onto the target', () => {
		const previousCanonical = {
			hero: { title: 'Base', subtitle: 'Old subtitle' },
			thankYou: { closingName: 'Abril' },
		};
		const currentCanonical = {
			hero: { title: 'Base', subtitle: 'New subtitle' },
			thankYou: { closingName: 'Abril' },
		};
		const currentTarget = {
			hero: { title: 'Host edited title', subtitle: 'Old subtitle' },
			thankYou: { closingName: 'Abril' },
		};

		const result = apply3WaySemanticPatch({
			previousCanonical,
			currentCanonical,
			currentTarget,
			scope: 'content-only',
			targetName: 'local',
		});

		expect(result.blocked).toBe(false);
		expect(result.patchedContent).toEqual({
			hero: { title: 'Host edited title', subtitle: 'New subtitle' },
			thankYou: { closingName: 'Abril' },
		});
		expect(
			result.deltas.some(
				(delta) => delta.path === 'hero.subtitle' && delta.status === 'APPLY',
			),
		).toBe(true);
	});

	it('blocks overlapping edits and reports the conflicting paths', () => {
		const previousCanonical = {
			gallery: { items: [{ alt: 'Original alt' }] },
		};
		const currentCanonical = {
			gallery: { items: [{ alt: 'Managed alt' }] },
		};
		const currentTarget = {
			gallery: { items: [{ alt: 'Host alt' }] },
		};

		const result = apply3WaySemanticPatch({
			previousCanonical,
			currentCanonical,
			currentTarget,
			scope: 'content-only',
			targetName: 'local',
		});

		expect(result.blocked).toBe(true);
		expect(result.blockReason).toMatch(/gallery\.items\[0\]\.alt/);
		const driftPaths = result.deltas
			.filter((delta) => delta.status === 'DRIFT')
			.map((delta) => delta.path);
		expect(driftPaths).toContain('gallery.items[0].alt');
		expect(result.patchedContent.gallery).toEqual({ items: [{ alt: 'Host alt' }] });
	});
});
