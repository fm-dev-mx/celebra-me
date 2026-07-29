/**
 * conflict-resolutions / field-selections merge helpers
 */
import { describe, expect, it } from '@jest/globals';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
	buildPathPolicyFromSelection,
	collectSelectableFieldPaths,
	collectSelectableSectionRoots,
	fingerprintPathPolicy,
	loadConflictResolutionsFile,
	mergePathPolicies,
	parseConflictResolutionsJson,
	sortPathPolicy,
	suggestConflictResolutionsFile,
} from '../../scripts/provision/conflict-resolutions.ts';
import type { FunctionalChange } from '../../scripts/provision/invitation-update-plan.ts';

describe('conflict-resolutions', () => {
	it('parses a path map', () => {
		expect(parseConflictResolutionsJson({ 'envelope.tooltipText': 'package' })).toEqual({
			'envelope.tooltipText': 'package',
		});
	});

	it('accepts an empty object', () => {
		expect(parseConflictResolutionsJson({})).toEqual({});
	});

	it('rejects invalid choices', () => {
		expect(() => parseConflictResolutionsJson({ 'envelope.tooltipText': 'keep' })).toThrow(
			/Resolución inválida/,
		);
	});

	it.each([
		['root array', []],
		['non-object root', 'package'],
	])('rejects a %s', (_label, value) => {
		expect(() => parseConflictResolutionsJson(value)).toThrow(/objeto JSON/);
	});

	it('suggests target as the default keep-editor choice', () => {
		expect(suggestConflictResolutionsFile([{ path: 'envelope.tooltipText' }])).toEqual({
			resolutions: { 'envelope.tooltipText': 'target' },
		});
	});

	it('loads a wrapped { resolutions } file', () => {
		const dir = mkdtempSync(join(tmpdir(), 'conflict-resolutions-'));
		const path = join(dir, 'resolutions.json');
		try {
			writeFileSync(
				path,
				JSON.stringify({
					resolutions: {
						'envelope.tooltipText': 'package',
						'envelope.microcopy': 'target',
					},
				}),
			);
			expect(loadConflictResolutionsFile(path)).toEqual({
				'envelope.tooltipText': 'package',
				'envelope.microcopy': 'target',
			});
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('loads field-selections via the shared loader label', () => {
		const dir = mkdtempSync(join(tmpdir(), 'field-selections-'));
		const path = join(dir, 'selections.json');
		try {
			writeFileSync(
				path,
				JSON.stringify({
					resolutions: {
						'sharing.invitation': 'package',
						theme: 'target',
					},
				}),
			);
			expect(loadConflictResolutionsFile(path, 'selección de campos')).toEqual({
				'sharing.invitation': 'package',
				theme: 'target',
			});
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('rejects a bare path map file', () => {
		const dir = mkdtempSync(join(tmpdir(), 'conflict-resolutions-'));
		const path = join(dir, 'resolutions.json');
		try {
			writeFileSync(path, JSON.stringify({ 'envelope.tooltipText': 'package' }));
			expect(() => loadConflictResolutionsFile(path)).toThrow(/resolutions/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('throws when the resolutions file is missing', () => {
		expect(() =>
			loadConflictResolutionsFile(join(tmpdir(), 'missing-conflict-resolutions.json')),
		).toThrow(/No se encontró el archivo de resoluciones/);
	});
});

describe('path policy merge and field selections', () => {
	it('merges field selections with conflict resolutions (conflicts win)', () => {
		const merged = mergePathPolicies(
			{ 'hero.title': 'target', 'sharing.invitation': 'package' },
			{ 'hero.title': 'package' },
		);
		expect(merged).toEqual({
			'hero.title': 'package',
			'sharing.invitation': 'package',
		});
	});

	it('builds package/target maps from selected paths', () => {
		expect(
			buildPathPolicyFromSelection({
				availablePaths: ['a', 'b', 'c'],
				selectedPaths: ['a', 'c'],
			}),
		).toEqual({ a: 'package', b: 'target', c: 'package' });
		expect(
			buildPathPolicyFromSelection({
				availablePaths: ['rsvp', 'sharing'],
				selectedPaths: ['rsvp'],
			}),
		).toEqual({ rsvp: 'package', sharing: 'target' });
	});

	it('collects selectable paths and section roots from functional changes', () => {
		const changes: FunctionalChange[] = [
			{
				section: 'Pase / RSVP',
				entity: 'Título',
				label: 'Pase / RSVP — Título',
				operation: 'update',
				field: 'rsvp.title',
				scope: 'database',
				technicalWriteCount: 1,
			},
			{
				section: 'Storage',
				entity: 'hero.jpg',
				label: 'Subida: hero.jpg',
				operation: 'upload',
				scope: 'storage',
				technicalWriteCount: 1,
			},
			{
				section: 'Sharing',
				entity: 'Invitation',
				label: 'Sharing — Invitation',
				operation: 'insert',
				field: 'sharing.invitation',
				scope: 'database',
				technicalWriteCount: 1,
			},
		];
		expect(collectSelectableFieldPaths(changes)).toEqual(['rsvp.title', 'sharing.invitation']);
		expect(collectSelectableSectionRoots(changes)).toEqual(['rsvp', 'sharing']);
	});

	it('fingerprints path policies with stable key order', () => {
		const left = fingerprintPathPolicy({ b: 'target', a: 'package' });
		const right = fingerprintPathPolicy({ a: 'package', b: 'target' });
		expect(left).toBe(right);
		expect(sortPathPolicy({ b: 'target', a: 'package' })).toEqual({
			a: 'package',
			b: 'target',
		});
	});
});
