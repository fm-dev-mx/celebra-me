/**
 * semantic-delta.test.ts — Three-way merge apply / conflict coverage
 */

import { describe, expect, it } from '@jest/globals';
import {
	apply3WaySemanticPatch,
	listDriftConflicts,
} from '../../scripts/provision/semantic-delta.ts';

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

	it('resolves overlapping edits when an explicit package choice is supplied', () => {
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
			resolutions: { 'gallery.items[0].alt': 'package' },
		});

		expect(result.blocked).toBe(false);
		expect(result.patchedContent.gallery).toEqual({ items: [{ alt: 'Managed alt' }] });
	});

	it('keeps the target value when an explicit target choice is supplied for a conflict', () => {
		const result = apply3WaySemanticPatch({
			previousCanonical: { envelope: { tooltipText: 'Abrir' } },
			currentCanonical: { envelope: { tooltipText: 'ABRIR' } },
			currentTarget: { envelope: { tooltipText: '' } },
			scope: 'content-only',
			resolutions: { 'envelope.tooltipText': 'target' },
		});

		expect(result.blocked).toBe(false);
		expect(result.patchedContent.envelope).toEqual({ tooltipText: '' });
	});

	it('keeps the target on a safe APPLY path when path policy selects target', () => {
		const result = apply3WaySemanticPatch({
			previousCanonical: { hero: { subtitle: 'Old' }, thankYou: { phrase: 'Gracias' } },
			currentCanonical: { hero: { subtitle: 'New' }, thankYou: { phrase: 'Con gratitud' } },
			currentTarget: { hero: { subtitle: 'Old' }, thankYou: { phrase: 'Gracias' } },
			scope: 'content-only',
			resolutions: { 'thankYou.phrase': 'target' },
		});

		expect(result.blocked).toBe(false);
		expect(result.patchedContent).toEqual({
			hero: { subtitle: 'New' },
			thankYou: { phrase: 'Gracias' },
		});
		expect(
			result.deltas.find((delta) => delta.path === 'thankYou.phrase')?.status,
		).toBe('ALREADY_APPLIED');
		expect(
			result.deltas.find((delta) => delta.path === 'hero.subtitle')?.status,
		).toBe('APPLY');
	});

	it('honors section-prefix path policy for selective apply', () => {
		const result = apply3WaySemanticPatch({
			previousCanonical: {
				sharing: { invitation: 'Old invite', reminder: 'Old reminder' },
				hero: { title: 'Old' },
			},
			currentCanonical: {
				sharing: { invitation: 'New invite', reminder: 'New reminder' },
				hero: { title: 'New' },
			},
			currentTarget: {
				sharing: { invitation: 'Old invite', reminder: 'Old reminder' },
				hero: { title: 'Old' },
			},
			scope: 'content-only',
			resolutions: { sharing: 'target' },
		});

		expect(result.blocked).toBe(false);
		expect(result.patchedContent).toEqual({
			sharing: { invitation: 'Old invite', reminder: 'Old reminder' },
			hero: { title: 'New' },
		});
	});

	it('stays blocked when only some drift paths are resolved', () => {
		const result = apply3WaySemanticPatch({
			previousCanonical: {
				envelope: { tooltipText: 'A', microcopy: 'B' },
				hero: { name: 'Old' },
			},
			currentCanonical: {
				envelope: { tooltipText: 'PKG', microcopy: 'PKG-B' },
				hero: { name: 'Pkg' },
			},
			currentTarget: {
				envelope: { tooltipText: 'Host', microcopy: 'Host-B' },
				hero: { name: 'Host' },
			},
			scope: 'content-only',
			resolutions: { 'envelope.tooltipText': 'package' },
		});

		expect(result.blocked).toBe(true);
		expect(listDriftConflicts(result.deltas).map((d) => d.path).sort()).toEqual([
			'envelope.microcopy',
			'hero.name',
		]);
		expect(result.patchedContent.envelope).toMatchObject({ tooltipText: 'PKG' });
	});

	it('does not unblock when a resolution path does not match a conflict', () => {
		const result = apply3WaySemanticPatch({
			previousCanonical: { envelope: { tooltipText: 'A' } },
			currentCanonical: { envelope: { tooltipText: 'PKG' } },
			currentTarget: { envelope: { tooltipText: 'Host' } },
			scope: 'content-only',
			resolutions: { 'envelope.missingField': 'package' },
		});

		expect(result.blocked).toBe(true);
		expect(listDriftConflicts(result.deltas).map((d) => d.path)).toEqual([
			'envelope.tooltipText',
		]);
	});

	it('unblocks when mixed package/target resolutions cover every drift path', () => {
		const result = apply3WaySemanticPatch({
			previousCanonical: {
				envelope: { tooltipText: 'A', microcopy: 'B' },
			},
			currentCanonical: {
				envelope: { tooltipText: 'PKG', microcopy: 'PKG-B' },
			},
			currentTarget: {
				envelope: { tooltipText: 'Host', microcopy: 'Host-B' },
			},
			scope: 'content-only',
			resolutions: {
				'envelope.tooltipText': 'package',
				'envelope.microcopy': 'target',
			},
		});

		expect(result.blocked).toBe(false);
		expect(result.patchedContent.envelope).toEqual({
			tooltipText: 'PKG',
			microcopy: 'Host-B',
		});
		expect(listDriftConflicts(result.deltas)).toEqual([]);
	});

	it.each([
		['package-only addition', {}, { hero: { label: 'Paquete' } }, {}, { hero: { label: 'Paquete' } }],
		['target-only addition', {}, {}, { hero: { label: 'Destino' } }, { hero: { label: 'Destino' } }],
		[
			'identical concurrent addition',
			{},
			{ hero: { label: 'Igual' } },
			{ hero: { label: 'Igual' } },
			{ hero: { label: 'Igual' } },
		],
	] as const)('%s', (_name, previousCanonical, currentCanonical, currentTarget, expected) => {
		const result = apply3WaySemanticPatch({
			previousCanonical,
			currentCanonical,
			currentTarget,
			scope: 'content-only',
		});
		expect(result.blocked).toBe(false);
		expect(result.patchedContent).toEqual(expected);
	});

	it('reports differing concurrent additions as explicit drift', () => {
		const result = apply3WaySemanticPatch({
			previousCanonical: {},
			currentCanonical: { hero: { label: 'Paquete' } },
			currentTarget: { hero: { label: 'Destino' } },
			scope: 'content-only',
		});
		expect(result.blocked).toBe(true);
		expect(result.deltas).toEqual(
			expect.arrayContaining([expect.objectContaining({ path: 'hero', status: 'DRIFT' })]),
		);
	});

	it('structurally deletes a package-owned property without writing undefined', () => {
		const result = apply3WaySemanticPatch({
			previousCanonical: { hero: { label: 'Remove', name: 'Keep' } },
			currentCanonical: { hero: { name: 'Keep' } },
			currentTarget: { hero: { label: 'Remove', name: 'Keep' } },
			scope: 'content-only',
		});
		expect(result.blocked).toBe(false);
		expect(result.patchedContent).toEqual({ hero: { name: 'Keep' } });
		expect(result.operations).toContainEqual({ kind: 'remove', path: ['hero', 'label'] });
		expect(Object.hasOwn(result.patchedContent.hero as object, 'label')).toBe(false);
	});

	it('preserves explicit null as distinct from structural deletion', () => {
		const result = apply3WaySemanticPatch({
			previousCanonical: { hero: { label: 'Remove' } },
			currentCanonical: { hero: { label: null } },
			currentTarget: { hero: { label: 'Remove' } },
			scope: 'content-only',
		});
		expect(result.patchedContent).toEqual({ hero: { label: null } });
		expect(result.operations).toContainEqual({
			kind: 'replace',
			path: ['hero', 'label'],
			value: null,
		});
	});

	it('deletes a complete optional section structurally', () => {
		const result = apply3WaySemanticPatch({
			previousCanonical: { quote: { text: 'Antes' }, hero: { name: 'Ana' } },
			currentCanonical: { hero: { name: 'Ana' } },
			currentTarget: { quote: { text: 'Antes' }, hero: { name: 'Ana' } },
			scope: 'content-only',
		});
		expect(result.patchedContent).toEqual({ hero: { name: 'Ana' } });
		expect(result.operations).toContainEqual({ kind: 'remove', path: ['quote'] });
	});

	it.each([
		[
			'object-array contraction',
			[{ id: 'a' }, { id: 'b' }, { id: 'c' }],
			[{ id: 'a' }, { id: 'c' }],
		],
		['primitive-array contraction', ['a', 'b', 'c'], ['a', 'c']],
	] as const)('%s uses an explicit remove operation', (_name, previousItems, currentItems) => {
		const result = apply3WaySemanticPatch({
			previousCanonical: { gallery: { items: previousItems } },
			currentCanonical: { gallery: { items: currentItems } },
			currentTarget: { gallery: { items: previousItems } },
			scope: 'content-only',
		});
		expect(result.blocked).toBe(false);
		expect((result.patchedContent.gallery as { items: unknown[] }).items).toEqual(currentItems);
		expect(result.operations).toContainEqual({
			kind: 'remove',
			path: ['gallery', 'items', 1],
		});
	});

	it('reports target modification versus package deletion as drift', () => {
		const result = apply3WaySemanticPatch({
			previousCanonical: { quote: { text: 'Base' } },
			currentCanonical: {},
			currentTarget: { quote: { text: 'Editado' } },
			scope: 'content-only',
		});
		expect(result.blocked).toBe(true);
		expect(result.patchedContent).toEqual({ quote: { text: 'Editado' } });
		expect(result.deltas).toContainEqual(
			expect.objectContaining({ path: 'quote', operation: 'remove', status: 'DRIFT' }),
		);
	});
});
